const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
process.env.TZ = 'UTC';
let now = new Date('2026-10-09T10:00:00Z'), regionCode = '27', fail = false, reviewDate = null, favoriteDate = null;
const values = new Map([
    ['test.baseline-at','2026-10-08T08:00:00.000Z'], ['test.baseline-date','2026-10-08'],
    ['test.last-checked-at','2026-10-08T08:00:00.000Z'], ['test.last-region','27']
]);
const storage = { getItem:k=>values.get(k) ?? null, setItem:(k,v)=>values.set(k,v) };
const calls = [];
const row = (id, code, date='2026-10-09T09:00:00Z') => ({type:'way',id,name:`Region ${code}`,tags:{leisure:'park'},lon:Number(code),lat:1,createdAt:'2026-10-01T00:00:00Z',date});
const context = {console, Date, URL, location:{href:'https://example.test/'}, window:{},
    Conf:{etc:{localSave:'places'}, activity:{authMode:'basic',url:'https://example.test/reviews'}},
    poiStatusCont:{getAllFavorite:()=>[['places.way/99',{}]]},
    turf:{bbox:f=>[Number(f.code),0,Number(f.code)+1,2],point:p=>p,booleanPointInPolygon:(p,f)=>p[0]===Number(f.code)} };
vm.createContext(context);
vm.runInContext(fs.readFileSync('lib/changecontroller.js','utf8')+'\nthis.Controller=ChangeController;',context);
const config={use:true,apiUrl:'https://example.test/osm',storageKeyPrefix:'test',reviews:{use:true},targets:[{id:'park',queries:[{tag_key:'leisure',tag_value:'park'}],notify:{regionalCreated:true,regionalUpdated:true,favoriteUpdated:true}}]};
function make(store=storage) {
 const c=new context.Controller(config,{storage:store,now:()=>now,fetch:async url=>{
    const p=new URL(url).searchParams;calls.push(['reviews',Object.fromEntries(p)]);
    if(fail)return {ok:false,status:503};
    const favorite=p.has('osmids'),code=p.get('bbox')?.split(',')[0];
    const updated=reviewDate ?? (now.getUTCDate()===9?'2026-10-09T09:20:00Z':'2026-10-10T09:20:00Z');
    return {ok:true,json:async()=>[{id:favorite?'review-fav':`review-${code}`,osmid:favorite?'way/99':`way/${code}`,created_at:'2026-10-01T00:00:00Z',updated_at:updated,longitude:favorite?0:Number(code),latitude:1}].filter(r=>Date.parse(r.updated_at)>=Date.parse(p.get('updated_since')))};
 }});
 c.region=async()=>({code:regionCode,name:`Region ${regionCode}`,feature:{code:regionCode}});
 c.query=async p=>{
    calls.push(['osm',p]);
    return p.mode==='objects'?[row(99,'0',favoriteDate ?? (now.getUTCDate()===9?'2026-10-09T09:15:00Z':'2026-10-10T09:15:00Z'))]:[row(Number(p.prefecture_code),p.prefecture_code,now.getUTCDate()===9?'2026-10-09T09:00:00Z':'2026-10-10T09:00:00Z')];
 };
 return c;
}
(async()=>{
 const osaka=make();assert.equal((await osaka.checkOnStartup()).state,'changes');
 assert.equal(values.get('test.last-checked-at.region.27'),'2026-10-09T10:00:00.000Z');
 assert.equal(values.get('test.last-checked-at.favorites'),'2026-10-09T10:00:00.000Z');
 const savedOsaka=values.get('test.last-results.region.27');
 regionCode='26';now=new Date('2026-10-09T11:00:00Z');
 const kyoto=make();assert.equal((await kyoto.checkOnStartup()).state,'changes');
 assert(kyoto.results.some(r=>r.kind==='regionalUpdated'&&r.item.id===26),'Kyoto 09:00 survives Osaka 10:00 success');
 assert.equal(values.get('test.last-checked-at.region.26'),'2026-10-09T11:00:00.000Z');
 assert.equal(values.get('test.last-checked-at.region.27'),'2026-10-09T10:00:00.000Z');
 assert.equal(values.get('test.last-checked-at.favorites'),'2026-10-09T10:00:00.000Z');
 assert.equal(calls.filter(([type,p])=>type==='osm'&&p.mode==='objects').length,1);
 assert.equal(calls.filter(([type,p])=>type==='reviews'&&p.osmids).length,1);
 assert.equal(kyoto.results.filter(r=>r.item.activityId==='review-fav').length,1);
 const beforeReturn=calls.length;regionCode='27';now=new Date('2026-10-09T11:30:00Z');
 const returned=make();assert.equal((await returned.checkOnStartup()).state,'already');
 assert.equal(calls.length,beforeReturn,'Osaka result cache survives a trip to Kyoto');
 assert.equal(values.get('test.last-results.region.27'),savedOsaka);
 assert(returned.results.some(r=>r.item.id===27));assert(!returned.results.some(r=>r.item.id===26));
 const favoriteBefore=values.get('test.last-results.favorites');
 now=new Date('2026-10-10T10:00:00Z');fail=true;
 const failed=make();assert.equal((await failed.checkOnStartup()).state,'error');
 assert.equal(values.get('test.last-checked-at.region.27'),'2026-10-09T10:00:00.000Z');
 assert.equal(values.get('test.last-checked-at.favorites'),'2026-10-09T10:00:00.000Z');
 assert.equal(values.get('test.last-results.favorites'),favoriteBefore);
 assert.equal(values.get('test.last-shown-date.region.27'),'2026-10-09');
 assert.equal(values.get('test.last-shown-date.favorites'),'2026-10-09');
 fail=false;assert.equal((await make().checkOnStartup()).state,'changes');
 assert.equal(values.get('test.last-checked-at.favorites'),'2026-10-10T10:00:00.000Z');
 // Regional success must not move the independent favorite cutoff forward.
 const separated=new Map([
    ['test.baseline-at','2026-10-08T08:00:00Z'],['test.last-checked-at','2026-10-08T08:00:00Z'],
    ['test.checkpoint-version','4'],['test.last-checked-at.region.27','2026-10-09T11:00:00Z'],
    ['test.last-checked-at.favorites','2026-10-09T10:00:00Z']
 ]);
 reviewDate='2026-10-09T10:30:00Z';favoriteDate=reviewDate;
 const separate=make({getItem:k=>separated.get(k)??null,setItem:(k,v)=>separated.set(k,v)});
 assert.equal((await separate.checkOnStartup()).state,'changes');
 assert(separate.results.some(r=>r.item.activityId==='review-fav'));
 assert(!separate.results.some(r=>r.item.activityId==='review-27'));
 assert(separate.results.some(r=>r.kind==='favoriteUpdated'&&r.item.id===99));
 reviewDate=null;favoriteDate=null;
 // Old global timestamps migrate only to the old region; unknown regions get a conservative window.
 const legacy=new Map([['test.last-checked-at','2026-10-09T10:00:00.000Z'],['test.last-region','27']]);
 regionCode='26';now=new Date('2026-10-09T11:00:00Z');
 const migrated=make({getItem:k=>legacy.get(k)??null,setItem:(k,v)=>legacy.set(k,v)});
 await migrated.checkOnStartup();
 assert(migrated.results.some(r=>r.kind.startsWith('regional')&&r.item.id===26));
 assert.equal(legacy.get('test.last-checked-at.region.27'),'2026-10-09T10:00:00.000Z');
 // Fresh installs retain the original baseline for every region, even after another region advances.
 const fresh=new Map();const freshStorage={getItem:k=>fresh.get(k)??null,setItem:(k,v)=>fresh.set(k,v)};
 now=new Date('2026-10-08T08:00:00Z');regionCode='27';assert.equal((await make(freshStorage).checkOnStartup()).state,'first');
 now=new Date('2026-10-09T10:00:00Z');await make(freshStorage).checkOnStartup();
 regionCode='26';now=new Date('2026-10-09T11:00:00Z');const firstKyoto=make(freshStorage);await firstKyoto.checkOnStartup();
 assert(firstKyoto.results.some(r=>r.kind==='regionalUpdated'&&r.item.id===26));
 assert.equal(fresh.get('test.baseline-at'),'2026-10-08T08:00:00.000Z');
 console.log('PASS: Osaka/Kyoto/Osaka checkpoints and caches, daily favorites, review failure retry and migration');
})().catch(e=>{console.error(e);process.exitCode=1});
