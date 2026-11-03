const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const requests = [], warnings = [];
const output = { innerHTML: '' };
let thumbnail = null;
const context = vm.createContext({
    window: {}, URLSearchParams, Conf: { wikipedia: { domain: 'wikipedia.org' } },
    glot: { get: () => 'Wikipedia' }, document: { getElementById: () => output },
    console: { log() {}, warn: (...args) => warnings.push(args) },
    fetch: async url => {
        requests.push(new URL(url).searchParams.get('titles'));
        return { ok: true, json: async () => ({ query: { pages: { 1: { extract: 'Article introduction', thumbnail } } } }) };
    }
});
vm.runInContext(fs.readFileSync('lib/wikimedialib.js', 'utf8') + '\nthis.wikimedia = new WikimediaLib();', context);
(async () => {
    for (const [value, title, section] of [['ja:地域会館#沿革', '地域会館', '沿革'], ['ja:地域会館#利用_案内', '地域会館', '利用_案内'], ['en:Example: Title', 'Example: Title', '']]) {
        context.wikimedia.makeWikipediaOverView(value);
        await new Promise(resolve => setImmediate(resolve));
        assert.equal(requests.at(-1), title, 'API receives an article title without its section');
        const href = output.innerHTML.match(/href="([^"]+)"/)[1];
        const url = new URL(href);
        assert.equal(decodeURIComponent(url.pathname), '/wiki/' + title);
        assert.equal(decodeURIComponent(url.hash), section ? '#' + section : '');
        assert.match(output.innerHTML, /Article introduction/);
        thumbnail = { source: 'https://example.test/photo.jpg', width: 100, height: 80 };
    }
    assert.match(output.innerHTML, /<img/);
    assert.deepEqual(warnings, []);
    console.log('PASS: Wikipedia section links, plain titles and optional thumbnails');
})().catch(error => { console.error(error); process.exitCode = 1; });
