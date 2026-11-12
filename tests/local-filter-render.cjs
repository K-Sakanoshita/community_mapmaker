const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const calls = [];
const stub = class {};
const context = { console, Date, window: {navigator:{language:'ja'}},
    Conf: {}, document:{getElementById:()=>null},
    IndoorControl:stub, Glottologist:stub, Basic:stub, PoiStatusCont:stub,
    OverPassControl:stub, Maplibre:stub, GeoCont:stub, PoiCont:stub,
    GoogleSpreadSheet:stub, NewsTicker:stub, HistoricalNewsController:stub,
    ChangeController:stub, AreaFeatureLinker:stub, ListActionButtons:stub,
    PlaygroundModelFactories: {}, MapFeature3D:class{sync(){calls.push(['models']);}},
    AreaSearchController:class{renderSummary(){calls.push(['summary']);}},
    ListTable:class{
        makeList(render){calls.push(['list',render]);}
        filterByPoiStatus(visit,favorite,render){calls.push(['filter',visit,favorite,render]);}
        renderList(){calls.push(['render']);}
        getSelCategory(){return ['tags','amenity.bench'];}
    }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('cmapmaker.js','utf8')+'\nthis.maker=cMapMaker;',context);
context.Conf={thumbnail:{use:true}};
const maker=context.maker;
maker.updateView=()=>{throw new Error('Personal filter must not fetch');};
maker.makeImages=()=>calls.push(['images']);maker.viewArea=()=>calls.push(['areas']);
maker.viewPoi=targets=>calls.push(['markers',...targets]);
maker.setVisitedFilter('unvisited');
assert.equal(maker.visitedFilterStatus,'unvisited');
assert.equal(calls.filter(call=>call[0]==='render').length,1);
assert.deepEqual(calls.find(call=>call[0]==='markers'),['markers','tags','amenity.bench']);
calls.length=0;maker.toggleFavoriteFilter(true);
assert.equal(maker.favoriteFilter,true);
assert.deepEqual(calls.find(call=>call[0]==='filter'),['filter','unvisited',true,false]);
assert.equal(calls.filter(call=>call[0]==='render').length,1);
console.log('PASS: personal filters redraw existing data once without updateView/network');

// Searching restores only the minimized list, preserving other selected sizes.
vm.runInContext('this.searchList = listTable; this.searchArea = areaSearchController;', context);
const queued = [], resized = [], searched = [];
context.setTimeout = callback => queued.push(callback);
context.winCont = { sidebarSize: 1, setSidebar: mode => resized.push(mode) };
context.searchList.filterKeyword = keyword => searched.push(keyword);
context.searchArea.renderDisplayStatus = () => {};
maker.changeMode = mode => assert.equal(mode, 'list');
for (const size of [1, 2, 3]) {
    context.winCont.sidebarSize = size;
    resized.length = 0;
    maker.searchKeyword('キッズゲルニカ');
    assert.deepEqual(resized, size === 1 ? ['list'] : [], 'only minimized lists return to normal size');
    assert.equal(queued.length, 1);
    queued.shift()();
    assert.equal(searched.at(-1), 'キッズゲルニカ');
}
const count = searched.length;
maker.searchKeyword(null);
assert.equal(queued.length, 0);
assert.equal(searched.length, count);
console.log('PASS: keyword search restores minimized lists and preserves normal/maximized sizes');

// Date buttons switch to events, filter immediately, and expand the list while retaining the map.
context.winCont.setSidebar = (mode, ratio) => resized.push([mode, ratio]);
context.Conf.eventDateFilter = { use: true, category: 'イベント' };
context.list_category = { value: 'アート展示' };
context.list_keyword = { value: 'old category keyword' };
context.searchList.getSelCategory = () => context.list_category.value.split(',');
vm.runInContext('geoCont.writePoiCircle = () => {};', context);
maker.clearDatail = () => {};
for (const size of [1, 2, 3]) {
    context.winCont.sidebarSize = size;
    resized.length = 0;
    calls.length = 0;
    maker.selectEventDate('2026-11-28');
    assert.equal(context.list_category.value, 'イベント');
    assert.equal(context.list_keyword.value, '');
    assert.equal(context.searchList.eventDate, '2026-11-28');
    assert.deepEqual(resized, [['list', 0.65]]);
    assert.deepEqual(calls.find(call => call[0] === 'markers'), ['markers', 'イベント']);
}
for (const size of [1, 2, 3]) {
    context.winCont.sidebarSize = size;
    context.list_category.value = 'イベント';
    context.list_keyword.value = 'old search';
    resized.length = 0;
    maker.selectEventDate('');
    assert.equal(context.searchList.eventDate, '');
    assert.equal(context.list_category.value, '', 'all offerings restores automatic category');
    assert.equal(context.list_keyword.value, '');
    assert.deepEqual(resized, [['list', 0.35]], 'all offerings restores standard list height');
}
context.Conf.eventDateFilter.use = false;
resized.length = 0;
maker.selectEventDate('2026-11-29');
assert.deepEqual(resized, []);
console.log('PASS: independent date actions switch category, update markers and expand from every list size');
