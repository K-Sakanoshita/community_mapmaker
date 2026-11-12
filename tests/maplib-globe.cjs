const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

class FakeMap {
    constructor(options) {
        this.options = options;
        this.handlers = new Map();
        this.projection = 'mercator';
        this.scrollZoom = { setWheelZoomRate() {}, setZoomRate() {} };
        queueMicrotask(() => this.loadStyle());
    }
    on(name, callback) {
        const callbacks = this.handlers.get(name) || [];
        callbacks.push(callback);
        this.handlers.set(name, callbacks);
    }
    once(name, callback) {
        const handler = () => { this.off(name, handler); callback(); };
        this.on(name, handler);
    }
    off(name, callback) {
        this.handlers.set(name, (this.handlers.get(name) || []).filter(fn => fn !== callback));
    }
    loadStyle() {
        this.loaded = true;
        for (const callback of [...(this.handlers.get('style.load') || [])]) callback();
    }
    setStyle(style) {
        this.style = style;
        this.loaded = false;
        this.projection = 'mercator';
    }
    setProjection(projection) {
        assert.equal(this.loaded, true, 'projection must be set after style loading');
        this.projection = projection.type;
    }
    isStyleLoaded() { return this.loaded; }
    getContainer() { return { contains: () => false }; }
    getCanvas() { return { addEventListener() {} }; }
    triggerRepaint() {}
}

const conf = {
    map: { tileName: 'vector', initZoom: 1.07, viewCenter: [96, 0] },
    tile: { vector: { style: 'vector.json' }, raster: { style: 'raster.json' } },
    marker: { tag: {}, subtag: {}, background: [] },
    icon: {}
};
const context = vm.createContext({
    console, setTimeout, clearTimeout,
    window: { withAppAssetVersion: value => value },
    document: { addEventListener() {} },
    pmtiles: { Protocol: class { tile() {} } },
    maplibregl: { Map: FakeMap, addProtocol() {} },
    Conf: conf
});
vm.runInContext(fs.readFileSync('lib/maplib.js', 'utf8') + '\nthis.mapLibre = new Maplibre();', context);
context.mapLibre.bindIndoorBuildingSourceEvents = () => {};
// Sky initialization is unrelated to projection; skip its delayed UI update.
context.setTimeout = (callback, delay) => delay === 1000 ? 0 : setTimeout(callback, delay);

(async () => {
    await context.mapLibre.init(conf);
    const renderer = context.mapLibre;
    assert.equal(renderer.map.projection, 'globe', 'initial low-zoom map uses globe');
    assert.equal(renderer.map.options.zoom, 1.07, 'requested zoom is preserved');
    for (const style of ['raster', 'vector']) {
        assert.equal(renderer.changeMap(style), style);
        assert.equal(renderer.map.projection, 'mercator', 'new style starts with default projection');
        renderer.map.loadStyle();
        assert.equal(renderer.map.projection, 'globe', 'style change restores globe');
    }
    console.log('maplib globe: ok');
})().catch(error => { console.error(error); process.exitCode = 1; });
