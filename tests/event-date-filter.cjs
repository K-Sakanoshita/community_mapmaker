const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const config = JSON.parse(fs.readFileSync('tests/fixtures/juso-event-date-filter.json', 'utf8'));
const activities = [
    { id: 'first', category: 'イベント', event_dates: ['2027-01-01'] },
    { id: 'second', category: 'イベント, アート展示', event_dates: ['2027-01-02'] },
    { id: 'missing', category: 'イベント', eventdate: '2027-01-01' },
    { id: 'art', category: 'アート展示', event_dates: ['2027-01-01'] },
    { id: 'override', category: 'イベント', event_dates: ['2027-01-01'] },
    { id: 'empty', category: 'イベント', event_dates: ['2027-01-01'] }
];
const elements = {
    eventDateFilter: { hidden: true, dataset: {}, children: [], setAttribute() {},
        replaceChildren() { this.children = []; }, append(button) { this.children.push(button); } },
    listArea: { addEventListener() {} }
};
const context = vm.createContext({
    console, document: { getElementById: id => elements[id], createElement: () => ({ dataset: {}, setAttribute(key, value) { this[key] = value; }, addEventListener(type, callback) { this[type] = callback; } }) },
    window: {}, list_category: { value: 'イベント' }, list_keyword: { value: '' },
    Conf: { eventDateFilter: { use: true, category: 'イベント', dates: ['2027-01-01', '2027-01-02', '2027-01-03'],
        activityDates: { override: ['2027-01-02'], empty: [] } },
        listTable: { category: 'activity', target: 'activity' }, etc: {}, selectItem: {},
        list: { columns: { actFields: ['id', 'title'], poiFields: ['id'] } } },
    poiCont: { makeList: () => activities.map(a => [a.id, '共通タイトル', '', [], 'icon']),
        get_actid: id => activities.find(a => a.id === id), get_osmid() {} },
    cMapMaker: {}, mapLibre: {}, glot: { lang: 'ja' }
});
vm.runInContext(fs.readFileSync('lib/listtable.js', 'utf8') + '\nthis.table = new ListTable();', context);
const table = context.table;
const ids = () => Array.from(table.getMarkerList(), row => row[0]);
table.init(); table.makeList(false);
assert.equal(elements.eventDateFilter.hidden, false);
assert.equal(elements.eventDateFilter.children.length, 4);
assert.equal(ids().length, 5, 'all dates includes undated event records');
table.eventDate = '2027-01-01'; table.makeList(false);
assert.deepEqual(ids(), ['first'], 'structured dates match; overrides and explicit empty arrays win');
assert.deepEqual(activities.filter(a => table.matchesSelectedEventDate(a)).map(a => a.id), ['first'],
    'facility details share dates, event category, explicit overrides and empty-array rules');
assert.equal(table.matchesSelectedEventDate(undefined), false);

table.eventDate = '2027-01-02'; table.makeList(false);
assert.deepEqual(ids(), ['second', 'override']);
assert.equal(elements.eventDateFilter.children[2]['aria-pressed'], 'true');
assert.equal(elements.eventDateFilter.children[1]['aria-pressed'], 'false');
let clickedDate;
context.cMapMaker.selectEventDate = date => { clickedDate = date; };
elements.eventDateFilter.children[1].click();
assert.equal(clickedDate, '2027-01-01', 'buttons invoke the date selection action');
table.filterCategory(['イベント'], false);
assert.deepEqual(ids(), ['second', 'override'], 'category rebuild after map movement preserves date');
context.list_keyword.value = '共通'; table.makeList(false);
assert.deepEqual(ids(), ['second', 'override'], 'keyword search keeps date and event constraints');
table.filterCategory(['イベント'], false);
assert.deepEqual(ids(), ['second', 'override']);
context.list_keyword.value = '';
table.eventDate = '2027-01-03'; table.makeList(false);
assert.deepEqual(ids(), [], 'a day without events clears marker input');
context.list_category.value = 'アート展示'; table.makeList(false);
assert.equal(elements.eventDateFilter.hidden, false, 'date buttons remain available outside the event category');
assert.equal(table.eventDate, '');
assert.deepEqual(ids(), ['second', 'art'], 'other categories ignore date');
assert.equal(activities.filter(a => table.matchesSelectedEventDate(a)).length, activities.length, 'details remain unfiltered without selected date');
context.list_category.value = 'イベント'; table.makeList(false);
assert.equal(ids().length, 5, 'returning to events starts with all dates');
context.Conf.eventDateFilter.use = false; table.makeList(false);
assert.equal(elements.eventDateFilter.hidden, true);
assert.equal(ids().length, 5);

// Real schedule expectations are kept independent of the configured date mapping.
const expected = {
    21: ['2236', '1508', '1506', '647', '614', '603'],
    22: ['2236', '1509', '718', '603'],
    23: ['2236', '718', '634', '617', '603'],
    24: ['603'], 25: ['639', '603'], 26: ['623', '603'],
    27: ['650', '629', '603', '599'],
    28: ['1507', '1504', '1498', '718', '647', '642', '629', '603'],
    29: ['1496', '734', '629', '603']
};
activities.splice(0, activities.length, ...Object.keys(config.activityDates).map(id => ({ id, category: 'イベント' })));
context.Conf.eventDateFilter = config;
table.makeList(false);
assert.equal(elements.eventDateFilter.children.length, 10);
for (const [day, expectedIds] of Object.entries(expected)) {
    table.eventDate = `2026-11-${day}`;
    table.makeList(false);
    assert.deepEqual(ids().sort(), expectedIds.map(id => `WP/${id}`).sort(), `schedule for November ${day}`);
    assert.deepEqual(activities.filter(a => table.matchesSelectedEventDate(a)).map(a => a.id).sort(), expectedIds.map(id => `WP/${id}`).sort(), `detail schedule for November ${day}`);
}
console.log('PASS: optional UI, category/date/keyword filtering, overrides, empty results and all nine schedule dates');

// Wildcard mode also applies structured dates to non-event categories.
activities.splice(0, activities.length,
    { id: 'shop', category: 'お店', event_dates: ['2027-01-01'] },
    { id: 'event', category: 'イベント', event_dates: ['2027-01-02'] },
    { id: 'undated', category: 'お店' });
context.Conf.eventDateFilter = { use: true, category: '*', dates: ['2027-01-01', '2027-01-02'] };
context.list_category.value = 'お店';
table.eventDate = '2027-01-01'; table.makeList(false);
assert.equal(table.eventDate, '2027-01-01');
assert.deepEqual(ids(), ['shop']);
assert.equal(table.matchesSelectedEventDate(activities[0]), true);
assert.equal(table.matchesSelectedEventDate(activities[1]), false);
assert.equal(table.matchesSelectedEventDate(activities[2]), false);
console.log('PASS: all-category date filtering includes dated shops and excludes undated records');
