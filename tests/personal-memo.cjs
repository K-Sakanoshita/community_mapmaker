const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({
    Conf: { etc: { localSave: 'test' } },
    poiCont: { getCatnames: () => [] }, glot: { get: value => value },
    PoiStatusIndex: { VISITED: 0, FAVORITE: 1, MEMO: 2 },
    poiStatusCont: { getValueByOSMID: () => [false, true, 'saved memo'] },
    cMapMaker: {}
});
vm.runInContext(fs.readFileSync('detail/osmbasic.js', 'utf8') + '\nthis.detail = new OSMbasic();', context);
for (const setting of [undefined, true, false]) {
    context.Conf.etc.showPersonalMemo = setting;
    const html = context.detail.make({ id: 'node/1' });
    assert.ok(html.includes('id="visited"'));
    assert.ok(html.includes('id="favorite"'));
    assert.equal(html.includes('id="visited-memo"'), setting !== false);
    assert.equal(html.includes('personal_memo_label'), setting !== false);
}
const source = fs.readFileSync('cmapmaker.js', 'utf8');
const method = source.slice(source.indexOf('    savePoiStatus('), source.indexOf('    clearDatail()'));
let stored;
context.poiStatusCont.getRecord = () => ({ memo: 'saved memo' });
context.poiStatusCont.setValueByOSMID = (...args) => { stored = args; };
const buttons = {
    visited: { name: 'node/1', getAttribute: () => 'true' },
    favorite: { getAttribute: () => 'false' }
};
context.document = { getElementById: id => buttons[id] ?? null };
vm.runInContext('this.controller = ({' + method + '});', context);
context.controller.savePoiStatus();
assert.deepEqual(stored, ['node/1', true, false, 'saved memo'], 'hidden memo survives status changes');
buttons['visited-memo'] = { value: 'edited memo' };
context.controller.savePoiStatus();
assert.equal(stored[3], 'edited memo', 'visible memo remains editable');
console.log('PASS: memo visibility defaults, status buttons and saved memo preservation');
