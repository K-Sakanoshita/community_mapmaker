const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

let zoom = 16;
let bounds = {};
const activities = [
    { id: 'event/1', osmid: 'node/1' },
    { id: 'event/2', osmid: 'node/2', lnglat: [135, 34] },
    { id: 'event/3', osmid: 'node/3' },
    { id: 'event/4', osmid: 'node/4' }
];
const records = new Map([
    ['node/1', { targets: ['activity'], lnglat: [135, 34] }],
    ['node/3', { targets: ['activity'], lnglat: [0, 0] }],
    ['node/4', { targets: ['activity'] }]
]);
const context = vm.createContext({
    console,
    Conf: { activity: { targetName: 'activity' }, osm: {} },
    document: { getElementById: () => ({ addEventListener() {} }) },
    poiCont: { pois: () => ({ acts: activities }), get_osmid: id => records.get(id) },
    cMapMaker: { getPoiZoom: target => target === 'activity' ? 8 : undefined },
    mapLibre: { get_LL: () => bounds, getZoom: () => zoom },
    geoCont: { checkInner: ([lng, lat]) => lng === 135 && lat === 34 }
});
vm.runInContext(fs.readFileSync('lib/listtable.js', 'utf8') + '\nthis.table = new ListTable();', context);
context.table.init();
const rows = activities.map(activity => [activity.id]);
const ids = () => Array.from(context.table.getThumbnailActivities(rows), activity => activity.id);
assert.deepEqual(ids(), ['event/1', 'event/2'], 'include linked and standalone activity images without an OSM category');
assert.deepEqual(Array.from(context.table.getThumbnailActivities([['node/1'], ['event/1']]), activity => activity.id),
    ['event/1'], 'OSM rows include their posts and duplicates are removed');
assert.deepEqual(Array.from(context.table.getThumbnailActivities([])), [], 'exclude posts outside the filtered rows');
records.get('node/1').targets = ['park'];
context.Conf.osm.park = { expression: { poiView: true } };
context.cMapMaker.getPoiZoom = target => target === 'park' ? 15 : undefined;
assert.deepEqual(ids(), ['event/1'], 'retain Playgrounds-style visibility through a displayed OSM category');
context.cMapMaker.getPoiZoom = target => target === 'activity' ? 8 : undefined;
zoom = 7;
assert.deepEqual(ids(), [], 'respect activity zoom threshold');
zoom = 16;
bounds = null;
assert.deepEqual(ids(), [], 'exclude images when map bounds are unavailable');
console.log('PASS: activity thumbnails use activity visibility and retain bounds and zoom filters');
