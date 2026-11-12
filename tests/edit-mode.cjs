const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const logs = [];
const config = {
    map: { detailZoom: 17 }, static: { use: true }, etc: { editMode: false },
    poiView: { poiZoom: { activity: 8, ordinary: 16 }, editZoom: { editable: 14 } },
    activity: { targetName: 'activity' },
    listTable: { category: 'activity', target: 'activity', allActs: true },
    list: { columns: { actFields: ['id', '#name', 'title'], poiFields: ['id', 'name', 'title'] } },
    osm: { ordinary: { expression: { poiView: true } }, editable: { expression: { poiView: true } } }
};
let zoom = 15;
const context = vm.createContext({
    console: { log: (...args) => logs.push(args), warn() {} }, Conf: config,
    geoCont: { flat2single: coordinates => coordinates, ll2tile: () => ({ tileX: 0, tileY: 0 }),
        checkInner: () => true, checkFeatureInner: () => true },
    mapLibre: { getZoom: () => zoom, get_LL: () => ({}) },
    cMapMaker: { isPoiVisibleInLevelMode: () => true, getPoiZoom: target => config.poiView.poiZoom[target] },
    glot: { lang: 'ja' }, window: {},
    document: { getElementById: () => ({ addEventListener() {} }) },
    list_category: { value: '' }, list_keyword: { value: '' }
});
vm.runInContext(fs.readFileSync('lib/poilib.js', 'utf8') + '\nthis.Controller = PoiCont;', context);
const poi = context.poiCont = new context.Controller();
poi.getCatnames = () => ['施設', '', 'amenity=cafe', ''];
poi.getIcon = () => 'cafe.png';
const feature = (id, name, x = 135) => ({ type: 'Feature', id, properties: { id, name },
    geometry: { type: 'Point', coordinates: [x, 34] } });
const add = (features, source) => poi.addGeojson({ geojson: features, targets: features.map(() => ['editable']) }, { source });
add([feature('node/1', 'Static')], 'static');
add([feature('node/1', 'Updated', 136), feature('node/2', 'Dynamic')]);
poi.setActdata([{ id: 'WP/1', osmid: 'node/1', title: 'Registered' },
    { id: 'WP/2', osmid: 'node/2', title: 'Missing static' },
    { id: 'WP/3', osmid: 'node/3', title: 'Not loaded' }]);
assert.equal(poi.get_osmid('node/1').geojson.properties.name, 'Static');
assert.equal(poi.get_osmid('node/1').lnglat[0], 135, 'browse retains static coordinates');
assert.equal(poi.get_osmid('node/2'), undefined);
assert.equal(poi.getPois('-').geojson.length, 1);
let rows = poi.makeList(['activity'], false);
assert.deepEqual(Array.from(rows, row => row[0]), ['WP/1']);
assert.equal(logs.filter(args => String(args[0]).includes('absent from static')).length, 2);
poi.makeList(['activity'], false);
assert.equal(logs.filter(args => String(args[0]).includes('absent from static')).length, 2, 'logs are deduplicated');
config.etc.editMode = true;
assert.equal(poi.get_osmid('node/1').geojson.properties.name, 'Updated');
add([feature('node/4', 'Unregistered')]);
rows = poi.makeList(['activity', 'editable'], false);
assert.deepEqual(Array.from(rows, row => row[0]), ['WP/1', 'WP/2', 'node/4']);
assert.equal(rows.find(row => row[0] === 'node/4')[1], 'Unregistered', 'activity list uses OSM names for editing candidates');
context.geoCont.checkFeatureInner = () => false;
assert.equal(poi.makeList(['activity', 'editable'], true).some(row => row[0] === 'node/4'), false,
    'allActs does not include off-screen unregistered editing candidates');
context.geoCont.checkFeatureInner = () => true;
zoom = 13;
assert.equal(poi.makeList(['editable'], false).length, 0, 'editing candidates respect editZoom');
zoom = 15;
config.etc.editMode = false;
assert.equal(poi.makeList(['editable'], false).length, 0, 'editZoom cannot activate an edit-only target in browse mode');
assert.equal(poi.getPois('-').geojson.length, 1, 'dynamic features disappear on return to browse');

// Keyword search precedes map extent, zoom and floor filters, but respects static mode.
zoom = 2;
context.cMapMaker.isPoiVisibleInLevelMode = () => false;
context.geoCont.checkInner = () => false;
assert.equal(poi.makeList(['activity'], false).length, 0);
assert.deepEqual(Array.from(poi.makeList(['activity'], false, {searchAll:true}), row => row[0]), ['WP/1'],
    'search includes off-screen/other-floor registrations, excluding unavailable static features');
zoom = 15;
context.cMapMaker.isPoiVisibleInLevelMode = () => true;
context.geoCont.checkInner = () => true;

// Exercise the actual list target selection and row cache across mode changes.
config.etc.editMode = true;
vm.runInContext(fs.readFileSync('lib/listtable.js', 'utf8') + '\nthis.Table = ListTable;', context);
const table = new context.Table();
table.init();
table.makeList(false);
assert.ok(table.getFilterList().some(row => row[0] === 'node/4'));
config.etc.editMode = false;
table.makeList(false);
assert.deepEqual(Array.from(table.getFilterList(), row => row[0]), ['WP/1']);

// Static browsing must not send a request, while static editing does.
const overContext = vm.createContext({ console: { log() {} }, URLSearchParams, performance,
    Conf: { ...config, system: { OverPassServer: ['https://overpass.test'], NoChacheServer: 'https://overpass.test' } },
    mapLibre: { get_LL: () => ({ NW: { lng: 0, lat: 1 }, SE: { lng: 1, lat: 0 } }),
        getCenter: () => ({ lng: .5, lat: .5 }), getZoom: () => 15 },
    geoCont: { ll2tile: () => ({ tileX: 0, tileY: 0 }), tile2ll: () => ({ lng: 0, lat: 1 }) }
});
overContext.Conf.osm.editable.overpass = ['node["amenity"]'];
vm.runInContext(fs.readFileSync('lib/overpasslib.js', 'utf8') + '\nthis.Controller = OverPassControl;', overContext);
const over = overContext.overPassCont = new overContext.Controller();
let calls = 0;
over.fetchOverpass = async () => { calls++; return { elements: [] }; };
(async () => {
    assert.equal(await poi.select('WP/2', true), false, 'missing static selection does not fetch or open a detail');
    await over.getGeojson(['editable']);
    assert.equal(calls, 0);
    config.etc.editMode = true;
    await over.getGeojson(['editable']);
    assert.equal(calls, 1);
    await over.getGeojson(['editable']);
    assert.equal(calls, 1, 'editing reuses the viewport cache');
    config.etc.editMode = false;
    await over.getGeojson(['ordinary']);
    assert.equal(calls, 1, 'return to browse never fetches a new target');
    console.log('PASS: edit mode data provenance, static fallback, missing logs, list rows and Overpass routing');
})().catch(error => { console.error(error); process.exitCode = 1; });
