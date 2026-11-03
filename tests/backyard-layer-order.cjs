const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const config = { osm: { restricted_area: { expression: { beforeLayer: 'area_label-text' } }, area_label: {}, fallback_label: {} } };
const context = vm.createContext({ Conf: { osm: config.osm } });
vm.runInContext(fs.readFileSync('lib/maplib.js', 'utf8') + '\nthis.lib = new Maplibre();', context);
for (const useConfiguredAnchor of [true, false]) {
    const layers = [
        { id: 'background', type: 'background' },
        { id: 'road', type: 'line' },
        { id: 'opaque-land', type: 'fill' },
        { id: 'buildings', type: 'fill-extrusion' },
        { id: useConfiguredAnchor ? 'area_label-text' : 'fallback_label-text',
            source: useConfiguredAnchor ? 'area_label' : 'fallback_label', type: 'symbol' },
        { id: 'restricted_area-lines', type: 'line' },
        { id: 'restricted_area-fills', type: 'fill' }
    ];
    context.lib.map = {
        getStyle: () => ({ layers }), getLayer: id => layers.find(l => l.id === id),
        moveLayer(id, before) {
            const [layer] = layers.splice(layers.findIndex(l => l.id === id), 1);
            layers.splice(before ? layers.findIndex(l => l.id === before) : layers.length, 0, layer);
        }
    };
    context.lib.moveAreaBehindFeatures('restricted_area');
    const fill = layers.findIndex(l => l.id === 'restricted_area-fills');
    assert(fill > layers.findIndex(l => l.id === 'opaque-land'));
    assert(fill > layers.findIndex(l => l.id === 'buildings'));
    assert(fill < layers.findIndex(l => l.type === 'symbol'));
}
console.log('PASS: backyard remains above opaque base layers and below area names, including fallback label anchor');
