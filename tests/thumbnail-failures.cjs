const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const classes = () => { const values = new Set(); return { add: v => values.add(v), remove: v => values.delete(v), contains: v => values.has(v) }; };
function strip() {
    return { children: [], classList: classes(), addEventListener() {}, removeEventListener() {},
        append(img) { this.children.push(img); img.parentElement = this; },
        querySelector() { return this.children[0] ?? null; },
        querySelectorAll() { return this.children.filter(img => img.dataset.thumbnailLoaded === 'true'); },
        getBoundingClientRect: () => ({ left: 0, right: 400, top: 0, bottom: 100, width: 400, height: 100 }),
        set innerHTML(value) { this.children.forEach(img => { img.parentElement = null; }); this.children = []; }
    };
}
const dom = strip();
let ready = 0;
const logs = [];
const context = vm.createContext({
    console: { warn() {}, log: (...args) => logs.push(args) }, Conf: { thumbnail: { limits: 10, slideThumbWidth: 160 } },
    window: { withAppAssetVersion: src => src }, dummy: { style: { height: '100px' } },
    requestAnimationFrame: cb => cb(),
    getWikimedia: async () => ({ queueGetWikiMediaImage: async src => {
        if (src === 'File:API error.jpg') throw new Error('API unavailable');
        return null;
    } }),
    document: { createElement: () => {
        const events = {}, attrs = {};
        return { dataset: {}, complete: false, naturalWidth: 0, parentElement: null,
            setAttribute(name, value) { attrs[name] = value; }, getAttribute: name => attrs[name] ?? null,
            addEventListener: (type, cb) => { events[type] = cb; },
            getBoundingClientRect: () => ({ left: 0, right: 80, top: 0, bottom: 80, width: 80, height: 80 }),
            fail() { events.error(); },
            loaded() { this.complete = true; this.naturalWidth = 80; events.load(); },
            remove() { if (this.parentElement) { const p = this.parentElement; p.children = p.children.filter(img => img !== this); this.parentElement = null; } }
        };
    } }
});
vm.runInContext(fs.readFileSync('lib/winlib.js', 'utf8') + '\nthis.win = new WinCont();', context);
const acts = sources => sources.map((src, i) => ({ src: [src], osmid: `node/${i}`, title: src }));
(async () => {
    const mixed = acts(['good.jpg', 'missing.jpg', 'https://photos.app.goo.gl/example']);
    context.win.setImages(dom, mixed, 'loading.svg', 10, () => ready++);
    const [good, missing, page] = dom.children;
    missing.fail(); page.fail();
    assert.deepEqual(dom.children, [good], '404 and HTML sharing pages leave no broken frames');
    assert.equal(logs.length, 2);
    assert.match(logs[0][0], /取得できないため非表示/);
    assert.equal(logs[0][1].src, 'missing.jpg');
    assert.equal(logs[0][1].osmid, 'node/1');
    assert.equal(logs[0][1].reason, 'image-load-error');
    assert.equal(logs[1][1].src, 'https://photos.app.goo.gl/example');
    missing.fail();
    assert.equal(logs.length, 2, 'the same failed thumbnail is logged once');
    assert.equal(ready, 0, 'failed images must not trigger photo-ready hints');
    good.loaded();
    assert.equal(ready, 1);
    assert.equal(good.dataset.thumbnailLoaded, 'true');
    assert.equal(dom.classList.contains('d-none'), false);
    context.win.setImages(dom, mixed, 'loading.svg', 10, () => {});
    assert.deepEqual(dom.children, [good], 'unchanged lists do not recreate failed images');
    context.win.setImages(dom, acts(['all-fail.jpg']), 'loading.svg', 10);
    dom.children[0].fail();
    assert.equal(dom.children.length, 0);
    assert.equal(dom.classList.contains('d-none'), true);
    assert.equal(context.dummy.style.height, '0px');
    dom.classList.remove('d-none');
    context.win.setImages(dom, acts(['all-fail.jpg']), 'loading.svg', 10);
    assert.equal(dom.classList.contains('d-none'), true, 'reusing an empty strip keeps it hidden');
    context.win.setImages(dom, acts(['File:Missing.jpg', 'File:API error.jpg']), 'loading.svg', 10);
    await new Promise(setImmediate);
    assert.equal(dom.children.length, 0, 'Commons missing metadata and API failures remove placeholders');
    assert.ok(logs.some(([, data]) => data.src === 'File:Missing.jpg' && data.reason === 'wikimedia-image-not-found'));
    assert.ok(logs.some(([, data]) => data.src === 'File:API error.jpg' && data.reason === 'wikimedia-request-failed'));
    assert.equal(logs.some(([, data]) => data.src === 'good.jpg'), false);
    context.win.setImages(dom, acts(['File:Missing.jpg']), 'loading.svg', 10);
    context.win.setImages(dom, acts(['new.jpg']), 'loading.svg', 10);
    dom.classList.remove('d-none');
    await new Promise(setImmediate);
    assert.equal(dom.children.length, 1);
    assert.equal(dom.children[0].src, 'new.jpg');
    assert.equal(dom.classList.contains('d-none'), false, 'late failures cannot hide replacement thumbnails');
    console.log('PASS: broken URLs, HTML pages, Commons failures, mixed success, empty-strip reuse and stale failures');
})().catch(error => { console.error(error); process.exitCode = 1; });
