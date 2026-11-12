const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync(path.join(root, 'lib/vendor/turf.min.js'), 'utf8'), context);
const { turf } = context;
const plain = value => JSON.parse(JSON.stringify(value));
assert.deepEqual(Object.keys(turf).sort(), ['area', 'bbox', 'bboxPolygon', 'booleanIntersects',
    'booleanPointInPolygon', 'buffer', 'point', 'polygon'].sort());
const outer = [[0, 0], [4, 0], [4, 4], [0, 4], [0, 0]];
const hole = [[1, 1], [1, 3], [3, 3], [3, 1], [1, 1]];
const polygon = turf.polygon([outer, hole], { name: 'park' });
assert.equal(polygon.properties.name, 'park');
assert.deepEqual(plain(turf.bbox(polygon)), [0, 0, 4, 4]);
assert.equal(turf.booleanPointInPolygon(turf.point([0.5, 0.5]), polygon), true);
assert.equal(turf.booleanPointInPolygon(turf.point([2, 2]), polygon), false);
assert.equal(turf.booleanPointInPolygon(turf.point([5, 5]), polygon), false);
assert.equal(turf.booleanPointInPolygon(turf.point([0, 2]), polygon), true);
assert.equal(turf.booleanPointInPolygon(turf.point([0, 2]), polygon, { ignoreBoundary: true }), false);
const multi = { type: 'Feature', properties: {}, geometry: {
    type: 'MultiPolygon', coordinates: [[outer], [[[10, 10], [11, 10], [11, 11], [10, 11], [10, 10]]]]
} };
assert.equal(turf.booleanPointInPolygon(turf.point([10.5, 10.5]), multi), true);
assert.equal(turf.booleanIntersects(polygon, turf.bboxPolygon([3.5, 3.5, 5, 5])), true);
assert.equal(turf.booleanIntersects(polygon, turf.bboxPolygon([1.5, 1.5, 2.5, 2.5])), false);
assert.equal(turf.booleanIntersects(polygon, turf.bboxPolygon([4, 0, 5, 1])), true);
assert.equal(turf.booleanIntersects(polygon, turf.bboxPolygon([5, 5, 6, 6])), false);
assert.deepEqual(plain(turf.bbox({ type: 'FeatureCollection', features: [polygon, multi] })), [0, 0, 11, 11]);
assert.ok(turf.area(polygon) > 0 && turf.area(polygon) < turf.area(turf.polygon([outer])));

// Actual map consumers, using the real library rather than geometry test doubles.
vm.runInContext(fs.readFileSync(path.join(root, 'lib/geolib.js'), 'utf8')
    + '\nthis.geo = new GeoCont();', context);
assert.equal(context.geo.checkFeatureInner(polygon, [0.5, 0.5], {
    NW: { lng: 3.5, lat: 5 }, SE: { lng: 5, lat: 3.5 }
}), true); // A park remains visible when its representative point is offscreen.
assert.equal(context.geo.checkFeatureInner(polygon, [0.5, 0.5], {
    NW: { lng: 5, lat: 6 }, SE: { lng: 6, lat: 5 }
}), false);
vm.runInContext(fs.readFileSync(path.join(root, 'lib/maplib.js'), 'utf8')
    + '\nthis.maplib = new Maplibre();', context);
assert.deepEqual(plain(context.maplib.getIndoorOverlayAnchor({ features: [polygon] })), [2, 2]);
const line = { type: 'Feature', id: 'way/1', properties: { barrier: 'wall' }, geometry: {
    type: 'LineString', coordinates: [[135, 34], [135.001, 34]]
} };
const data = { type: 'FeatureCollection', features: [line] };
const options = { width: 0.4, height: 2 };
const result = context.maplib.buildLinearExtrusionData(data, 'walls', options);
assert.equal(result.features.length, 1);
assert.equal(result.features[0].geometry.type, 'Polygon');
assert.equal(result.features[0].properties._linearHeight, 2);
const extent = turf.bbox(result);
assert.ok(extent[0] < 135 && extent[2] > 135.001 && extent[1] < 34 && extent[3] > 34);
assert.ok(extent[3] - extent[1] > 0.000003 && extent[3] - extent[1] < 0.000005);
const second = context.maplib.buildLinearExtrusionData(data, 'walls', options);
assert.equal(second.features[0].geometry, result.features[0].geometry);
assert.equal(line.geometry.type, 'LineString');

// Guard against adding new Turf calls without including the corresponding export.
for (const dir of ['lib', 'detail']) {
    for (const name of fs.readdirSync(path.join(root, dir)).filter(name => name.endsWith('.js'))) {
        const source = fs.readFileSync(path.join(root, dir, name), 'utf8');
        for (const match of source.matchAll(/\bturf\.(\w+)\s*\(/g)) {
            assert.equal(typeof turf[match[1]], 'function', `${dir}/${name}: missing turf.${match[1]}`);
        }
    }
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest.json'), 'utf8'));
const scripts = manifest.scriptGroups.flatMap(group => group.scripts);
assert.ok(scripts.includes('./lib/vendor/turf.min.js'));
assert.ok(!scripts.some(src => src.includes('@turf/turf@')));
console.log('PASS: eight Turf exports, holes/boundaries/MultiPolygon, intersections, area, viewport, indoor anchor and real linear extrusion');
