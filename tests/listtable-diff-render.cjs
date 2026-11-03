const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let created = 0, rowBuilds = 0, bounds = {NW:{lng:0,lat:10},SE:{lng:10,lat:0}}, zoom = 17;
function element(tag='div') {
    created++;
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
let rows=Array.from({length:1200},(_,i)=>['node/'+i,'Place '+i,'Bench','amenity=bench',['amenity'],'bench.png']);
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
        makeList(){rowBuilds++;return rows;},get_osmid:()=>({geojson:{properties:{}}}),get_actid(){}}
});
vm.runInContext(fs.readFileSync('lib/listtable.js','utf8')+'\nthis.table=new ListTable();',context);
const table=context.table;table.init();
table.makeList(false);table.renderList();listArea.scrollTop=250;
const original=listArea.children[0].children.slice(), count=created;
table.makeList(false);table.renderList();
assert.equal(rowBuilds,1,'identical data/viewport reuses formatted rows');
assert.equal(created,count,'identical visible content creates no DOM nodes');
assert.equal(listArea.scrollTop,250);
table.makeSelectList('tags');
assert.equal(options.length,1,'1200 POIs produce one category insertion');
statuses.set('node/5',{favorite:true});
table.renderList();
const changed=listArea.children[0].children;
assert.notEqual(changed[5],original[5],'changed status refreshes its card');
assert.equal(changed[4],original[4],'other cards retain their DOM nodes');
assert.equal(changed[5].children[2].attributes['aria-pressed'],'true');
assert.equal(listArea.scrollTop,250);
const afterStatus=created;
bounds={NW:{lng:1,lat:10},SE:{lng:10,lat:0}};
table.makeList(false);table.renderList();
assert.equal(rowBuilds,2,'panning recomputes viewport membership');
assert.equal(created,afterStatus,'unchanged viewport members retain cards after panning');
zoom=18;table.makeList(false);assert.equal(rowBuilds,3,'zoom changes rebuild rows');
context.cMapMaker.levelModeActive=true;context.cMapMaker.indoorLevel='1';
table.makeList(false);assert.equal(rowBuilds,4,'floor changes rebuild rows');
context.cMapMaker.indoorLevel='roof';table.makeList(false);assert.equal(rowBuilds,5);
rows=rows.map((row,i)=>i===7?[row[0],'Renamed',...row.slice(2)]:row);
context.poiCont.revision++;table.makeList(false);table.renderList();
assert.equal(rowBuilds,6,'data revisions rebuild rows');
assert.notEqual(listArea.children[0].children[7],original[7],'same-ID name changes refresh the card');
assert.equal(listArea.children[0].children[4],original[4]);
context.list_category.value='tags,amenity.bench';table.makeList(false);
assert.equal(rowBuilds,6,'category filtering reuses raw rows');
context.list_keyword.value='Renamed';table.makeList(false);table.renderList();
assert.equal(listArea.children[0].children.length,1,'keyword filtering is reapplied');
context.list_keyword.value='';table.makeList(false);table.renderList();
assert.equal(listArea.children[0].children.length,1200,'clearing the filter restores rows');
context.Conf.discovery={use:true};const previous=created;
table.renderList();assert(created>previous,'dedicated decorators retain the full render path');
console.log('PASS: 1200 rows: identical update creates 0 nodes; one status change replaces one card; viewport, zoom, floor, same-ID edits, categories and keywords stay current');

// Exercise the browser's scheduled path without relying on elapsed-time assertions.
const batches = new Map();
let timerId = 0;
context.setTimeout = callback => { batches.set(++timerId, callback); return timerId; };
context.clearTimeout = id => batches.delete(id);
const drain = () => {
    while (batches.size) {
        const [id, callback] = batches.entries().next().value;
        batches.delete(id);
        callback();
    }
};
context.Conf.discovery.use = false;
rows = rows.map((row, i) => [`node/new-${i}`, `New place ${i}`, ...row.slice(2)]);
context.poiCont.revision++;
table.makeList(false); table.renderList();
assert.equal(listArea.children[0].children.length, 100, 'first batch is bounded');
assert.equal(table.getFilterList().length, 1200, 'batching never truncates filtered data');
assert.equal(listArea.attributes['aria-busy'], 'true');
const firstBatch = listArea.children[0].children[0];
table.renderList();
assert.equal(batches.size, 1, 'identical updates retain the pending render');
assert.equal(listArea.children[0].children[0], firstBatch);
const staleCallback = batches.values().next().value;
context.list_keyword.value = 'New place 1199';
table.makeList(false); table.renderList();
assert.equal(listArea.children[0].children.length, 1);
staleCallback(); drain();
assert.equal(listArea.children[0].children.length, 1, 'old batches cannot overwrite a new filter');
assert.equal(listArea.children[0].children[0].dataset.id, 'node/new-1199');
context.list_keyword.value = '';
table.makeList(false); table.renderList();
listArea.scrollTop = 700;
drain();
assert.equal(listArea.children[0].children.length, 1200, 'every row appears in order');
assert.equal(listArea.children[0].children[1199].dataset.id, 'node/new-1199');
assert.equal(listArea.scrollTop, 700, 'later batches respect user scrolling');
assert.equal(listArea.attributes['aria-busy'], 'false');
const finishedRows = listArea.children[0].children.slice();
statuses.set('node/new-1100', { favorite: true });
table.renderList();
assert.equal(batches.size, 0, 'small changes reuse cached rows synchronously');
assert.equal(listArea.children[0].children[1099], finishedRows[1099]);
assert.notEqual(listArea.children[0].children[1100], finishedRows[1100]);
console.log('PASS: large lists yield between batches, preserve all rows, cancel stale renders and respect scrolling');
