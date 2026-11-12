const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const sources = new Map(), layers = new Map(), images = new Map(), handlers = new Map();
const map = {
    getSource: id => sources.get(id),
    addSource(id, options) { sources.set(id, { data: options.data, setData(data) { this.data = data; } }); },
    getLayer: id => layers.get(id), addLayer: layer => layers.set(layer.id, layer),
    hasImage: id => images.has(id), addImage: (id, image) => images.set(id, image),
    on(type, id, fn) { handlers.set(`${type}:${id}`, fn); },
    getZoom: () => 18, getCanvas: () => ({ style: {} })
};
const types = ['attention', 'green', 'middle', 'normal', 'visited'];
const poi = { geojson: { id: 'node/42', type: 'Feature',
    geometry: { type: 'Point', coordinates: [135, 34] }, properties: { tags: { id: 'node/42', name: 'Venue' } } },
    targets: ['park'], lnglat: [135, 34] };
let favorite = true, selected = [], photos = [];
const legend = { hidden: true, style: {} };
const context = vm.createContext({ console, structuredClone, Uint8Array,
    document: { getElementById: () => legend },
    Conf: { stampMarkers: { use: true, osmIds: ['way/42', 'relation/42', '42', 'node/420', 'node/042'] },
        activity: { targetName: 'activity' }, activities: {}, indoor: { use: false },
        map: { openNow: false, detailZoom: 17 }, etc: { reverseIcon: false },
        osm: { park: { expression: { poiView: true } } }, poiView: { editZoom: {} },
        icon: { ...Object.fromEntries(types.map(type => [type, 0.7])),
            markerColors: { ...Object.fromEntries(types.map(type => [type, { fill: '#fff', stroke: '#888888' }])), hover: { enabled: true, stroke: '#000' } },
            zoomSteps: { marker: { baseScale: 0.5, steps: [{ zoom: 17, scale: 0.7 }] } },
            textViewZoom: 14, textSize: 12, textFont: ['Noto Sans'], photoMarkers: { use: true } } },
    PoiStatusIndex: { VISITED: 0, FAVORITE: 1, MEMO: 2 },
    poiStatusCont: { getValueByOSMID: () => [false, favorite, ''] },
    mapLibre: { map, getZoom: () => 18, get_LL: () => ({}) },
    geoCont: { checkInner: () => true, flashPolygon() {}, writePoiCircle() {} },
    cMapMaker: { isPoiVisibleInLevelMode: () => true, getPoiZoom: () => 12,
        viewDetail: id => { selected.push(id); return Promise.resolve(); } },
    feature3d: { sync() {}, hasModel: () => false, placeBelowMarkerLayers() {}, handleMarkerClick: () => false },
    PhotoMarkerController: class {
        constructor(map) { this.map = map; }
        static firstImage() { return 'https://example.test/photo.jpg'; }
        sync(items) { photos = items; }
    }, glot: { lang: 'ja' }
});
vm.runInContext(fs.readFileSync('lib/poilib.js', 'utf8') + '\nthis.PoiCont = PoiCont;', context);
const controller = new context.PoiCont();
controller.getTargets = () => ['park']; controller.get_osmid = id => id === poi.geojson.id ? poi : undefined;
controller.getActlistByOsmid = () => []; context.poiCont = controller;
const refresh = () => controller.setPoi([[poi.geojson.id]], false);
const feature = () => sources.get('marker-normal').data.features[0];
refresh();
assert.equal(feature().properties.cmapmaker_stamp, undefined, 'typed IDs must match exactly, without prefix/number collisions');
assert.equal(images.size, 0); assert.equal(photos[0].stamp, false);
context.Conf.stampMarkers.osmIds.push(' node/42 ');
refresh();
assert.equal(feature().properties.cmapmaker_stamp, true);
assert.equal(photos[0].stamp, true, 'photo and icon matching use the same ID');
assert.equal(photos[0].favorite, true);
assert.equal(feature().properties.cmapmaker_stamp_color, '#D65C8C');
assert.equal(sources.get('marker-favorite').data.features.length, 1);
assert.equal(images.size, 1); assert.equal(images.values().next().value.data.length, 32 * 32 * 4);
const badge = layers.get('marker-stamp-normal');
assert(badge.layout['icon-offset'].every(n => n < 0), 'badge stays top left');
assert(layers.get('marker-favorite').layout['text-offset'][0] > 0, 'heart stays right');
assert.equal(layers.get('marker-bg-normal').paint['circle-stroke-width'][2], 5);
assert.equal(layers.get('marker-bg-normal').paint['circle-stroke-width'][3], 2, 'unmatched border unchanged');
refresh(); assert.equal(images.size, 1, 'reuse badge image on redraw');
handlers.get('click:marker-stamp-normal')({ features: [{ properties: { id: 'node/42' } }], originalEvent: {} });
assert.deepEqual(selected, ['node/42'], 'badge click selects the normal POI');
controller.setPoi([], false);
assert.equal(sources.get('marker-normal').data.features.length, 0, 'filter hides badge with POI');
refresh(); assert.equal(feature().properties.cmapmaker_stamp, true, 'filter restore retains badge');
context.Conf.stampMarkers.ringColor = '#123456';
refresh(); assert.equal(feature().properties.cmapmaker_stamp_color, '#123456');
assert.equal(photos[0].stampColor, '#123456');
context.Conf.stampMarkers.ringColor = 'bad'; refresh();
assert.equal(feature().properties.cmapmaker_stamp_color, '#D65C8C', 'invalid colors fall back');
sources.clear(); layers.clear(); images.clear(); refresh();
assert(layers.has('marker-stamp-normal') && images.size === 1, 'style replacement restores source, badge and image');
for (const type of ['way', 'relation']) {
    poi.geojson.id = poi.geojson.properties.tags.id = `${type}/42`;
    refresh(); assert.equal(feature().properties.cmapmaker_stamp, true, `${type} ID supported`);
}
context.Conf.stampMarkers.use = false; refresh();
assert.equal(feature().properties.cmapmaker_stamp, undefined);
assert.equal(photos[0].stamp, false); assert.equal(legend.hidden, true);
const config = vm.runInNewContext('(' + fs.readFileSync('data/config-user.jsonc', 'utf8') + ')');
assert.equal(config.stampMarkers.use, false);
assert.equal(config.stampMarkers.osmIds.length, 0);
console.log('PASS: exact typed OSM IDs, generic disabled configuration, icon/photo decoration, favorites, filter/style restoration, config toggle and badge selection');
