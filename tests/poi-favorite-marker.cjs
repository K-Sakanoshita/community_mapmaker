const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const colors = Object.fromEntries(['attention', 'green', 'middle', 'normal', 'visited']
    .map(type => [type, { fill: '#ffffff', stroke: '#888888' }]));
colors.favorite = { badgeColor: '#d14970' };
colors.hover = { enabled: false };
const sources = new Map();
const layers = new Map();
let sourceUpdates = 0;
let clonedGeometryVertices = 0;
const map = {
    getSource: id => sources.get(id),
    addSource: (id, options) => sources.set(id, {
        data: options.data, setData(data) { sourceUpdates++; this.data = data; }
    }),
    getLayer: id => layers.get(id),
    addLayer: layer => layers.set(layer.id, layer),
    on() {}
};
const poi = { geojson: {
    id: 'node/1', type: 'Feature', geometry: { type: 'Point', coordinates: [135, 34] },
    properties: { tags: { id: 'node/1', name: 'Test' } }
}, targets: ['park'], lnglat: [135, 34] };
let favorite = false;
let hasModel = false;
const context = vm.createContext({
    console, structuredClone: value => {
        if (value?.geometry) clonedGeometryVertices += value.geometry.coordinates.flat(Infinity).length;
        return structuredClone(value);
    },
    Conf: {
        activity: { targetName: 'activity' }, activities: {},
        indoor: { use: false }, map: { openNow: false }, etc: { reverseIcon: false },
        osm: { park: { expression: { poiView: true } } },
        poiView: { editZoom: {} },
        icon: { markerColors: colors, zoomSteps: {
            marker: { baseScale: 1, steps: [] }, shadow: { baseScale: 1, steps: [] }
        }, shadow: 1, attention: 1, green: 1, middle: 1, normal: 1, visited: 1,
        textViewZoom: 14, textSize: 12, textFont: ['Noto Sans'] }
    },
    PoiStatusIndex: { VISITED: 0, FAVORITE: 1, MEMO: 2 },
    poiStatusCont: { getValueByOSMID: () => [false, favorite, ''] },
    mapLibre: { map, getZoom: () => 18, get_LL: () => ({}) },
    geoCont: { checkInner: () => true },
    cMapMaker: { isPoiVisibleInLevelMode: () => true, getPoiZoom: () => 12 },
    feature3d: { sync() {}, hasModel: () => hasModel, placeBelowMarkerLayers() {} },
    glot: { lang: 'ja' }
});
vm.runInContext(fs.readFileSync('lib/poilib.js', 'utf8') + '\nthis.PoiCont = PoiCont;', context);
const controller = new context.PoiCont();
controller.getTargets = () => ['park'];
controller.get_osmid = () => poi;
controller.getActlistByOsmid = () => [];
controller.getOSMname = () => 'Test';
context.poiCont = controller;
controller.setPoi([['node/1']], false);
assert.equal(sources.has('marker-favorite'), false);
assert.equal(layers.has('marker-favorite'), false);
favorite = true;
controller.setPoi([['node/1']], false);
assert.equal(sources.get('marker-favorite').data.features.length, 1);
assert.equal(sources.get('marker-favorite').data.features[0].id, 'node/1');
assert.equal(layers.get('marker-bg-normal').paint['circle-color'], '#ffffff');
assert.equal(layers.get('marker-favorite').layout['text-field'], '♥');
assert.equal(layers.get('marker-favorite').paint['text-color'], '#d14970');
favorite = false;
controller.setPoi([['node/1']], false);
assert.equal(sources.get('marker-favorite').data.features.length, 0);
assert.equal([...layers.keys()].filter(id => id.startsWith('marker-favorite')).length, 1);
hasModel = true;
favorite = true;
controller.setPoi([['node/1']], false);
assert.equal(sources.get('marker-normal').data.features.length, 0, '3D objects still replace the ordinary marker');
assert.equal(sources.get('marker-favorite').data.features.length, 1, '3D objects retain their favorite badge');
assert.equal(sources.get('marker-favorite').data.features[0].id, 'node/1');
favorite = false;
controller.setPoi([['node/1']], false);
assert.equal(sources.get('marker-favorite').data.features.length, 0, 'unchecking a 3D favorite clears its badge');
hasModel = false;
favorite = true;
controller.setPoi([['node/1']], false);
assert.equal(sources.get('marker-normal').data.features.length, 1, 'icon fallback is restored');
assert.equal(sources.get('marker-favorite').data.features.length, 1, 'fallback does not duplicate the badge');
console.log('PASS: favorite badges on icons and 3D objects, uncheck, and model fallback');

// Existing generic configurations predate zoomSteps; retain their original sizes.
delete context.Conf.icon.zoomSteps;
layers.clear();
controller.setPoi([['node/1']], false);
assert.deepEqual(JSON.parse(JSON.stringify(layers.get('marker-bg-normal').paint['circle-radius'])),
    ['step', ['zoom'], 24, 16, 28.799999999999997, 17, 33.599999999999994]);
