const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const bounds = {NW:{lng:0,lat:10},SE:{lng:10,lat:0}}, zoom = 17;
function element(tag='div') {
    const node = {tagName:tag,children:[],dataset:{},attributes:{},scrollTop:0,
        classList:{add(){},toggle(){}},addEventListener(){},
        setAttribute(k,v){this.attributes[k]=v;},
        appendChild(child){if(child.parent)child.parent.children=child.parent.children.filter(v=>v!==child);child.parent=this;this.children.push(child);},
        prepend(child){this.children.unshift(child);},
        contains(child){return this.children.includes(child)||this.children.some(v=>v.contains?.(child));}};
    Object.defineProperty(node,'innerHTML',{set(){this.children=[];this.scrollTop=0;}});
    return node;
}
const listArea=element(), statuses=new Map(), options=[];
let rows = [];
const context=vm.createContext({
    console:{log(){}}, Conf:{listTable:{category:'tags',target:'targets',allActs:false},
        list:{columns:{poiFields:['id','name','#category'],actFields:['id'],style:[{},{}]}},
        osm:{amenity:{expression:{poiView:true}}},poiView:{poiZoom:{amenity:16},editZoom:{}},etc:{},selectItem:{}},
    window:{withAppAssetVersion:v=>v},glot:{lang:'en',get:key=>key},
    document:{getElementById:id=>id==='listArea'?listArea:null,querySelectorAll:()=>[],createElement:element},
    list_category:{value:'-'},list_keyword:{value:''},
    basic:{uniq:v=>v},winCont:{clearSelect(){options.length=0;},addSelect(id,label,value){options.push([label,value]);}},
    mapLibre:{get_LL:()=>bounds,getZoom:()=>zoom,map:{getLayer(){},getSource(){}}},
    cMapMaker:{levelModeActive:false,indoorLevel:'0',getPoiZoom:()=>16},
    poiStatusCont:{getRecord:id=>statuses.get(id)||{}},
    poiCont:{revision:1,pdata:{},adata:[],getTargets:()=>['amenity'],
        makeList(){return rows;},get_osmid:()=>({geojson:{properties:{}}}),get_actid(){}}
});
vm.runInContext(fs.readFileSync('lib/listtable.js','utf8')+'\nthis.table=new ListTable();',context);
const table=context.table;table.init();

rows = [
    ['node/cafe', 'Cafe original', 'Cafe', 'amenity=cafe', ['amenity'], 'cafe.png'],
    ['node/art', 'A&B Gallery', 'Art', 'tourism=artwork', ['amenity'], 'art.png']
];
context.list_category.value = 'tags,amenity.cafe';
context.window.areaSearchController = { decorateListItem() {}, shouldIncludeListRow: id => id === 'node/cafe' };
table.setAreaFilter(true);
context.cMapMaker.visitedFilterStatus = 'visited';
context.cMapMaker.favoriteFilter = true;
statuses.set('node/cafe', { visited: true, favorite: true });
statuses.set('node/art', { visited: false, favorite: false });
table.makeList(false);
table.filterByPoiStatus('visited', true, false);
const ids = () => Array.from(table.getFilterList(), row => row[0]);
assert.deepEqual(ids(), ['node/cafe']);
for (const mode of ['nearby', 'favorite', 'recent', 'changes']) {
    table.displayMode = mode;
    table.externalItems = [{type:'node',id:'external',name:'External'}];
    table.filterKeyword('A&B');
    assert.deepEqual(ids(), ['node/art'], 'search starts before category, area and personal filtering');
    assert.equal(table.getFlistCount(), 1, 'display mode cannot suppress a global search result');
    assert.equal(listArea.children[0].children[0].dataset.id, 'node/art');
    table.makeList(false);
    table.filterCategory(['tags','amenity.cafe'], false);
    table.filterByPoiStatus('visited', true, false);
    table.renderList();
    assert.deepEqual(ids(), ['node/art'], 'refresh and category updates retain global search');
    assert.equal(table.getFlistCount(), 1);
}
table.displayMode = 'favorite';
table.filterKeyword('');
assert.deepEqual(ids(), ['node/cafe'], 'clearing search restores category, area and personal conditions');
assert.equal(table.displayMode, 'favorite', 'search does not overwrite the saved display mode');
assert.equal(table.getFlistCount(), 1);
table.filterKeyword('no match');
assert.deepEqual(ids(), []);
assert.equal(table.getFlistCount(), 0);
assert.equal(listArea.children[0].textContent, 'discovery_noMatches');
table.filterKeyword('   ');
assert.deepEqual(ids(), ['node/cafe'], 'whitespace restores the original filters');
console.log('PASS: global list search bypasses category, area, personal and display filters; refresh, raw text, empty results and clear restore');

// Structured area lists also search the linker data before the facility filter.
context.Conf.list.views = { area: { source:'areaFeatureLinker', rowId:'areaId',
    columns:[{value:'areaId'},{value:'name'}], searchFields:['name'] } };
table.currentView = 'area';
context.poiCont.getCatnames = () => ['Cafe','','amenity=cafe',''];
context.poiCont.getIcon = () => 'cafe.png';
const cafe = {areaId:'node/cafe', name:'Cafe original', feature:{properties:{}}};
const art = {areaId:'node/art', name:'A&B Gallery', feature:{properties:{}}};
context.window.areaFeatureLinker = { records:[cafe,art] };
context.window.areaSearchController.listRecords = [cafe];
table.makeListArea = () => {};
table.filterKeyword('Gallery');
assert.deepEqual(ids(), ['node/art'], 'structured search bypasses the already filtered record provider');
table.makeList(false);
table.filterCategory(['tags','amenity.cafe'], false);
assert.deepEqual(ids(), ['node/art']);
table.filterKeyword('');
assert.deepEqual(ids(), ['node/cafe']);
console.log('PASS: structured area search uses all loaded records and restores its filtered provider');
