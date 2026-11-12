const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const categories = ['アート展示', 'イベント', 'お店・施設・メニュー', '淀壁'];
const activities = categories.map((category, i) => ({ id: `WP/${i}`, category }));
activities.push({ id: 'WP/multi', category: 'イベント, お店・施設・メニュー' });
const rows = activities.map(activity => [activity.id, '会場', '展示タイトル', '', '',
    'tourism=artwork', ['publicArt'], 'art.png']);
// Neither a category in the title nor a similarly named category is a match.
activities.push({ id: 'WP/other', category: 'お店・施設・メニュー追加' });
rows.push(['WP/other', 'お店・施設・メニュー', '', '', '', '', ['shop'], 'shop.png']);
const context = vm.createContext({
    console,
    Conf: { listTable: { category: 'activity', target: 'activity' },
        list: { columns: { actFields: ['id', '#name', 'title', 'actor', 'eventdate'], poiFields: ['id'] } },
        etc: {}, selectItem: {} },
    document: { getElementById: () => ({ addEventListener() {} }) },
    window: {}, list_category: { value: '-' }, list_keyword: { value: '' },
    poiCont: { makeList: () => rows, get_actid: id => activities.find(act => act.id === id),
        get_osmid: () => undefined },
    cMapMaker: {}, mapLibre: {}, glot: { lang: 'ja' }
});
vm.runInContext(fs.readFileSync('lib/listtable.js', 'utf8') + '\nthis.table = new ListTable();', context);
const table = context.table;
table.init();
const ids = () => Array.from(table.getMarkerList(), row => row[0]);
for (const [i, category] of categories.entries()) {
    context.list_category.value = category;
    table.makeList(false);
    const expected = [`WP/${i}`];
    if (i === 1 || i === 2) expected.push('WP/multi');
    assert.deepEqual(ids(), expected, `${category}: initial list and marker input`);
    table.filterCategory([category], false);
    assert.deepEqual(ids(), expected, `${category}: category refresh preserves markers`);
}
for (const value of ['', '-']) {
    context.list_category.value = value;
    table.makeList(false);
    table.filterCategory([value], false);
    assert.equal(ids().length, rows.length, 'automatic/all selection restores every marker');
}
context.list_category.value = 'お店・施設・メニュー';
context.list_keyword.value = '展示タイトル';
table.makeList(false);
table.filterCategory(['お店・施設・メニュー'], false);
assert.equal(ids().length, 5, 'keyword search still searches across categories');
console.log('PASS: activity categories filter records independently of visible columns and preserve marker rows');
