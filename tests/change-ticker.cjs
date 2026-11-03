const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const calls = [];
class Ticker {
    modalInstance = { hide: () => calls.push(['hideModal']) };
    init(container, config) { calls.push(['init', container, config]); }
    setItems(items, options) { calls.push(['setItems', items, options]); }
    hide() { calls.push(['hide']); }
    unreadEvents() { return []; }
}
class Changes {
    results = [];
    async checkOnStartup() {
        this.results = [{ item: { name: '新しい公園' } }];
        return { state: 'changes', results: this.results };
    }
    tickerItems() { return this.results.map(result => ({ headline: result.item.name })); }
    previewRandom(count) {
        this.results = Array.from({ length: count }, (_, index) =>
            ({ item: { name: `【テスト】公園 ${index + 1}` } }));
        return this.results;
    }
}
const container = {};
const intro = { hidden: false };
const stub = class {};
const context = {
    console, Date, URL, location: {href:"https://example.test/"},
    window: { navigator: { language: 'ja' }, localStorage: { getItem: () => null } },
    document: { getElementById: id => id === 'cMapIntro' ? intro : {} },
    IndoorControl: stub, Glottologist: stub, Basic: stub, PoiStatusCont: stub, OverPassControl: stub,
    Maplibre: class { map = { getContainer: () => container }; },
    GeoCont: stub, ListTable: stub,
    PoiCont: class { async select(...args) { calls.push(['select', ...args]); } }, PlaygroundModelFactories: {}, MapFeature3D: stub,
    GoogleSpreadSheet: stub, NewsTicker: Ticker, HistoricalNewsController: stub,
    ChangeController: Changes, AreaFeatureLinker: stub, AreaSearchController: stub,
    ListActionButtons: stub
};
vm.createContext(context);
vm.runInContext(fs.readFileSync('cmapmaker.js', 'utf8')
    + '\nthis.fixture = { cMapMaker, changesController, poiCont, gSheet };', context);
context.Conf = { changes: { ticker: { use: true, maxItems: 30, mobileLabel: '公園・遊具の新着' } },
    intro: { use: true } };
(async () => {
    await context.fixture.cMapMaker.initDailyIntro();
    assert.equal(intro.hidden, true);
    assert.equal(calls[0][0], 'init');
    assert.equal(calls[0][1], container);
    assert.equal(calls[0][2].id, 'changesTicker');
    assert.equal(calls[0][2].modal, true);
    assert.equal(calls[1][0], 'setItems');
    assert.equal(calls[1][1][0].headline, '新しい公園');
    assert.equal(await calls[0][2].onSelect({ osmId: 'way/219004605', coordinates: [135.5, 34.7] }), true);
    assert.equal(JSON.stringify(calls.find(call => call[0] === 'select')), JSON.stringify(['select', 'way/219004605', true, 0, [135.5, 34.7], { fromChanges: true }]));
    let completeSelection;
    context.fixture.poiCont.select = () => new Promise(resolve => { completeSelection = resolve; });
    const pendingSelection = calls[0][2].onSelect({ osmId: 'way/1', coordinates: [135.5, 34.7] });
    assert.equal(calls.at(-1)[0], 'hideModal', 'map is revealed before detail loading completes');
    completeSelection();
    assert.equal(await pendingSelection, true);
    assert.equal(await calls[0][2].onSelect({}), false);
    const mock = context.window.previewRandomChanges(3);
    assert.equal(mock.length, 3);
    assert.equal(calls.at(-1)[0], 'setItems');
    assert.equal(calls.at(-1)[1].length, 3);
    assert.equal(calls.at(-1)[1][0].headline, '【テスト】公園 1');
    context.Conf.changes.use = true;
    const maker = context.fixture.cMapMaker;
    const controller = context.fixture.changesController;
    let region = '27', refreshes = 0;
    controller.region = async () => ({code:region});
    controller.checkOnStartup = async () => { refreshes++; controller.results = [{item:{name:region === '28' ? '兵庫県の公園' : '大阪府の公園'}}]; };
    maker.displayedChangeRegion = '27';
    await maker.refreshChangeRegion();
    assert.equal(refreshes,0);
    region = '28';
    await Promise.all([maker.refreshChangeRegion(),maker.refreshChangeRegion()]);
    assert.equal(refreshes,1);
    assert.equal(maker.displayedChangeRegion,'28');
    assert.equal(calls.at(-1)[1][0].headline,'兵庫県の公園');
    // Site notices defer the existing intro/change feed until the notice closes.
    let closed, introCalls = 0;
    maker.initDailyIntro = async () => { introCalls++; };
    maker.siteUpdates = { initButton() {}, autoShow: async () => true,
        modal: { element: { addEventListener(event, callback, options) {
            assert.equal(event, 'hidden.bs.modal');
            assert.equal(options.once, true);
            closed = callback;
        } } } };
    context.Conf.siteUpdates = { use: true };
    await maker.initStartupNotices();
    assert.equal(introCalls, 0);
    closed();
    assert.equal(introCalls, 1);
    maker.siteUpdates.autoShow = async () => false;
    await maker.initStartupNotices();
    assert.equal(introCalls, 2);
    context.Conf.siteUpdates.use = false;
    await maker.initStartupNotices();
    assert.equal(introCalls, 3);
    console.log('PASS: startup changes, console preview and site notice sequencing');
    let gets=0, shouldFail=false;
    context.Conf.activity={url:'https://example.test/api?app=places&summary=1&limit=30&updated_since=old&bbox=old&osmids=old&id=old'};
    context.fixture.poiCont.adata=[];
    context.fixture.poiCont.setActdata=rows=>{context.fixture.poiCont.adata=rows;};
    context.fixture.gSheet.get=async (url, options)=>{
        gets++;const parsed=new URL(url);
        assert.equal(parsed.searchParams.get('app'),'places');assert.equal(parsed.searchParams.get('osmid'),'way/1');
        for(const param of ['summary','limit','updated_since','bbox','osmids','id'])assert.equal(parsed.searchParams.has(param),false);
        assert.equal(options.throwOnError,true);
        await Promise.resolve();if(shouldFail)throw Error('API failed');
        return [{id:'review/1',osmid:'way/1',body:'one'},{id:'review/2',osmid:'way/1',body:'two'}];
    };
    await Promise.all([maker.loadChangeReviewRows('way/1'),maker.loadChangeReviewRows('way/1')]);
    assert.equal(gets,1,'overlapping requests to the same place are shared');
    assert.equal(context.fixture.poiCont.adata.length,2);
    shouldFail=true;await assert.rejects(()=>maker.loadChangeReviewRows('way/1'));shouldFail=false;
    await maker.loadChangeReviewRows('way/1');assert.equal(gets,3,'failure is retryable');
    const events=[{activityId:'review/1',osmId:'way/1'},{activityId:'review/2',osmId:'way/1'}];
    controller.tickerItems=()=>events.map(e=>({...e,review:{body:context.fixture.poiCont.adata.find(r=>r.id===e.activityId).body}}));
    maker.showChangeTicker();const config=calls.filter(c=>c[0]==='init').at(-1)[2];
    const before=gets;const expanded=await config.detailsProvider(events);
    assert.equal(gets,before+1,'two review events for one OSM object use one full-data request');
    assert.equal(expanded[0].review.body,'one');assert.equal(expanded[1].review.body,'two');
    console.log('PASS: startup changes and console preview reach the news ticker');
})().catch(error => { console.error(error); process.exitCode = 1; });
