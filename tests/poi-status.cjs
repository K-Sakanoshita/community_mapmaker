const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const values = new Map();
const localStorage = {
    get length() { return values.size; },
    key(index) { return [...values.keys()][index]; },
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); }
};
const context = { localStorage, Conf: { etc: { localSave: 'playgrounds' } } };
vm.createContext(context);
vm.runInContext(fs.readFileSync('lib/poistatuslib.js', 'utf8') + '\nthis.status = new PoiStatusCont()', context);
const status = context.status;
values.set('playgrounds.1', 'true,false,old memo');
values.set('another-map.2', 'true,true,foreign');
assert.deepEqual([...status.getValueByOSMID('1')], [true, false, 'old memo']);
assert.deepEqual(Array.from(status.getAllVisited(), ([key]) => key), ['playgrounds.1']);
assert.equal(status.getAllFavorite().length, 0);
status.setValueByOSMID('1', true, true, 'a,b "quoted"');
assert.equal(status.getRecord('1').memo, 'a,b "quoted"');
assert.deepEqual(Array.from(status.getAllFavorite(), ([key]) => key), ['playgrounds.1']);
assert.equal(values.get('another-map.2'), 'true,true,foreign');
values.set('playgrounds.1', JSON.stringify({ visited: true, favorite: true, memo: 'x', lastVisited: '2026-09-19', visitCount: 3 }));
status.setValueByOSMID('1', false, true, 'updated');
assert.equal(status.getRecord('1').visitCount, 3);
assert.equal(status.getAllVisited().length, 0);
console.log('PASS: POI status legacy data, app isolation, favorites, and future fields');

// Activity list rows and facility detail/markers share the OSM identity.
const acts = [{ id: 'WP/1', osmid: 'node/42' }, { id: 'WP/2', osmid: 'node/42' }, { id: 'WP/3', osmid: '' }];
context.poiCont = { get_actid: id => acts.find(a => a.id === id),
    getActlistByOsmid: id => acts.filter(a => a.osmid === id) };
values.set('playgrounds.WP/1', JSON.stringify({ visited: true, favorite: false, memo: 'legacy memo', visitCount: 4 }));
values.set('playgrounds.WP/2', 'false,true,another memo');
for (const id of ['node/42', 'WP/1', 'WP/2']) {
    assert.equal(status.getRecord(id).visited, true);
    assert.equal(status.getRecord(id).favorite, true);
}
assert.equal(status.getRecord('node/42').memo, 'legacy memo');
assert.equal(status.getAllVisited().filter(([key]) => key === 'playgrounds.node/42').length, 1);
assert(!status.getAllFavorite().some(([key]) => key.startsWith('playgrounds.WP/')));
status.setValueByOSMID('WP/2', false, false, 'updated facility memo');
assert(values.has('playgrounds.node/42'));
for (const id of ['node/42', 'WP/1', 'WP/2']) {
    assert.equal(status.getRecord(id).visited, false, 'explicit canonical false overrides legacy true');
    assert.equal(status.getRecord(id).favorite, false);
    assert.equal(status.getRecord(id).memo, 'updated facility memo');
}
assert.equal(status.getRecord('node/42').visitCount, 4);
assert(!status.getAllVisited().some(([key]) => key === 'playgrounds.node/42'));
status.setValueByOSMID('node/42', true, true, 'detail memo');
assert.equal(status.getRecord('WP/2').visited, true);
assert.equal(status.getRecord('WP/1').favorite, true);
status.setValueByOSMID('WP/3', true, false, 'standalone');
assert.equal(status.getStatusId('WP/3'), 'WP/3');
assert.equal(status.getRecord('WP/3').visited, true);
assert(values.has('playgrounds.WP/1'), 'legacy records are retained');
console.log('PASS: activity/detail identity, legacy activity records, explicit clears, shared favorites, deduplicated markers and standalone activities');
