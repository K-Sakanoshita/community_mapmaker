const assert=require('node:assert/strict'), fs=require('node:fs'), vm=require('node:vm');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync('lib/mapillustrations.js','utf8')+'\nthis.Controller=MapIllustrations;',context);
const controller=new context.Controller({isMobile:()=>false});
let reads=0, before='marker-bg-normal';
const layers=new Map(), sources=new Map(), inserted=[];
controller.map={isStyleLoaded:()=>true,
    getStyle(){reads++;return {layers:[{id:'base'}, {id:before}]};},
    getLayer:id=>layers.get(id),getSource:id=>sources.get(id),
    addSource(id,source){sources.set(id,{...source,setCoordinates(coordinates){this.coordinates=coordinates;}});},
    addLayer(layer,beforeId){layers.set(layer.id,layer);inserted.push(beforeId);},
    getLayoutProperty:(id,key)=>layers.get(id).layout[key],
    setLayoutProperty:(id,key,value)=>{layers.get(id).layout[key]=value;}
};
controller.config={use:true};
controller.items=Array.from({length:9},(_,i)=>({layerId:'art-'+i,config:{bounds:[135,34,136,35]},
    image:{complete:true,naturalWidth:100,naturalHeight:100},textureUrl:'data:image/png;base64,test'}));
controller.render();assert.equal(reads,1,'nine illustrations share one style snapshot');
assert.equal(sources.size,9);assert(inserted.every(id=>id==='marker-bg-normal'));
for(const layer of layers.values())assert.equal(layer.layout.visibility,'visible');
controller.render();assert.equal(reads,2,'one snapshot per subsequent frame');assert.equal(inserted.length,9,'reuse existing layers');
// A style replacement must use its own layer order, not a stale cached snapshot.
before='marker-bg-attention';layers.clear();sources.clear();inserted.length=0;controller.render();
assert.equal(reads,3);assert(inserted.every(id=>id==='marker-bg-attention'));
controller.items[0].image.complete=false;controller.render();assert.equal(layers.get('art-0').layout.visibility,'none');
controller.config.use=false;controller.render();assert.equal(reads,4,'disabled illustrations skip style access');
console.log('PASS: one style read per render, geographic sources/visibility, layer reuse and style replacement');
