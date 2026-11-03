const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const servers = ['https://primary.test/api', 'https://alternate.test/api', 'https://third.test/api'];
const context = { console, URLSearchParams, setTimeout, Conf: { system: { OverPassServer: servers } },
    osmtogeojson: data => ({ features: data.elements.filter(e => e.type === 'way').map(e => ({ id: `way/${e.id}` })) }) };
vm.createContext(context);
vm.runInContext(fs.readFileSync('lib/overpasslib.js', 'utf8') + '\nthis.Controller = OverPassControl;', context);
const stale = { osm3s: { timestamp_osm_base: '2026-10-06T19:13:49Z' }, elements: [] };
const current = { elements: [{ type: 'way', id: 1566318775 }, { type: 'node', id: 1 }] };
function make(responses) {
    const controller = new context.Controller();
    context.overPassCont = controller;
    const calls = [];
    controller.fetchOverpassOnce = async (data, progress, url) => {
        calls.push({ url, query: data.get('data') });
        const response = responses[calls.length - 1];
        if (response instanceof Error) throw response;
        return response;
    };
    controller.setCache = geojson => { controller.Cache = geojson; };
    return { controller, calls };
}
(async () => {
    const { controller, calls } = make([stale, current]);
    const loaded = await controller.getOsmIds(['way/1566318775'], [135.5466775, 34.5280647]);
    assert.equal(loaded.features[0].id, 'way/1566318775');
    assert.deepEqual(calls.map(call => call.url), servers.slice(0, 2));
    assert.equal(calls[0].query, calls[1].query, 'fallback retains ID query and routing bbox');
    assert.equal(controller.UseServer, 1);

    const ordinary = make([stale]);
    assert.equal(await ordinary.controller.fetchOverpass(new URLSearchParams(), undefined, servers[0]), stale);
    assert.equal(ordinary.calls.length, 1, 'empty map search is valid and does not switch');

    const partial = make([{ elements: [{ type: 'node', id: 1 }] }, current]);
    await partial.controller.getOsmIds(['way/1566318775'], null);
    assert.equal(partial.calls.length, 2, 'child nodes cannot satisfy the requested way');

    const exhausted = make([stale, stale, stale]);
    await assert.rejects(exhausted.controller.getOsmIds(['way/1566318775']), error => {
        assert.equal(error.kind, 'missing_objects');
        assert.equal(error.databaseTimestamp, stale.osm3s.timestamp_osm_base);
        return true;
    });
    assert.equal(exhausted.calls.length, 3, 'each configured server is tried once');
    assert.equal(exhausted.controller.Cache.geojson.length, 0, 'missing lookup does not cache incomplete data');

    const once = make([stale]);
    assert.equal(await once.controller.getOsmIds(['way/1566318775'], null, null, { retry: false }), undefined);
    assert.equal(once.calls.length, 1, 'explicit no-retry name hydration stays a single request');

    const domestic = make([current]);
    domestic.controller.UseServer = 2;
    await domestic.controller.getOsmIds(['way/1566318775'], null, null, { fromChanges: true });
    assert.deepEqual(domestic.calls.map(call => call.url), [servers[0]], 'new changes always try domestic first');
    assert.equal(domestic.controller.UseServer, 2, 'domestic success preserves the ordinary server');

    const changes = make([stale, current, current]);
    changes.controller.UseServer = 2;
    const cooldown = Date.now() + 60000;
    changes.controller.ServerCooldowns.set(servers[0], cooldown);
    await changes.controller.getOsmIds(['way/1566318775'], null, null, { fromChanges: true });
    assert.deepEqual(changes.calls.map(call => call.url), servers.slice(0, 2));
    assert.equal(changes.controller.UseServer, 2, 'fallback does not change the ordinary server');
    assert.equal(changes.controller.ServerCooldowns.get(servers[0]), cooldown);
    await changes.controller.getOsmIds(['way/1566318775']);
    assert.equal(changes.calls.at(-1).url, servers[2], 'ordinary lookup still uses its original server');

    const changesFailed = make([stale, stale]);
    await assert.rejects(changesFailed.controller.getOsmIds(['way/1566318775'], null, null, { fromChanges: true }));
    assert.deepEqual(changesFailed.calls.map(call => call.url), servers.slice(0, 2), 'changes never try the third server');
    assert.equal(changesFailed.controller.UseServer, 0);

    const httpFailed = make([Object.assign(new Error('bad gateway'), { status: 502 }), current]);
    await httpFailed.controller.getOsmIds(['way/1566318775'], null, null, { fromChanges: true });
    assert.deepEqual(httpFailed.calls.map(call => call.url), servers.slice(0, 2), 'HTTP failure falls back to the official server');

    const syntax = Object.assign(new Error('invalid query'), { status: 400 });
    const stopped = make([syntax, current]);
    await assert.rejects(stopped.controller.getOsmIds(['way/1566318775']), error => error === syntax);
    assert.equal(stopped.calls.length, 1, 'query errors never trigger fallback');
    console.log('PASS: missing ID fallback, complete results, empty map search, exhaustion and no-retry paths');
})().catch(error => { console.error(error); process.exitCode = 1; });
