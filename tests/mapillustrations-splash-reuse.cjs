const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let newImages = 0, draws = 0, textureExports = 0, loadSchedules = 0;
const listeners = new Map();
const originalOnload = () => {};
const startup = {
    src: 'https://example.test/image/splash.png',
    naturalWidth: 800, naturalHeight: 600, complete: false, onload: originalOnload,
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type, handler) { if (listeners.get(type) === handler) listeners.delete(type); }
};
const context = vm.createContext({
    URL, window: { devicePixelRatio: 1, withAppAssetVersion: src => src },
    document: {
        baseURI: 'https://example.test/',
        querySelector: () => startup,
        querySelectorAll: () => [],
        createElement(tag) {
            if (tag === 'img') {
                newImages++;
                return { addEventListener() {}, removeEventListener() {} };
            }
            assert.equal(tag, 'canvas');
            return {
                getContext: () => ({ drawImage(image) { assert.equal(image, startup); draws++; } }),
                toDataURL() { textureExports++; return 'data:image/png;base64,texture'; }
            };
        }
    },
    requestAnimationFrame: () => ++loadSchedules,
    cancelAnimationFrame() {}
});
vm.runInContext(fs.readFileSync(require.resolve('../lib/mapillustrations.js'), 'utf8')
    + '\nthis.MapIllustrations = MapIllustrations;', context);
const illustrations = new context.MapIllustrations();
const map = { getContainer: () => ({}), on() {}, off() {}, getLayer() {}, getSource() {} };
illustrations.init(map, { use: true, items: [
    { image: './image/splash.png', bounds: [135, 34, 136, 35] },
    { image: './image/other.png', bounds: [135, 34, 136, 35] }
] });
assert.equal(newImages, 1); // Only the unrelated artwork creates/loads a new image.
const entry = illustrations.items[0];
assert.equal(entry.image, startup);
assert.equal(startup.onload, originalOnload); // Existing splash handlers remain intact.
assert.equal(startup.crossOrigin, undefined); // Changing this would trigger another request.
startup.complete = true;
const beforeLoad = loadSchedules;
illustrations.frame = null;
listeners.get('load')();
assert.equal(loadSchedules, beforeLoad + 1); // Pending startup loads refresh the map.
const sources = [];
map.addSource = (id, source) => sources.push(source);
map.addLayer = () => {};
illustrations.syncLayer(entry, [[135, 35], [136, 35], [136, 34], [135, 34]]);
assert.equal(sources[0].url, 'data:image/png;base64,texture'); // MapLibre receives no network URL.
assert.equal(illustrations.getTextureUrl(entry), sources[0].url);
assert.equal(draws, 1);
assert.equal(textureExports, 1); // Repeated renders reuse the prepared texture.
illustrations.destroy();
assert.equal(listeners.size, 0);
assert.equal(startup.onload, originalOnload);
assert.equal(startup.src, 'https://example.test/image/splash.png');
console.log('PASS: startup image reuse, pending load, in-memory map source, texture cache and listener cleanup');
