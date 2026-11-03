const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const calls={intersects:0,contains:0};
const bbox=feature=>{
 const values=feature.geometry.coordinates.flat(Infinity);
 const xs=values.filter((_,i)=>i%2===0),ys=values.filter((_,i)=>i%2);
 return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
};
const context=vm.createContext({
 Conf:{indoor:{use:true,defaultLevel:'0',levels:{discoverFromData:true},underground:{useWithoutBuilding:true,activationRadiusMeters:60},
    buildingGroup:{requireIndoorPoi:true,smallBuildingAreaSquareMeters:1500,groupRadiusMeters:50}},
    osm:{indoor:{expression:{renderTags:{line:{indoor:['room','area','corridor','wall']}}}}}},
 poiCont:{revision:1,isPoiViewVisible:targets=>targets.includes('amenity')},
 mapLibre:{getZoom:()=>18,map:{getBounds:()=>({getWest:()=>-1,getEast:()=>1,getSouth:()=>-1,getNorth:()=>1}),
    getCenter:()=>({lng:0,lat:0}),getContainer:()=>({clientHeight:900}),unproject:()=>({lat:.9})}},
 turf:{point:coordinates=>({geometry:{coordinates}}),area:f=>{const b=bbox(f);return (b[2]-b[0])*(b[3]-b[1])*111320**2;},
    booleanPointInPolygon:(p,f)=>{calls.contains++;const b=bbox(f),[x,y]=p.geometry.coordinates;return x>=b[0]&&x<=b[2]&&y>=b[1]&&y<=b[3];},
    booleanIntersects:(a,b)=>{calls.intersects++;const l=bbox(a),r=bbox(b);return l[0]<=r[2]&&l[2]>=r[0]&&l[1]<=r[3]&&l[3]>=r[1];}}
});
vm.runInContext(fs.readFileSync('lib/indoorlib.js','utf8')+'\nthis.control=new IndoorControl();',context);
const control=context.control;
const polygon=(id,tags,x=-.0001,y=-.0001,size=.0002)=>({id,type:'Feature',properties:tags,
 geometry:{type:'Polygon',coordinates:[[[x,y],[x+size,y],[x+size,y+size],[x,y+size],[x,y]]]}});
const building=polygon('building',{building:'yes','building:levels':'3'},-.01,-.01,.02);
const outdoor=Array.from({length:12000},(_,i)=>polygon('shop/'+i,{shop:'convenience'}));
const outdoorTargets=outdoor.map(()=>['amenity']);
assert.equal(control.getIndoorControlContext([building,...outdoor],[['indoor'],...outdoorTargets]),null);
assert.equal(calls.intersects,0,'12000 outdoor POIs cannot require building intersections without any layout');
assert.equal(calls.contains,0,'a missing layout rules out building activation before geometry work');
const room=polygon('room',{indoor:'room',level:'-1'});
assert.equal(control.getIndoorControlContext([...outdoor,room],[...outdoorTargets,['indoor']]),null);
assert.equal(calls.contains,0,'without underground POIs, no per-polygon distance computation is needed');
const underground={id:'underground',type:'Feature',properties:{amenity:'cafe',level:'-1'},
 geometry:{type:'Point',coordinates:[0,0]}};
const scenarios=[
 {features:[room,underground],targets:[['indoor'],['amenity']]},
 {features:[building,room,underground],targets:[['indoor'],['indoor'],['amenity']]},
 {features:[building,...outdoor],targets:[['indoor'],...outdoorTargets]}
];
const undergroundResult=control.getIndoorControlContext(scenarios[0].features,scenarios[0].targets);
assert.equal(undergroundResult.undergroundMode,true);
assert.deepEqual(Array.from(undergroundResult.availableLevels),['-1']);
const buildingResult=control.getIndoorControlContext(scenarios[1].features,scenarios[1].targets);
assert.equal(buildingResult.buildingId,'building');
assert(buildingResult.levels.includes('2'));
const outer=polygon('outer',{building:'yes','building:levels':'4'},-.02,-.02,.04);
calls.intersects=0;
const groupedFeatures=[building,outer,...outdoor.slice(0,300),room];
const groupedTargets=[['indoor'],['indoor'],...outdoorTargets.slice(0,300),['indoor']];
const selected=control.getIndoorControlContext(groupedFeatures,groupedTargets);
assert.equal(selected.buildingId,'outer','overlapping building selection keeps the larger outline');
assert(calls.intersects<400,'candidate selection stops at the first matching POI instead of materializing every building');
scenarios.push({features:groupedFeatures,targets:groupedTargets});
if(process.env.ORIGINAL_INDOOR_SOURCE){
 vm.runInContext(fs.readFileSync(process.env.ORIGINAL_INDOOR_SOURCE,'utf8').replace('class IndoorControl','class OriginalIndoorControl')+'\nthis.original=new OriginalIndoorControl();',context);
 for(const scenario of scenarios){
  assert.equal(JSON.stringify(control.getIndoorControlContext(scenario.features,scenario.targets)),
    JSON.stringify(context.original.getIndoorControlContext(scenario.features,scenario.targets)));
 }
 console.log('PASS: original and optimized building/underground contexts match');
}
let vertexReads=0;
const vertex=[0,0];Object.defineProperty(vertex,0,{get(){vertexReads++;return 0;}});
const shape={geometry:{type:'LineString',coordinates:[vertex,[1,1]]}};
control.getIndoorFeatureBounds(shape);const reads=vertexReads;
control.getIndoorFeatureBounds(shape);assert.equal(vertexReads,reads,'same geometry/revision reuses bounds');
context.poiCont.revision++;control.getIndoorFeatureBounds(shape);assert(vertexReads>reads,'a data revision recomputes geometry bounds');
shape.geometry.coordinates=[[2,2],[3,3]];
assert.deepEqual(Array.from(control.getIndoorFeatureBounds(shape)),[2,2,3,3],'replaced coordinates invalidate bounds');
vm.runInContext(fs.readFileSync('lib/maplib.js','utf8')+'\nthis.renderer=new Maplibre();',context);
const renderer=context.renderer;let submitted=0;
let source={setData(data){submitted++;this.data=data;}};
renderer.map={getSource:()=>source};renderer.getIndoorOverlayAnchor=()=>[0,0];
context.cMapMaker=control;control.getPoiZoom=()=>18;
control.indoorBuildingLevelRanges=new Map();
const above=polygon('upstairs',{indoor:'room',level:'1'});
const data={features:[room,above]};
renderer.addIndoor(data,'indoor','-1');assert.equal(submitted,1);
renderer.addIndoor(data,'indoor','-1');assert.equal(submitted,1,'same floor is not resubmitted');
renderer.addIndoor(data,'indoor','1');assert.equal(submitted,2,'floor switching updates its source');
context.poiCont.revision++;renderer.addIndoor(data,'indoor','1');assert.equal(submitted,3,'data edits update the floor source');
source={setData(){submitted++;}};renderer.addIndoor(data,'indoor','1');assert.equal(submitted,4,'new style source receives data');
console.log('PASS: outdoor-only 12000-feature context skips geometry predicates; underground/building activation, bounds invalidation and floor/style source refresh stay correct');
