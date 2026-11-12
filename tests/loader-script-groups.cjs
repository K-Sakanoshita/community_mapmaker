const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require.resolve('../loader.module.js'), 'utf8')
    .replace('import.meta.url', '"https://example.test/loader.module.js?ver=test"');
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };

async function boot(manifest) {
    const nodes = [], errors = [];
    let initialized = 0;
    const context = vm.createContext({
        URL, Promise, Map, Date,
        console: { error: (...args) => errors.push(args), warn() {} },
        location: { origin: 'https://example.test' },
        CSS: { escape: value => value },
        setTimeout: () => 1, clearTimeout() {},
        fetch: async () => ({ ok: true, json: async () => manifest }),
        document: {
            getElementById: () => null,
            querySelector: selector => selector === ".startup-splash-image"
                ? { src: "https://example.test/image/splash.png" }
                : nodes.find(node => !node.removed
                && (selector.includes(`src="${node.src}"`) || selector.includes(`href="${node.href}"`))),
            createElement: tag => ({ tag, remove() { this.removed = true; } }),
            head: { appendChild: node => nodes.push(node) }
        },
        cMapMaker: { init() { initialized++; } }
    });
    context.window = context;
    context.startupText = key => key;
    vm.runInContext(source, context);
    await flush();
    return { nodes, errors, context, initialized: () => initialized };
}

(async () => {
    const app = await boot({
        styles: ['user.css'],
        scriptGroups: [
            { parallel: true, scripts: ['vendor-a.js', 'vendor-b.js'] },
            { parallel: false, scripts: ['base.js', 'derived.js', 'app.js'] }
        ],
        lazyScriptGroups: { detail: { parallel: false, scripts: ['detail-base.js', 'detail.js'] } }
    });
    assert.equal(app.context.withAppAssetVersion('./image/splash.png'), './image/splash.png');
    assert.equal(app.context.withAppAssetVersion('https://example.test/image/splash.png'), 'https://example.test/image/splash.png');
    assert.equal(app.context.withAppAssetVersion('./image/other.png'), 'https://example.test/image/other.png?ver=test');
    const scripts = () => app.nodes.filter(node => node.tag === 'script');
    assert.equal(scripts().length, 2); // Both vendors start before either completes.
    assert.ok(scripts().every(node => node.async === true));
    scripts()[1].onload();
    await flush();
    assert.equal(scripts().length, 2); // Application waits for the entire vendor group.
    scripts()[0].onload();
    await flush();
    const ordered = scripts().slice(2);
    assert.deepEqual(ordered.map(node => new URL(node.src).pathname), ['/base.js', '/derived.js', '/app.js']);
    assert.ok(ordered.every(node => node.async === false));
    assert.ok(ordered.every(node => new URL(node.src).searchParams.get('ver') === 'test'));
    assert.equal(app.initialized(), 0);
    ordered.forEach(node => node.onload());
    await flush();
    assert.equal(app.initialized(), 0); // Styles must also be ready before initialization.
    app.nodes.find(node => node.tag === 'link').onload();
    await flush();
    assert.equal(app.initialized(), 1);

    const lazy = app.context.loadLazyScriptGroup('detail');
    assert.equal(app.context.loadLazyScriptGroup('detail'), lazy);
    const detail = scripts().slice(5);
    assert.equal(detail.length, 2); // Lazy ordered groups download together too.
    assert.ok(detail.every(node => node.async === false));
    detail.forEach(node => node.onload());
    await lazy;
    assert.equal(app.errors.length, 0);

    const legacy = await boot({ scripts: ['first.js', 'second.js'] });
    assert.equal(legacy.nodes.length, 2);
    assert.ok(legacy.nodes.every(node => node.async === false));
    legacy.nodes[0].onload();
    await flush();
    assert.equal(legacy.initialized(), 0);
    legacy.nodes[1].onload();
    await flush();
    assert.equal(legacy.initialized(), 1);

    const failed = await boot({ scriptGroups: [
        { parallel: false, scripts: ['broken.js', 'peer.js'] },
        { scripts: ['next-group.js'] }
    ] });
    failed.nodes[0].onerror();
    failed.nodes[1].onload();
    await flush();
    assert.equal(failed.nodes.length, 2); // Failure prevents advancing to the next group/init.
    assert.equal(failed.initialized(), 0);
    assert.equal(failed.errors.length, 1);
    console.log('PASS: parallel acquisition, ordered flags, group barriers, styles, lazy groups, legacy and failure handling');
})().catch(error => { console.error(error); process.exitCode = 1; });
