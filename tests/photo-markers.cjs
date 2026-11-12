const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const images = [], markers = [];
const element = tag => ({
    tag, style: { setProperty(key, value) { this[key] = value; } }, attributes: {}, children: [], listeners: {},
    setAttribute(key, value) { this.attributes[key] = value; },
    append(...children) { this.children.push(...children); },
    removeChild(child) { const i = this.children.indexOf(child); if (i >= 0) this.children.splice(i, 1); },
    addEventListener(key, callback) { this.listeners[key] = callback; }
});
const context = vm.createContext({
    URL, location: { href: 'https://example.test/map/' }, setTimeout, clearTimeout,
    document: { createElement(tag) { const node = element(tag); if (tag === 'img') images.push(node); return node; } },
    maplibregl: { Marker: class {
        constructor(options) { this.element = options.element; markers.push(this); }
        setLngLat(value) { this.lnglat = value; return this; }
        addTo(map) { this.map = map; return this; }
        remove() { this.removed = true; }
    } }
});
vm.runInContext(fs.readFileSync('lib/photomarkerlib.js', 'utf8') + '\nthis.Controller = PhotoMarkerController;', context);
const Controller = context.Controller;
const select = (activities, tags, forms, config) => Controller.firstImage(activities, tags, forms, config);
const form = { Event: { form: { photo: { type: 'image_url', gsheet: 'picture_url2' } } } };
assert.equal(select([{ id: 'Event/1', picture_url1: 'wrong.jpg', picture_url2: 'right.jpg' }], {}, form), 'https://example.test/map/right.jpg');
assert.equal(select([{ id: 'WP/1', picture_url10: 'ten.jpg', picture_url2: 'two.jpg', picture_url1: ' ' }]), 'https://example.test/map/two.jpg');
assert.equal(select([{ id: 'WP/1', picture_url1: 'javascript:alert(1)' }], { image: 'https://images.test/osm.jpg' }), 'https://images.test/osm.jpg');
assert.equal(select([], { wikimedia_commons: 'File:Art.jpg' }), 'File:Art.jpg');
assert.equal(select([], { wikimedia_commons: 'Category:Art' }), '');
assert.equal(select([], {}), '');
assert.equal(select([{ id: 'WP/1', custom: './custom.jpg' }], {}, {}, { imageFields: ['custom'] }), 'https://example.test/map/custom.jpg');

