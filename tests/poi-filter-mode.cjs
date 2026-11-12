const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Stub = class {};
const context = vm.createContext({
    console: { log() {} }, window: { navigator: { language: 'ja' } },
    IndoorControl: Stub, Glottologist: Stub, Basic: Stub, PoiStatusCont: Stub,
    OverPassControl: Stub, Maplibre: Stub, GeoCont: Stub, ListTable: Stub, PoiCont: Stub,
    MapFeature3D: Stub, PlaygroundModelFactories: {}, GoogleSpreadSheet: Stub,
    HistoricalNewsController: Stub, NewsTicker: Stub, ChangeController: Stub,
    AreaFeatureLinker: Stub, AreaSearchController: Stub, ListActionButtons: Stub
});
vm.runInContext(fs.readFileSync('cmapmaker.js', 'utf8') +
    '\nthis.fixture = { maker: cMapMaker, poi: poiCont, list: listTable, map: mapLibre, area: areaSearchController, models: feature3d, geo: geoCont, news: newsTicker };', context);
const { maker, poi, list, map } = context.fixture;
context.Conf = { poiView: { poiZoom: { activity: 8, shop: 16 }, editZoom: {} },
    osm: { shop: { expression: { poiView: true } } },
    activity: { targetName: 'activity' }, etc: { editMode: false } };
poi.getTargets = () => ['shop', 'activity'];
map.getZoom = () => 17;
maker.getPoiZoom = target => context.Conf.poiView.poiZoom[target];
const rows = [['WP/729']];
let selected = ['お店・施設・メニュー'], markerRows = rows;
list.getSelCategory = () => selected;
list.getMarkerList = () => markerRows;
const calls = [];
poi.setPoi = (rows, actonly) => calls.push([rows, actonly]);
for (const mode of [undefined, 'filter', 'all']) {
    context.Conf.poiView.poiFilter = mode;
    for (const category of [['お店・施設・メニュー'], ['shop'], ['tags', 'shop.books'], ['-'], ['']]) {
        selected = category;
        maker.viewPoi(category);
        assert.deepEqual(calls.pop(), [mode === 'all' ? undefined : rows, false],
            `${mode}: category ${category} uses the selected marker policy`);
        markerRows = [];
        maker.viewPoi(category);
        assert.deepEqual(calls.pop(), [mode === 'all' ? undefined : markerRows, false],
            `${mode}: empty results only clear icons in filter mode`);
        markerRows = rows;
    }
}
assert.equal(calls.length, 0, 'each update renders markers once');
console.log('PASS: all/filter/default marker policies for activity, target, tag and automatic categories');

// Drive the actual change handler, without move events or a completed request.
context.list_keyword = { value: 'previous search' };
context.list_category = { value: 'お店・施設・メニュー' };
context.document = { getElementById: () => null };
context.location = { pathname: '/', hash: '' };
context.history = { replaceState() {} };
context.Conf.selectItem = {};
context.Conf.thumbnail = { use: false };
maker.withIndoorLevel = path => path;
maker.clearDatail = () => {};
maker.makeImages = () => {};
maker.viewArea = () => {};
context.fixture.area.renderSummary = () => {};
context.fixture.area.renderDisplayStatus = () => {};
context.fixture.models.sync = () => {};
context.fixture.geo.writePoiCircle = () => {};
map.map = { redraw() {} };
let renderCount = 0, fetchCount = 0, mapCount = 0;
list.makeList = () => {
    assert.equal(context.list_keyword.value, '', 'clear stale keyword before category filtering');
    markerRows = selected[0] === '-' ? rows : [['WP/selected']];
};
list.filterByPoiStatus = () => {};
list.renderList = () => { renderCount++; };
maker.updateView = () => { fetchCount++; return new Promise(() => {}); };
maker.showMapTitleWhenReady = () => {};
map.changeMap = () => { mapCount++; };
context.fixture.news.update = () => {};
for (const mode of ['filter', 'all']) {
    context.Conf.poiView.poiFilter = mode;
    for (const action of ['', undefined, 'ChangePoi']) {
        context.Conf.selectItem.action = action;
        for (const category of ['お店・施設・メニュー', '-']) {
            selected = [category];
            const before = renderCount, beforeFetch = fetchCount;
            maker.eventChangeCategory();
            assert.equal(renderCount, before + 1, 'selection renders immediately');
            assert.deepEqual(calls.pop(), [mode === 'all' ? undefined : markerRows, false]);
            assert.equal(fetchCount, beforeFetch + (action === 'ChangePoi' ? 1 : 0),
                'default category selection does not fetch; ChangePoi still refreshes data');
        }
    }
}
context.Conf.selectItem.action = 'ChangeMap';
const before = renderCount;
maker.eventChangeCategory();
assert.equal(mapCount, 1);
assert.equal(renderCount, before, 'background map selection keeps its original action');
console.log('PASS: category change updates list and markers immediately without movement or network completion');
