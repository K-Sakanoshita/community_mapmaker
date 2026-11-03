const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const calls = [];
let finish, fail, loaded;
const context = vm.createContext({
    console,
    Conf: { map: { detailZoom: 17 } },
    mapLibre: {
        getZoom: () => 15,
        flyTo: (...args) => calls.push(['move', ...args])
    },
    geoCont: { flashPolygon() {}, writePoiCircle() {} },
    winCont: { spinner: value => calls.push(['spinner', value]) },
    cMapMaker: { viewDetail: async id => calls.push(['detail', id]) },
    overPassCont: { getOsmIds: (...args) => {
        calls.push(['fetch', ...args]);
        return new Promise((resolve, reject) => { finish = resolve; fail = reject; });
    } }
});
vm.runInContext(fs.readFileSync('lib/poilib.js', 'utf8')
    + '\nthis.poiCont = new PoiCont();', context);
const poi = context.poiCont;
poi.get_osmid = () => loaded;
poi.get_actid = () => undefined;
poi.addGeojson = () => { loaded = { geojson: { id: 'way/1' }, lnglat: [136, 35] }; };

(async () => {
    const pending = poi.select('way/1', true, 0, [135, 34], { fromChanges: true });
    assert.equal(calls[0][0], 'move', 'move starts before the network request completes');
    assert.equal(JSON.stringify(calls[0]), JSON.stringify(['move', [135, 34], 17]));
    assert.equal(calls.find(call => call[0] === 'fetch')[4].fromChanges, true);
    assert.equal(calls.some(call => call[0] === 'detail'), false);
    finish({});
    await pending;
    assert.equal(calls.filter(call => call[0] === 'move').length, 1, 'loaded geometry does not move the map a second time');
    assert.equal(calls.some(call => call[0] === 'detail'), true);

    calls.length = 0;
    const failed = poi.select('way/1', true, 0, [135.1, 34.1], { fromChanges: true });
    assert.equal(calls[0][0], 'move', 'feed coordinates take priority even for a loaded object');
    assert.equal(calls.some(call => call[0] === 'fetch'), true, 'loaded objects are refreshed too');
    fail(new Error('unavailable'));
    await assert.rejects(failed, /unavailable/);
    assert.equal(calls.filter(call => call[0] === 'move').length, 1, 'failed detail leaves the map at the feed location');
    assert.equal(JSON.stringify(calls.at(-1)), JSON.stringify(['spinner', false]));

    calls.length = 0;
    await poi.select('way/1', true);
    assert.equal(calls.some(call => call[0] === 'fetch'), false, 'ordinary loaded selection still avoids fetching');

    loaded = undefined;
    calls.length = 0;
    const noCoordinates = poi.select('way/1', true, 0, null, { fromChanges: true });
    assert.equal(calls.some(call => call[0] === 'move'), false);
    finish({});
    await noCoordinates;
    assert.equal(calls.filter(call => call[0] === 'move').length, 1, 'missing feed coordinates fall back to fetched geometry');
    console.log('PASS: immediate changes navigation, parallel fetch, refresh, failure and ordinary selection');
})().catch(error => { console.error(error); process.exitCode = 1; });