assert.deepEqual(JSON.parse(JSON.stringify(layers.get('marker-fg-normal').layout['icon-size'])),
    ['step', ['zoom'], 0.5, 16, 0.6, 17, 0.7]);
console.log('PASS: marker sizes remain compatible with configurations without zoomSteps');

const beforeIdentical = sourceUpdates;
controller.setPoi([['node/1']], false);
assert.equal(sourceUpdates, beforeIdentical, 'identical marker data is not resubmitted');
controller.setPoi([], false);
assert.equal(sources.get('marker-normal').data.features.length, 0, 'leaving the viewport clears markers');
controller.setPoi([['node/1']], false);
assert.equal(sources.get('marker-normal').data.features.length, 1, 'reentering the viewport restores markers');
sources.clear(); layers.clear();
controller.setPoi([['node/1']], false);
assert.equal(sources.get('marker-normal').data.features.length, 1, 'a replacement background style receives data');
poi.geojson.geometry = {type:'Polygon',coordinates:[Array.from({length:5000},()=>[135,34])]};
const polygon = poi.geojson.geometry;
const verticesBefore = clonedGeometryVertices;
controller.setPoi([['node/1']], false);
assert.equal(clonedGeometryVertices, verticesBefore, 'polygon vertices are never copied for a point marker');
assert.equal(poi.geojson.geometry, polygon, 'source geometry is preserved');
const marker = sources.get('marker-normal').data.features[0];
assert.equal(marker.geometry.type, 'Point');
assert.deepEqual(Array.from(marker.geometry.coordinates), [135,34]);
marker.properties.tags.name = 'Edited marker';
assert.equal(poi.geojson.properties.tags.name, 'Test', 'marker properties remain isolated from source data');
console.log('PASS: unchanged marker sources are skipped, viewport/style changes refresh them, and 5000-vertex polygons remain unmodified without a geometry copy');

// Shadow source filters nested OSM tags before rendering; the style must not
// try to read a top-level level value or convert a multi-level string again.
context.cMapMaker.parseIndoorLevels = value => String(value).split(';');
context.cMapMaker.formatIndoorLevel = value => String(value);
for (const level of ['1', '0;2', '0', '-1']) {
    poi.geojson.properties.tags.level = level;
    controller.setPoi([['node/1']], false);
    const expected = ['1', '0;2'].includes(level) ? 1 : 0;
    assert.equal(sources.get('marker-shadow').data.features.length, expected, level);
}
assert.equal(layers.get('marker-shadow').layout['icon-image'], 'circle_shadow.png');
console.log('PASS: upper-floor shadow rendering for nested tags and multiple levels; ground/basement excluded');

for (const [level, suffix] of [['0', ''], ['0.0', ''], ['1', '\n(1)'], ['-1', '\n(-1)'], ['0;2', '\n(0;2)']]) {
    poi.geojson.properties.tags.level = level;
    controller.setPoi([['node/1']], false);
    assert.equal(poi.geojson.properties.cmapmaker_name, 'Test' + suffix,
        'ground-floor labels are omitted while other floors remain: ' + level);
}
console.log('PASS: omit ground-only map labels, retain upper/basement/multi-floor labels');

// The all policy uses the current-view path rather than filtered list rows.
controller.getPois = () => ({ geojson: [poi.geojson], targets: [poi.targets], lnglat: [poi.lnglat] });
controller.setPoi(undefined, false);
assert.equal(sources.get('marker-normal').data.features.length, 1);
context.geoCont.checkInner = () => false;
controller.setPoi(undefined, false);
assert.equal(sources.get('marker-normal').data.features.length, 0, 'all still respects the viewport');
context.geoCont.checkInner = () => true;
context.cMapMaker.isPoiVisibleInLevelMode = () => false;
controller.setPoi(undefined, false);
assert.equal(sources.get('marker-normal').data.features.length, 0, 'all still respects the selected floor');
context.cMapMaker.isPoiVisibleInLevelMode = () => true;
context.mapLibre.getZoom = () => 1;
controller.setPoi(undefined, false);
assert.equal(sources.get('marker-normal').data.features.length, 0, 'all still respects zoom thresholds');
context.mapLibre.getZoom = () => 18;
controller.adata = [{ id: 'WP/1', osmid: 'node/1' }, { id: 'WP/2', osmid: 'node/1' }];
controller.getActlistByOsmid = () => controller.adata;
controller.setPoi(undefined, false);
const markerCount = [...sources].filter(([id]) => /^marker-(attention|green|middle|normal|visited)$/.test(id))
    .reduce((sum, [, source]) => sum + source.data.features.length, 0);
assert.equal(markerCount, 1, 'all emits one icon for a venue with multiple activities');
console.log('PASS: all markers retain viewport, floor and zoom limits and deduplicate venues');