const flush = () => new Promise(resolve => setImmediate(resolve));
const item = (id, image = `https://images.test/${id}.jpg`, extra = {}) => ({ id, image, lnglat: [135, 34], name: id, favorite: false, size: 38, color: '#888888', ...extra });
(async () => {
    let selected;
    const map = { on() {}, getCanvas: () => ({ getBoundingClientRect: () => ({ left: 100, top: 50 }) }),
        unproject: point => [point.x, point.y] };
    const controller = new Controller(map, { onSelect: id => { selected = id; } });
    controller.sync([item('a'), item('b')], { use: false });
    assert.equal(images.length, 0, 'opt-in defaults leave native markers alone');
    controller.sync([item('a'), item('a'), item('b'), item('c')], { use: true, maxMarkers: 2 });
    assert.equal(images.length, 2, 'deduplicate facilities and cap active requests/markers');
    assert.equal(markers.length, 0, 'keep native icon until the photo has loaded');
    assert.equal(images[0].crossOrigin, undefined, 'ordinary img works without server CORS headers');
    images[0].onload(); await flush();
    assert.equal(markers.length, 1);
    controller.sync([{ ...item('a'), favorite: true, upperFloor: true, name: 'Updated', lnglat: [136, 35] }], { use: true });
    assert.equal(markers.length, 1, 'status/viewport updates reuse loaded images');
    assert.equal(markers[0].element.attributes['aria-label'], 'Updated');
    assert.equal(markers[0].element.attributes['data-upper-floor'], 'true');
    controller.sync([item('a')], { use: true });
    assert.equal(markers[0].element.attributes['data-upper-floor'], 'false');
    controller.sync([{ ...item('a'), favorite: true, upperFloor: true, name: 'Updated', lnglat: [136, 35] }], { use: true });
    assert.equal(markers[0].element.children[1].hidden, false);
    assert.equal(JSON.stringify(markers[0].lnglat), '[136,35]');
    markers[0].element.getBoundingClientRect = () => ({ left: 110, top: 60, width: 40, height: 40 });
    assert.equal(JSON.stringify(controller.getIdsAtPoint({ x: 30, y: 30 })), '["a"]');
    assert.equal(controller.getIdsAtPoint({ x: 10, y: 10 }).length, 0, 'transparent corners of round photos are not click targets');
    const pointer = controller.clickEvent(controller.entries.get('a'), { detail: 1, clientX: 125, clientY: 75 });
    assert.equal(JSON.stringify(pointer.point), '{"x":25,"y":25}', 'DOM pointer uses map-relative CSS pixels');
    const keyboard = controller.clickEvent(controller.entries.get('a'), { detail: 0, clientX: 0, clientY: 0 });
    assert.equal(JSON.stringify(keyboard.point), '{"x":30,"y":30}', 'keyboard activation picks at the displayed photo center');
    markers[0].element.listeners.click({ stopPropagation() {} });
    assert.equal(selected, 'a', 'photo clicks retain facility detail navigation');
    images[1].onload(); await flush();
    assert.equal(markers.length, 1, 'late image cannot resurrect a filtered-out facility');
    controller.sync([item('broken')], { use: true });
    assert.equal(markers[0].removed, true);
    images[2].onerror(); await flush();
    controller.sync([item('broken')], { use: true });
    assert.equal(images.length, 3, 'failed URL is not repeatedly requested on map moves');
    assert.equal(markers.length, 1, 'failed image leaves the native marker in place');
    controller.sync([item('fresh')], { use: true });
    controller.destroy(); images[3].onload(); await flush();
    assert.equal(markers.length, 1, 'map teardown discards in-flight completion');

    const limited = new Controller(map);
    const start = images.length;
    limited.sync(Array.from({ length: 8 }, (_, i) => item(`queued-${i}`)), { use: true });
    assert.equal(images.length - start, 4, 'at most four image loads run concurrently');
    limited.sync([], { use: false });
    for (const image of images.slice(start)) image.onload();
    await flush();
    assert.equal(limited.entries.size, 0, 'disabling clears all photo markers');
    assert.equal(images.length - start, 4, 'cancelled queued facilities are never loaded');
    limited.destroy();
    let resolved;
    const commons = new Controller(map, { resolveCommons: async file => {
        resolved = file; return 'https://commons.test/thumb.jpg';
    } });
    const imageIndex = images.length;
    commons.sync([item('commons', 'File:Artwork.jpg')], { use: true });
    await flush();
    assert.equal(resolved, 'File:Artwork.jpg');
    assert.equal(images[imageIndex].src, 'https://commons.test/thumb.jpg');
    images[imageIndex].onload(); await flush();
    assert.equal(commons.entries.get('commons').marker.map, map);
    commons.destroy();

    // Rubber-stamp decoration for stamped candidates.
    const stampCtl = new Controller(map, { onSelect: id => { selected = id; } });
    const stampItem = (id, extra = {}) => item(id, `https://images.test/${id}.jpg`, { stamp: true, stampColor: '#ff5aa0', stampLabel: 'アート', ...extra });
    const stampStart = images.length;
    stampCtl.sync([stampItem('s1'), item('s2')], { use: true });
    images[stampStart].onload(); images[stampStart + 1].onload(); await flush();
    const stamped = stampCtl.entries.get('s1').marker.element;
    assert.equal(stamped.attributes['data-stamp'], 'true', 'stamped candidates carry the decoration flag');
    assert.equal(stamped.style['--poi-stamp-color'], '#ff5aa0', 'the thick outer ring follows the candidate stamp color');
    let badge = stamped.children.find(node => node.className === 'poi-photo-marker-stamp');
    assert.ok(badge, 'stamped markers gain a rubber-stamp badge');
    assert.equal(badge.attributes['aria-hidden'], 'true', 'the badge is decorative and hidden from assistive tech');
    assert.equal(badge.title, 'アート', 'the decorative icon keeps its label');
    assert.equal(stamped.attributes['aria-label'], 's1（アート）', 'the marker announces the stamp location');
    assert.equal(badge.style.color, '#ff5aa0', 'the badge follows the candidate stamp color');
    const plain = stampCtl.entries.get('s2').marker.element;
    assert.equal(plain.attributes['data-stamp'], 'false', 'non-stamped candidates keep the original appearance');
    assert.equal(plain.children.some(node => node.className === 'poi-photo-marker-stamp'), false, 'non-stamped markers gain no badge');
    assert.equal(plain.children.length, 2, 'non-stamped markers keep the original image and heart only');
    stampCtl.sync([stampItem('s1', { favorite: true })], { use: true });
    assert.equal(stampCtl.entries.get('s1').marker.element.children[1].className, 'poi-photo-marker-heart', 'the favorite heart stays in its original slot');
    assert.equal(stampCtl.entries.get('s1').marker.element.children[1].hidden, false, 'the favorite heart remains visible beside the badge');
    assert.ok(stampCtl.entries.get('s1').marker.element.children.find(node => node.className === 'poi-photo-marker-stamp'), 'the badge survives a favorite-only update');
    stampCtl.sync([item('s1')], { use: true });
    badge = stampCtl.entries.get('s1').marker.element.children.find(node => node.className === 'poi-photo-marker-stamp');
    assert.equal(badge, undefined, 'disabling the stamp removes the badge from the marker');
    assert.equal(stampCtl.entries.get('s1').marker.element.attributes['data-stamp'], 'false');
    const s1Marker = stampCtl.entries.get('s1').marker;
    stampCtl.sync([stampItem('s1')], { use: true });
    assert.equal(stampCtl.entries.get('s1').marker, s1Marker, 're-stamping reuses the loaded photo and marker');
    s1Marker.element.getBoundingClientRect = () => ({ left: 110, top: 60, width: 40, height: 40 });
    s1Marker.element.listeners.click({ stopPropagation() {} });
    assert.equal(selected, 's1', 'clicks on stamped markers keep the original selection behavior');
    stampCtl.destroy();
    console.log('PASS: first image selection, configurable fields, opt-in, deduplication, no-CORS images, load fallback, stale completions, marker limits, statuses, detail clicks and stamp decoration');
})().catch(error => { console.error(error); process.exitCode = 1; });
