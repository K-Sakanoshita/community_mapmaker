const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let now = new Date('2026-10-08T00:00:00Z'), calls = 0, failReviews = false;
const values = new Map();
const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
const context = { Date, URL, console, location: {href:'https://example.test/'},
    Conf:{etc:{localSave:'sample'},activity:{authMode:'basic',url:'https://example.test/reviews'}},
    turf:{bbox:()=>[135,34,136,35],point:x=>x,booleanPointInPolygon:()=>true},
    poiStatusCont:{getAllFavorite:()=>[]},window:{} };
vm.createContext(context);
vm.runInContext(fs.readFileSync('lib/changecontroller.js','utf8')+'\nthis.Controller=ChangeController', context);
const config = {use:true,apiUrl:'https://example.test/osm',storageKeyPrefix:'sample',reviews:{use:true},targets:[]};
const make = (store = storage) => {
    const controller = new context.Controller(config,{storage:store,now:()=>now,fetch:async url=>{
        calls++;
        if (failReviews) return {ok:false,status:503};
        return {ok:true,json:async()=>[{id:'Cinema/1',osmid:'way/1',name:'Cinema A',
            created_at:'2026-10-01T00:00:00Z',updated_at:'2026-10-08T12:00:00Z',latitude:34.7,longitude:135.5}].filter(row=>Date.parse(row.updated_at)>=Date.parse(new URL(url).searchParams.get('updated_since')))};
    }});
    controller.region=async()=>({code:'27',name:'Region',feature:{}});
    controller.collect=async since=>{calls++;controller.results=[
        {kind:'regionalUpdated',target:{id:'cinema',label:'Cinema'},item:{osmid:'way/2',lon:135.5,lat:34.7,date:'2026-10-07T00:00:00Z'}},
        {kind:'regionalUpdated',target:{id:'cinema',label:'Cinema'},item:{osmid:'way/3',lon:135.5,lat:34.7,date:'2026-10-08T12:00:00Z'}}
    ].filter(result=>controller.timestamp(result.item.date)>since);return controller.results;};
    return controller;
};
(async()=>{
    const first=make();
    assert.equal((await first.checkOnStartup()).state,'first');
    assert.equal(calls,0,'first visit establishes a baseline without requesting past changes');
    assert.equal(values.get('sample.last-checked-at'),now.toISOString());
    assert.equal((await make().checkOnStartup()).state,'first','same-day reload stays a first visit');
    await first.loadInitialHistory();
    assert.equal(first.results.length,3,'manual opening can show historical OSM and review updates');
    assert.equal(values.get('sample.last-checked-at'),now.toISOString(),'manual history never advances baseline');
    assert.equal(first.initialVisit,true,'manual history never enables automatic display');
    now=new Date('2026-10-09T00:00:00Z');
    const returned=make();
    const updates=await returned.checkOnStartup();
    assert.equal(updates.state,'changes');
    assert.equal(updates.results.length,2,'old OSM updates are excluded, new reviews retained');
    assert.equal(values.get('sample.last-checked-at.region.27'),now.toISOString());
    assert.equal(returned.tickerItems().find(item=>item.activityId).name,'Cinema A');
    const beforeCache=calls;
    assert.equal((await make().checkOnStartup()).state,'already');
    assert.equal(calls,beforeCache,'same-day repeat uses cached differential results');
    now=new Date('2026-10-10T00:00:00Z');failReviews=true;
    const failed=make();
    assert.equal((await failed.checkOnStartup()).state,'error');
    assert.equal(failed.results.length,0,'partial failures must not consume automatic notification day');
    assert.equal(values.get('sample.last-checked-at.region.27'),'2026-10-09T00:00:00.000Z','review failure cannot advance successful checkpoint');
    assert.equal(values.get('sample.last-shown-date.region.27'),'2026-10-09');
    failReviews=false;
    assert.equal((await make().checkOnStartup()).state,'empty','no updates after checkpoint');
    const manualFailure=make({getItem:()=>null,setItem:()=>{}});
    await manualFailure.checkOnStartup();failReviews=true;
    await assert.doesNotReject(()=>manualFailure.loadInitialHistory());
    assert.equal(manualFailure.results.length,0);
    assert.equal(manualFailure.initialHistoryLoaded,false,'failed manual history remains retryable');
    failReviews=false;await manualFailure.loadInitialHistory();
    assert.equal(manualFailure.initialHistoryLoaded,true);
    const blocked=make({getItem(){throw Error('Denied');},setItem(){throw Error('Denied');}});
    assert.equal((await blocked.checkOnStartup()).state,'first','storage rejection keeps first-visit behavior safe');
    const noRegion=make({getItem:()=>null,setItem:()=>{}});noRegion.region=async()=>{throw Error('Unavailable');};
    assert.equal((await noRegion.checkOnStartup()).state,'first','initial guide does not depend on region API');
    const generic=make();generic.config={...config,reviews:{use:true,placeLabel:'Cinema review',label:'Comments'}};
    generic.results=[{kind:'reviewUpdated',target:{id:'review',label:'Comments'},item:{activityId:'x',osmid:'way/4'}}];
    assert.equal(generic.tickerItems()[0].name,'Cinema review');
    generic.results[0].target.label='Renamed comments';
    assert.equal(generic.tickerItems()[0].kind,'reviewUpdated','renaming labels does not change classification');
    console.log('PASS: first/repeat/day/cache, manual history, combined review failure, empty, storage denial and generic reviews');
})().catch(error=>{console.error(error);process.exitCode=1;});
