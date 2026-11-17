const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync('cmapmaker.js', 'utf8');
const helper = source.slice(source.indexOf('async function retryInitialDataLoad('), source.indexOf('const glot ='));
const staticLoader = source.slice(source.indexOf('        const loadStatic = async function'), source.indexOf('        const setBGImage ='));
const delays = [], inserted = [];
let fetches = 0, failAlways = false, enabled = true;
const context = vm.createContext({
    console: { log() {}, warn() {} },
    setTimeout(callback, delay) { delays.push(delay); callback(); },
    Conf: { static: { use: true, osmjsons: ['./data/example.json'] } },
    window: { withAppAssetVersion: value => value },
    fetch: async () => {
        fetches++;
        if (failAlways) throw new Error('offline');
        if (fetches === 1) return { ok: false, status: 503 };
        return { ok: true, text: async () => {
            if (fetches === 2) throw new Error('interrupted response');
            return '{"elements":[]}';
        }};
    },
    overPassCont: { parseOverpassJsonAsync: JSON.parse, setOsmJson: async value => value },
    poiCont: { addGeojson(value, options) { inserted.push({ value, source: options.source }); }, setActlnglat() {} }
});
vm.runInContext(helper + staticLoader + '\nthis.loadStatic = loadStatic; this.retry = retryInitialDataLoad;', context);
(async () => {
    await context.loadStatic();
    assert.equal(fetches, 3);
    assert.deepEqual(delays, [500, 1500]);
    assert.equal(inserted.length, 1, 'retrying never inserts duplicate static data');
    assert.equal(inserted[0].source, 'static');
    delays.length = 0; fetches = 0; failAlways = true;
    await assert.rejects(context.loadStatic(), /offline/);
    assert.equal(fetches, 3, 'persistent failures stop after three attempts');
    assert.deepEqual(delays, [500, 1500]);
    assert.equal(inserted.length, 1);
    context.Conf.static.use = false;
    await context.loadStatic();
    assert.equal(fetches, 3, 'disabled static sources never request data');
    delays.length = 0;
    let attempts = 0;
    context.setTimeout = (callback, delay) => { delays.push(delay); enabled = false; callback(); };
    await assert.rejects(context.retry(async () => { attempts++; throw new Error('obsolete'); }, 'test', () => enabled), /obsolete/);
    assert.equal(attempts, 1, 'obsolete loads stop before another request');
    assert.deepEqual(delays, [500]);
    console.log('PASS: static HTTP/body recovery, bounded failures, no duplicate insertion, disabled sources and stale retry cancellation');
})().catch(error => { console.error(error); process.exitCode = 1; });
