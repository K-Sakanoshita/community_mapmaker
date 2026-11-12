const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
let requests = [], live = 0, peak = 0;
const ctx = vm.createContext({
    Conf: { thumbnail: { backend: { use: true, concurrency: 2, url: 'https://api.test/api/thumbnail.php?app=jusoartfes2026' } },
        activities: { WP: { form: { photo: { type: 'image_url', gsheet: 'picture_url1' } } } } },
    document: { baseURI: 'https://site.test/map/' },
    URL: class extends URL { static createObjectURL(blob) { return 'blob:' + blob.id; } },
    AbortController, setTimeout, clearTimeout,
    fetch: async url => {
        live++; peak = Math.max(live, peak); requests.push(url);
        await new Promise(setImmediate); live--;
        return { ok: !url.includes('missing'), status: url.includes('missing') ? 422 : 200,
            headers: { get: key => key === 'Content-Type' ? 'image/webp' : null },
            json: async () => ({ errors: { field: 'Expected an image-type field.' } }),
            blob: async () => ({ id: new URL(url).searchParams.get('id') }) };
    }
});
vm.runInContext(fs.readFileSync('lib/activitythumbnails.js', 'utf8') + '\nthis.api = ActivityThumbnails;', ctx);
const api = ctx.api;
const record = { id: 'WP/1506', picture_url1: 'https://images.test/写真.jpg' };
const url = api.forSource(record, new URL(record.picture_url1).href);
assert.equal(new URL(url).searchParams.get('app'), 'jusoartfes2026');
assert.equal(new URL(url).searchParams.get('id'), 'WP/1506');
assert.equal(new URL(url).searchParams.get('field'), 'picture_url1');
assert.equal(api.forSource({ id: 'WP/1', picture_url1: './local.jpg' }, 'https://site.test/map/local.jpg'), 'https://site.test/map/local.jpg');
assert.equal(api.forSource(record, 'File:Example.jpg'), 'File:Example.jpg');
assert.equal(api.forSource(record, 'https://images.test/other.jpg'), 'https://images.test/other.jpg');
ctx.Conf.thumbnail.backend.use = false;
assert.equal(api.forSource(record, record.picture_url1), record.picture_url1);
ctx.Conf.thumbnail.backend.use = true;
(async () => {
    const [a,b,c] = await Promise.all([api.resolve(url, record.picture_url1), api.resolve(url, record.picture_url1),
        api.resolve(api.url({ id: 'WP/2' }, 'picture_url1', 'https://images.test/2.jpg'), 'https://images.test/2.jpg')]);
    assert.equal(a,'blob:WP/1506'); assert.equal(a,b); assert.equal(c,'blob:WP/2');
    assert.equal(requests.length,2,'map, strip and detail reuse one generated thumbnail');
    assert.equal(peak,2,'two distinct thumbnails load concurrently');
    const normalFetch = ctx.fetch;
    const releases = [], started = [];
    let active = 0, maximum = 0;
    ctx.fetch = url => new Promise((resolve, reject) => {
        started.push(url); active++; maximum = Math.max(maximum, active);
        releases.push(fail => {
            active--;
            if (fail) reject(new Error('network failure'));
            else resolve({ok:true, status:200,
                headers:{get:()=> 'image/webp'}, blob:async()=>({id:url})});
        });
    });
    const queued = Array.from({length:4}, (_,i) => api.resolve(`https://api.test/pool/${i}`, `https://images.test/${i}.jpg`));
    const duplicate = api.resolve('https://api.test/pool/0','https://images.test/0.jpg');
    assert.equal(duplicate,queued[0],'pending duplicate shares the same promise');
    await new Promise(setImmediate);
    assert.equal(started.length,2,'the third request waits for an available connection');
    releases[0](false); await new Promise(setImmediate);
    assert.equal(started.length,3,'a completed download releases one connection');
    releases[1](true); await new Promise(setImmediate);
    assert.equal(started.length,4,'a failed download also releases its connection');
    releases[2](false); releases[3](false);
    const results = await Promise.all(queued);
    assert.equal(maximum,2,'the shared queue never exceeds two connections');
    assert.equal(results[1],'https://images.test/1.jpg','failures retain the original-image fallback');
    await new Promise(setImmediate);
    // Sites without the opt-in retain the original one-connection behavior.
    delete ctx.Conf.thumbnail.backend.concurrency;
    const serial = [api.resolve('https://api.test/serial/0','https://images.test/serial0.jpg'),
        api.resolve('https://api.test/serial/1','https://images.test/serial1.jpg')];
    await new Promise(setImmediate);
    assert.equal(started.length,5,'missing concurrency setting starts only one request');
    releases[4](false); await new Promise(setImmediate);
    assert.equal(started.length,6);
    releases[5](false); await Promise.all(serial); await new Promise(setImmediate);
    ctx.Conf.thumbnail.backend.concurrency = 2;
    ctx.fetch = normalFetch;
    assert.equal(await api.resolve('https://api.test/missing','https://images.test/original.jpg'),'https://images.test/original.jpg');
    const source = fs.readFileSync('detail/activities.js','utf8');
    const method = source.slice(source.indexOf('    viewImage(source) {'),source.lastIndexOf('\n}')).trim();
    let opened;
    ctx.ImageViewer = { open: value => { opened=value; } };
    vm.runInContext('this.viewer = ({ closeVideo() {}, '+method+' });',ctx);
    ctx.viewer.viewImage({ getAttribute: name => name==='data-original-src' ? record.picture_url1 : 'thumbnail.webp', currentSrc: 'blob:preview', alt: '' });
    assert.equal(opened.image,record.picture_url1,'full-size viewer uses original, never API/blob preview');
    ctx.viewer.viewImage({ getAttribute: name => name==='src_org' ? 'https://commons.test/original.jpg' : null, currentSrc:'commons-thumb.jpg', alt:'' });
    assert.equal(opened.image,'https://commons.test/original.jpg','Commons full-size view also uses the original');
    assert.equal(record.picture_url1,'https://images.test/写真.jpg','records retain original URLs');
    const attrs = {}, image = { dataset: {}, setAttribute(k,v) { attrs[k]=v; }, addEventListener() {} };
    const strip = { classList: { add() {} }, addEventListener() {}, removeEventListener() {},
        append() {}, set innerHTML(v) {} };
    ctx.document.createElement = () => image;
    ctx.window = { withAppAssetVersion: x => x };
    ctx.Conf.thumbnail.limits = 20;
    ctx.Conf.thumbnail.slideThumbWidth = 320;
    vm.runInContext(fs.readFileSync('lib/winlib.js','utf8')+'\nthis.win = new WinCont();',ctx);
    require('./helpers/thumbnail-cards')(ctx, strip);
    ctx.win.setImages(strip,[{ src:[record.picture_url1], activity:record, osmid:'node/1', title:'Photo' }],'loading.gif',20);
    await new Promise(setImmediate);
    assert.equal(image.src,'blob:WP/1506','thumbnail strip displays the API result');
    assert.equal(image.dataset.originalSrc,record.picture_url1,'strip retains original source');
    assert.equal(new URL(image.dataset.thumbnailUrl).pathname,'/api/thumbnail.php');

    api.pauseUntil = 0;
    ctx.fetch = async () => ({ status:422, ok:false, json:async()=>({errors:{url:'Invalid source URL'}}) });
    assert.equal(await api.resolve('https://api.test/unicode','https://images.test/日本語.jpg'),'https://images.test/日本語.jpg');
    assert.equal(api.pauseUntil,0,'one invalid URL does not pause all thumbnail requests');
    api.pauseUntil = Date.now() + 60000;
    let pausedRequests = 0;
    ctx.fetch = async () => { pausedRequests++; throw new Error('unexpected paused request'); };
    assert.equal(await api.resolve('https://api.test/paused','https://images.test/pause.jpg'),'https://images.test/pause.jpg');
    assert.equal(pausedRequests,0,'schema failures pause queued API requests');
    console.log('PASS: API mapping, Unicode URLs, local/Commons bypass, shared bounded parallel loading, fallback and original-only viewer');
})().catch(e=>{console.error(e);process.exitCode=1;});
