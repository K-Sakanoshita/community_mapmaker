const assert = require('assert');
const fs = require('fs');
const vm = require('vm');
const context = {
    console, URLSearchParams,
    Conf: { osm: {}, system: { OverPassServer: ['https://example.test/overpass'] } },
    poiCont: { adata: [] },
    osmtogeojson: json => ({ features: json.elements })
};
vm.createContext(context);
vm.runInContext(`${fs.readFileSync('lib/overpasslib.js', 'utf8')}\nglobalThis.overPassCont = new OverPassControl();`, context);
const controller = context.overPassCont;
const feature = id => ({ type: 'Feature', id, properties: { id }, geometry: { type: 'Point', coordinates: [135.52, 34.74] } });

(async () => {
    const requested = feature('node/1');
    const unrelated = feature('node/2');
    assert.strictEqual(controller.setCache({ features: [unrelated] }).geojson.length, 0);
    controller.fetchOverpass = async () => ({ elements: [requested, unrelated] });
    const loaded = await controller.getOsmIds(['node/1']);
    assert.deepStrictEqual(Array.from(loaded.geojson, f => f.id), ['node/1']);
    assert.strictEqual(loaded.targets.length, 1);

    // Activity-linked features are retained in regular cache updates as well.
    context.poiCont.adata = [{ osmid: 'node/2' }];
    const changed = controller.setCache({ features: [unrelated] });
    assert.deepStrictEqual(Array.from(changed.targets[0]), ['activity']);
    console.log('PASS: explicit OSM lookups and activity features survive category filtering');
})().catch(error => { console.error(error); process.exitCode = 1; });
