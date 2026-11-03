const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const converter = require('../lib/osmtogeojson.js');
const workerCode = fs.readFileSync('lib/osm-data-worker.js', 'utf8');
let tasks = [], terminated = 0;
class TestWorker {
    constructor(url) {
        assert.equal(url, './lib/osm-data-worker.js?ver=test');
        this.context = vm.createContext({ URL,
            self: { location: new URL(url, 'https://example.test/maps/'),
                postMessage: data => this.onmessage({ data }) },
            importScripts: url => {
                assert.equal(url, 'https://example.test/maps/lib/osmtogeojson.js?ver=test');
                this.context.self.osmtogeojson = converter;
            }
        });
        vm.runInContext(workerCode, this.context);
    }
    postMessage(data) {
        tasks.push(data.task);
        queueMicrotask(() => this.context.self.onmessage({ data }));
    }
    terminate() { terminated++; }
}
const context = vm.createContext({ console: { log() {}, warn() {} }, Worker: TestWorker,
    setTimeout, clearTimeout, osmtogeojson: converter,
    window: { withAppAssetVersion: url => `${url}?ver=test` },
    Conf: { osm: { bench: { tags: ['amenity=bench'] } } }, poiCont: { adata: [] }
});
vm.runInContext(fs.readFileSync('lib/overpasslib.js', 'utf8') + '\nthis.overPassCont = new OverPassControl();', context);
const control = context.overPassCont;
const data = { elements: Array.from({ length: 5000 }, (_, i) => ({
    type: 'node', id: i + 1, lon: 135, lat: 34, tags: { amenity: 'bench' }
})) };
(async () => {
    const text = JSON.stringify({ ...data, padding: ' '.repeat(1024 * 1024) });
    const parsed = await control.parseOverpassJsonAsync(text);
    assert.equal(parsed.elements.length, 5000);
    const geojson = await control.convertOsmJson(parsed);
    assert.deepEqual(geojson, converter(data, { flatProperties: true }));
    assert.deepEqual(tasks, ['parse', 'geojson']);
    assert.equal(terminated, 2, 'workers terminate after success');
    const first = await control.setOsmJson({ elements: data.elements.slice(0, 2) });
    const next = await control.setOsmJson({ elements: data.elements.slice(2, 3) });
    assert.equal(first.geojson.length, 2);
    assert.equal(next.geojson.length, 1, 'static imports return only the current batch');
    assert.equal(control.Cache.geojson.length, 3, 'earlier data remains cached');
    assert.equal(tasks.length, 2, 'small inputs avoid worker startup');
    await assert.rejects(control.parseOverpassJsonAsync('!'.repeat(1024 * 1024)),
        error => error.kind === 'invalid_json');
    assert.equal(terminated, 3, 'workers terminate after task failure');
    context.Worker = class { constructor() { throw new Error('blocked by CSP'); } };
    assert.equal((await control.convertOsmJson(data)).features.length, 5000);
    assert.equal((await control.parseOverpassJsonAsync(text)).elements.length, 5000);
    context.Worker = undefined;
    assert.equal((await control.convertOsmJson(data)).features.length, 5000);
    console.log('PASS: worker parsing/conversion, versioned URLs, small-input path, cleanup, fallback and static deltas');
})().catch(error => { console.error(error); process.exitCode = 1; });
