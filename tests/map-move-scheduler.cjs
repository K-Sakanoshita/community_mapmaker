const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
function fixture(){
 let now=0,serial=0,moving=false,position='A',zoom=17,active=0,maxActive=0;
 const timers=new Map(),moveListeners=[],requests=[],activityCalls=[],accepted=[],rendered=[],categories=[];
 const Stub=class{};
 const context=vm.createContext({
  console:{log(){},info(){},warn(){}},Date:{now:()=>now},
  setTimeout(fn,delay=0){const id=++serial;timers.set(id,{fn,at:now+delay});return id;},
  clearTimeout:id=>timers.delete(id),requestAnimationFrame:fn=>fn(),
  window:{navigator:{language:'ja'}},IndoorControl:Stub,Glottologist:Stub,Basic:Stub,PoiStatusCont:Stub,
  OverPassControl:Stub,Maplibre:Stub,GeoCont:Stub,ListTable:Stub,PoiCont:Stub,MapFeature3D:Stub,
  PlaygroundModelFactories:{},GoogleSpreadSheet:Stub,HistoricalNewsController:Stub,NewsTicker:Stub,
  ChangeController:Stub,AreaFeatureLinker:Stub,AreaSearchController:Stub,ListActionButtons:Stub
 });
 vm.runInContext(fs.readFileSync('cmapmaker.js','utf8')+'\nthis.fixture={maker:cMapMaker,poi:poiCont,list:listTable,area:areaSearchController,models:feature3d,map:mapLibre};',context);
 const {maker,poi,list,area,models,map}=context.fixture;
 context.Conf={poiView:{poiZoom:{amenity:16},editZoom:{}},etc:{editMode:false},
  thumbnail:{use:false},listTable:{category:'tags'},changes:{}};
 map.map={isMoving:()=>moving,once:(event,fn)=>moveListeners.push(fn)};
 map.getZoom=()=>zoom;maker.status='normal';maker.getPoiZoom=()=>16;
 maker.usesActivityBbox=()=>false;maker.refreshChangeRegion=async()=>{};
 maker.loadActivitiesForView=async force=>{activityCalls.push({position,force,at:now});return true;};
 maker.makeImages=()=>{};maker.viewArea=()=>{};maker.viewPoi=()=>{};maker.viewIndoor=()=>{};
 area.syncSearch=async()=>{};area.renderSummary=()=>{};models.sync=()=>{};
 poi.addGeojson=data=>accepted.push(data.position);poi.setActlnglat=()=>{};
 list.getSelCategory=()=>[''];list.makeList=()=>{};list.makeSelectList=()=>{};
 list.selectCategory=value=>categories.push(Array.from(value));list.filterByPoiStatus=()=>{};
 list.renderList=()=>rendered.push(position);
 maker.updateOsmPoi=()=>{
  active++;maxActive=Math.max(maxActive,active);
  const entry={position,at:now};requests.push(entry);
  return new Promise((resolve,reject)=>{
   entry.finish=(success=true)=>{active--;resolve(success?{update:true,geojson:{position:entry.position}}:{update:false});};
   entry.fail=()=>{active--;reject(new Error('mock unavailable'));};
  });
 };
 const settle=async()=>{for(let i=0;i<18;i++)await Promise.resolve();};
 const tick=async ms=>{
  const target=now+ms;let steps=0;
  for(;;){
   const entry=[...timers].filter(([,v])=>v.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];
   if(!entry)break;if(++steps>1000)throw new Error('timer loop');
   timers.delete(entry[0]);now=entry[1].at;entry[1].fn();await settle();
  }
  now=target;await settle();
 };
 const start=()=>{moving=true;maker.eventStartMoveMap();};
 const end=(next,movingDuringEvent=false)=>{position=next;moving=movingDuringEvent;maker.eventMoveMap();moveListeners.splice(0).forEach(fn=>fn());};
 return {maker,requests,activityCalls,accepted,rendered,categories,start,end,tick,settle,
  maxActive:()=>maxActive,setZoom:value=>{zoom=value;},setMoving:value=>{moving=value;},context};
}
(async()=>{
 {
  const f=fixture();f.start();f.end('B',true);
  f.setMoving(false); // The handler finishes after dispatching moveend; no second event follows.
  await f.tick(300);
  assert.equal(f.requests.length,1,'moveend while isMoving is still true must not lose the update');
  assert.equal(f.requests[0].position,'B');
  f.requests[0].finish();await f.settle();assert.deepEqual(f.rendered,['B']);
 }
 {
  const f=fixture();f.end('B');f.setMoving(true);
  await f.tick(300);assert.equal(f.requests.length,0,'a moving map cannot start a fetch');
  f.setMoving(false);await f.tick(100);
  assert.equal(f.requests.length,1,'a transient moving flag at the deadline must be rechecked');
  f.requests[0].finish();await f.settle();assert.deepEqual(f.rendered,['B']);
 }
 {
  const f=fixture();f.end('A');await f.tick(150);f.start();f.end('B');
  await f.tick(150);f.start();f.end('C');await f.tick(299);
  assert.equal(f.requests.length,0,'short repeated moves send no intermediate request');
  await f.tick(1);assert.equal(f.requests.length,1);assert.equal(f.requests[0].position,'C');
  assert.equal(f.requests[0].at,600);f.requests[0].finish();await f.settle();
 }
 {
  const f=fixture();f.end('A');await f.tick(300);
  f.start();f.end('B');await f.tick(100);f.start();f.end('C');await f.tick(50);
  f.requests[0].finish();await f.settle();
  assert.deepEqual(f.accepted,['A'],'old response still enters POI storage');
  assert.deepEqual(f.rendered,[],'old view is not rendered while a move is pending');
  await f.tick(249);assert.equal(f.requests.length,1);
  await f.tick(1);assert.equal(f.requests[1].position,'C');
  assert.equal(f.requests[1].at,700,'wait only until 300ms after the last moveend');
  f.requests[1].finish();await f.settle();
  assert.deepEqual(f.rendered,['C']);assert.equal(f.maxActive(),1);
  assert.deepEqual(f.activityCalls.map(x=>x.position),['A','C'],'Activity API follows the same scheduling');
 }
 {
  const f=fixture();f.end('A');await f.tick(300);f.start();f.end('B');
  await f.tick(500);f.requests[0].finish();await f.settle();await f.tick(0);
  assert.equal(f.requests[1].at,800,'already quiet views do not wait an extra 300ms after completion');
  f.requests[1].finish();await f.settle();
 }
 {
  const f=fixture();f.end('A');await f.tick(300);f.start();
  f.requests[0].finish();await f.settle();await f.tick(1000);
  assert.equal(f.requests.length,1,'completion during an ongoing drag cannot send another request');
  f.end('D');await f.settle();await f.tick(299);assert.equal(f.requests.length,1);
  await f.tick(1);assert.equal(f.requests[1].position,'D');
  f.requests[1].finish();await f.settle();assert.deepEqual(f.accepted,['A','D']);
 }
 {
  const f=fixture();f.end('A');await f.tick(300);f.start();f.end('B');
  f.requests[0].fail();await f.settle();await f.tick(300);
  assert.equal(f.requests[1].position,'B','a failed fetch releases the slot for the latest position');
  f.requests[1].finish();await f.settle();assert.equal(f.maker.moveMapBusy,false);
 }
 {
  const f=fixture();const initial=f.maker.updateView('initial');await f.settle();
  assert.equal(f.requests[0].at,0,'initial and explicit updates bypass move debounce');
  f.end('B');const first=f.maker.updateView('first'),last=f.maker.updateView('last');
  f.requests[0].finish();await f.settle();
  assert.equal(f.requests.length,2,'multiple explicit updates queue only one follow-up');
  assert.equal(f.maxActive(),1);assert.equal(f.requests[1].at,0);
  f.requests[1].finish();await Promise.all([initial,first,last]);await f.tick(1000);
  assert.equal(f.requests.length,2,'the explicit follow-up consumes any pending move');
  assert.deepEqual(f.categories.at(-1),['last']);
 }
 {
  const f=fixture();f.end('A');await f.tick(100);
  const explicit=f.maker.updateView();await f.settle();assert.equal(f.requests[0].at,100);
  f.requests[0].finish();await explicit;await f.tick(300);
  assert.equal(f.requests.length,1,'an explicit update cancels the unsent move timer');
 }
 {
  const f=fixture();f.maker.usesActivityBbox=()=>true;
  const initial=f.maker.updateView();await f.settle();
  const reload=f.maker.reloadActivitiesForView();
  assert.equal(f.activityCalls.filter(x=>x.force===true).length,0,'forced API reload waits for the active update');
  f.requests[0].finish();await f.settle();
  assert.equal(f.activityCalls.filter(x=>x.force===true).length,1);
  assert.equal(f.maxActive(),1);f.requests[1].finish();await Promise.all([initial,reload]);
 }
 {
  const f=fixture();f.setZoom(10);f.end('A');await f.tick(300);
  assert.equal(f.requests.length,0,'below-threshold local refresh does not fetch');
  assert.equal(f.maker.moveMapBusy,false);
  f.setZoom(17);f.end('B');f.maker.status='initialize';await f.tick(300);
  assert.equal(f.requests.length,0,'a stale timer cannot fetch after leaving normal mode');
 }
 console.log('PASS: 300ms move coalescing, latest-only in-flight follow-up, drag/quiet deadlines, response retention, failure recovery, serialized explicit/forced updates and low-zoom guards');
})().catch(error=>{console.error(error);process.exitCode=1;});
