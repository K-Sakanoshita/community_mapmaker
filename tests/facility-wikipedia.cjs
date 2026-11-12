const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('cmapmaker.js', 'utf8');
const method = source.slice(source.indexOf('    viewDetail('), source.indexOf('    syncPoiStatus('));
let activities = [], selected = null, hasWikipedia = true, output;
const context = vm.createContext({
    console: { log() {}, warn() {} },
    Conf: { icon: { fgPath: 'icons' }, menu: { modal: [], activities: [] }, etc: {} },
    poiCont: {
        get_osmid: () => ({ geojson: { properties: hasWikipedia ? { wikipedia: 'ja:会場' } : {} }, targets: [] }),
        getActlistByOsmid: () => activities,
        getCatnames: () => ['会場'], getIcon: () => 'venue.svg', getOSMname: () => 'Venue'
    },
    glot: { lang: 'ja', get: () => 'この場所について（Wikipedia）' },
    listTable: { getSelCategory: () => ['イベント'], matchesSelectedEventDate: activity => !selected || activity.id === selected,
        recordView() {} },
    osmBasic: { make: () => 'BASIC', makeAreaFacilities: () => '' },
    areaSearchController: { matchReasonHtml: () => '' },
    modalActs: { make: items => 'ACTIVITY:' + items.map(a => a.id).join(',') },
    wikimedia: { makeWikipediaOverView: () => '<div id="wikipedia">WIKIPEDIA</div>' },
    winCont: { setSidebar: async () => {}, menu_make() {}, setProgress() {}, makeDetail: params => { output = params.message; } },
    mapLibre: { viewMiniMap() {} }, location: { pathname: '/', hash: '' }, history: { replaceState() {} },
    document: { getElementById: () => ({ scrollTo() {} }) }
});
vm.runInContext('this.cMapMaker = ({ loadDetailLibraries: async () => {}, withIndoorLevel: value => value, changeMode() {}, ' + method + ' });', context);
(async () => {
    activities = [{ id: 'one' }];
    await context.cMapMaker.viewDetail('node/1');
    assert.match(output, /<details class="facility-wikipedia">/);
    assert(output.indexOf('BASIC') < output.indexOf('ACTIVITY:one'));
    assert(output.indexOf('ACTIVITY:one') < output.indexOf('WIKIPEDIA'));
    selected = 'other-day';
    await context.cMapMaker.viewDetail('node/1');
    assert.doesNotMatch(output, /ACTIVITY:/);
    assert.match(output, /<details class="facility-wikipedia">/, 'a facility with posts stays collapsed even if no posts match the day');
    activities = [];
    await context.cMapMaker.viewDetail('node/1');
    assert.match(output, /<details class="facility-wikipedia" open>/);
    hasWikipedia = false;
    await context.cMapMaker.viewDetail('node/1');
    assert.doesNotMatch(output, /facility-wikipedia/);
    console.log('PASS: Wikipedia follows activities, collapsed with any facility posts, expanded without posts, absent without a Wikipedia tag');
})().catch(error => { console.error(error); process.exitCode = 1; });
