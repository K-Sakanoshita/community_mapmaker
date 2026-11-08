const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const parse = file => vm.runInNewContext('(' + fs.readFileSync(file, 'utf8') + ')');
const labels = parse('data/glot-custom.jsonc');
const config = parse('tests/fixtures/openhc-listtable.jsonc');
function element(tagName = 'div') {
    return { tagName, children: [], dataset: {}, className: '',
        classList: { add(name) { this.owner.className += ' ' + name; } },
        addEventListener() {}, setAttribute() {},
        appendChild(child) { this.children.push(child); },
        prepend(child) { this.children.unshift(child); } };
}
function createElement(tag) {
    const el = element(tag);
    el.classList.owner = el;
    return el;
}
const listArea = createElement();
const context = vm.createContext({ console,
    glot: { lang: 'ja', get(key) { return labels[key]?.[this.lang] ?? null; } },
    Conf: { ...config, listTable: { category: 'tags' } },
    window: { withAppAssetVersion: value => value },
    document: { getElementById: id => id === 'listArea' ? listArea : null,
        querySelectorAll: () => [], createElement },
    mapLibre: { map: { getLayer() {}, getSource() {} } },
    poiStatusCont: { getRecord: () => ({}) }
});
vm.runInContext(fs.readFileSync('lib/listtable.js', 'utf8') + '\nthis.table = new ListTable();', context);
context.table.init();
const getParts = () => listArea.children.at(-1).children[0].children[0].children[0].children;
context.table.makeListArea([['node/1', '宗教施設', '長福寺', 'buddhist', 'jodo_shinshu', '1662', '', 'amenity=place_of_worship', ['historic_area'], 'buddhist.png']]);
let parts = getParts();
assert.equal(parts.length, 5);
assert.match(parts[0].className, /list-facility-ref/);
assert.match(parts[1].className, /list-facility-name/);
assert.equal(parts[1].children.at(-1).textContent, '長福寺');
assert.deepEqual(parts.slice(2).map(p => p.children[0].textContent), ['宗教：仏教', '宗派：浄土真宗', '年代：1662']);
context.table.makeListArea([['node/2', '図書館', '市立図書館', '', '', '', '', 'amenity=library', ['historic_poi'], 'library.png']]);
assert.equal(getParts().length, 2, 'missing metadata does not produce empty labels');
assert.equal(context.table.formatColumnValue('soto;unknown_sect', config.list.columns.style[3]), '曹洞宗・unknown_sect');
assert.equal(context.table.formatColumnValue('soto;; ', config.list.columns.style[3]), '曹洞宗');
context.glot.lang = 'en';
assert.equal(context.table.formatColumnValue('buddhist;shinto', config.list.columns.style[2]), 'Buddhism, Shinto');
assert.equal(context.table.formatColumnValue('catholic', config.list.columns.style[3]), 'Catholic');
console.log('PASS: facility name/category roles, translated metadata, absent values, multiple values and unknown denominations');

// Reproduce a nameless artwork through the ordinary POI row/fallback path.
context.Conf.listTable.nameFallback = 'category';
context.Conf.osm = { historic_poi: { expression: { poiView: true } } };
context.list_category = { value: '-' };
context.list_keyword = { value: '' };
context.poiCont = {
    makeList: () => [['node/3', 'アート作品', '', '', '', '', '', 'tourism=artwork', ['historic_poi'], 'sculpture.png']],
    get_osmid: () => ({ geojson: { properties: { tourism: 'artwork' } } }),
    getCatnames: () => ['アート作品', '', 'tourism=artwork', '']
};
context.table.makeList();
parts = getParts();
assert.equal(parts.length, 1, 'category replaces the missing name once');
assert.match(parts[0].className, /list-facility-name/);
assert.equal(parts[0].children.at(-1).textContent, 'アート作品');
assert.equal(parts[0].children.filter(child => child.tagName === 'img').length, 1);
assert.equal(parts[0].children[0].src, './icon/sculpture.png', 'fallback title retains the artwork icon');
console.log('PASS: nameless artworks retain their icon when the name column is suppressed');
