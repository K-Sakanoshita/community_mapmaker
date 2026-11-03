const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

// Run the actual resize registration with a controlled viewport and debounce clock.
const source = fs.readFileSync('cmapmaker.js', 'utf8');
const start = source.indexOf('                    let resizeWaitTime;');
const end = source.indexOf('                    if (LANG === "en")', start);
assert.ok(start > 0 && end > start);
const timers = new Map();
const calls = [];
let nextTimer = 0;
const document = { activeElement: { tagName: 'BODY' } };
const window = { innerWidth: 390, innerHeight: 844 };
const context = vm.createContext({ window, document,
    setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; },
    clearTimeout(id) { timers.delete(id); },
    winCont: {
        resizeWindow() { calls.push('map'); },
        setSidebar(mode) { calls.push(mode); return Promise.resolve(); }
    },
    cMapMaker: { makeImages() { calls.push('images'); } },
    Conf: { thumbnail: { use: true } }
});
vm.runInContext(source.slice(start, end), context);
async function flush() {
    const pending = [...timers.values()];
    timers.clear();
    pending.forEach(fn => fn());
    await Promise.resolve();
}
(async () => {
    for (const active of [
        { tagName: 'INPUT', id: 'act_userid', value: '入力途中' },
        { tagName: 'INPUT', id: 'act_passwd', value: 'password' },
        { tagName: 'TEXTAREA', value: '口コミの下書き' },
        { tagName: 'SELECT' }, { tagName: 'DIV', isContentEditable: true }
    ]) {
        document.activeElement = active;
        const before = { ...active };
        for (const height of [480, 844]) {
            window.innerHeight = height;
            window.onresize();
            await flush();
        }
        assert.deepEqual(calls, [], 'keyboard opening/closing must not redraw the form panel');
        assert.equal(document.activeElement, active);
        assert.deepEqual(active, before);
    }
    // A resize queued immediately before focus must also be harmless.
    document.activeElement = { tagName: 'BODY' };
    window.onresize();
    document.activeElement = { tagName: 'INPUT', id: 'act_userid' };
    await flush();
    assert.deepEqual(calls.splice(0), ['map']);
    // A keyboard resize cancels an already queued panel redraw.
    document.activeElement = { tagName: 'BODY' };
    window.onresize();
    document.activeElement = { tagName: 'INPUT' };
    window.onresize();
    assert.equal(timers.size, 0);
    await flush();
    assert.deepEqual(calls.splice(0), ['map']);
    // Normal resizing resumes after leaving the input, and stays debounced.
    document.activeElement = { tagName: 'BODY' };
    window.innerWidth = 844;
    window.onresize();
    window.onresize();
    await flush();
    assert.deepEqual(calls, ['map', 'map', 'redraw', 'images']);
    console.log('PASS: keyboard resize preserves focused forms; queued redraws are guarded; normal resize resumes');
})().catch(error => { console.error(error); process.exitCode = 1; });
