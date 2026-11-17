const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const config = vm.runInNewContext('(' + fs.readFileSync('data/config-user.jsonc', 'utf8') + ')');
assert.equal(config.poiView.openingHours, false, 'default is hidden');

let parseCalls = 0;
const context = vm.createContext({
    Conf: { etc: { localSave: '' } },
    cMapMaker: {},
    poiCont: { getCatnames: () => ['店舗', ''] },
    basic: { parseOpeningHours(value) { parseCalls++; return value === 'unknown' ? '' : '10:00〜18:00'; } },
});
vm.runInContext(fs.readFileSync('detail/osmbasic.js', 'utf8') + '\nthis.detail = new OSMbasic();', context);
const tags = { shop: 'art', opening_hours: 'Mo-Su 10:00-18:00' };

for (const poiView of [undefined, {}, { openingHours: false }, { openingHours: 'true' }]) {
    context.Conf.poiView = poiView;
    const html = context.detail.make(tags);
    assert.doesNotMatch(html, /fa-clock|10:00/);
    assert.match(html, /店舗/);
}
assert.equal(parseCalls, 0, 'hidden hours are not parsed');

context.Conf.poiView = { openingHours: true };
assert.match(context.detail.make(tags), /fa-clock.*10:00〜18:00/);
assert.equal(parseCalls, 1);
assert.doesNotMatch(context.detail.make({ shop: 'art' }), /fa-clock/);
assert.equal(parseCalls, 1, 'missing hours are not parsed');
assert.doesNotMatch(context.detail.make({ opening_hours: 'unknown' }), /fa-clock/);
assert.equal(tags.opening_hours, 'Mo-Su 10:00-18:00');
console.log('PASS: opening hours default, enabled, disabled, missing and empty output');
