const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({ console });
vm.runInContext(fs.readFileSync('lib/poilib.js', 'utf8') + '\nthis.poiCont = new PoiCont();', context);
const poi = context.poiCont;
const first = { id: 'post/1', osmid: 'node/1' };
const second = { id: 'post/2', osmid: 'node/1' };
poi.setActdata([first, second, { id: 'post/1', osmid: 'node/2' }]);
assert.equal(poi.get_actid('post/1'), first, 'first duplicate wins');
assert.deepEqual(Array.from(poi.getActlistByOsmid('node/1')), [first, second]);
poi.getActlistByOsmid('node/1').pop();
assert.equal(poi.getActlistByOsmid('node/1').length, 2, 'callers cannot mutate index arrays');
assert.equal(poi.get_actid('absent'), undefined);
poi.lnglats['node/1'] = [135, 34];
poi.geoidx['node/1'] = 0;
assert.deepEqual(poi.getLnglatbyId('post/1'), [135, 34]);
assert.deepEqual(poi.getLnglatbyId('node/1'), [135, 34]);
assert.equal(poi.getLnglatbyId('absent'), undefined);

poi.setActdata([{ id: 'post/3', osmid: 'node/3' }]);
assert.equal(poi.get_actid('post/1'), undefined, 'BBOX replacement drops old entries');
assert.equal(poi.getActlistByOsmid('node/1').length, 0);
poi.adata[0].osmid = 'node/4';
poi.setActdata(poi.adata);
assert.equal(poi.getActlistByOsmid('node/3').length, 0, 'same-array updates rebuild indexes');
assert.equal(poi.getActlistByOsmid('node/4').length, 1);
poi.adata = [first];
assert.equal(poi.get_actid('post/1'), first, 'direct array replacement is supported');
poi.adata.push(second);
assert.equal(poi.getActlistByOsmid('node/1').length, 2);
poi.setActdata([{ id: 1, osmid: 2 }, { id: '01', osmid: '02' }]);
assert.equal(poi.get_actid('01').id, 1, 'legacy loose equality remains unchanged');
assert.equal(poi.getActlistByOsmid(2).length, 2);

let reads = 0;
const rows = Array.from({ length: 10000 }, (_, i) => ({
    get id() { reads++; return `post/${i}`; },
    get osmid() { reads++; return `node/${i}`; }
}));
poi.setActdata(rows);
for (let i = 0; i < rows.length; i++) {
    assert.equal(poi.get_actid(`post/${i}`), rows[i]);
    assert.equal(poi.getActlistByOsmid(`node/${i}`)[0], rows[i]);
}
assert(reads < rows.length * 15, `lookups must remain linear, observed ${reads} field reads`);
poi.setActdata([]);
assert.equal(poi.get_actid('post/0'), undefined);
console.log('PASS: activity indexes preserve lookup semantics, invalidate on updates and avoid quadratic scans');
