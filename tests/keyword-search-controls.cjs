const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
    constructor() { this.events = {}; this.attrs = {}; this.children = []; this.value = ''; this.hidden = true;
        this.classes = new Set(); this.classList = { toggle: (key, on) => on ? this.classes.add(key) : this.classes.delete(key) }; }
    addEventListener(type, fn) { this.events[type] = fn; }
    setAttribute(key, value) { this.attrs[key] = value; }
    removeAttribute(key) { delete this.attrs[key]; }
    replaceChildren(...children) { this.children = children; }
    scrollIntoView() {}
}
const input = new Element(), category = new Element(), suggestions = new Element(), button = new Element(), icon = new Element();
const elements = { list_keyword_suggestions: suggestions, list_keyword_button: button, list_keyword_search: icon };
const timers = new Map(), searches = [], selections = [], flights = [];
let nextTimer = 0, suggestionCalls = 0;
const Stub = class {};
const context = vm.createContext({ console, URL, winCont: {},
    setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; }, clearTimeout(id) { timers.delete(id); },
    window: { APP_LANGUAGE: 'ja' }, document: { getElementById: id => elements[id] ?? null, createElement: () => new Element() },
    list_keyword: input, list_category: category,
    IndoorControl: Stub, Glottologist: class { get(key) { return key; } }, Basic: Stub, PoiStatusCont: Stub,
    OverPassControl: Stub, Maplibre: Stub, GeoCont: Stub, ListTable: Stub, PoiCont: Stub,
    MapFeature3D: Stub, PlaygroundModelFactories: {}, GoogleSpreadSheet: Stub, HistoricalNewsController: Stub,
    NewsTicker: Stub, ChangeController: Stub, AreaFeatureLinker: Stub, AreaSearchController: Stub, ListActionButtons: Stub
});
vm.runInContext(fs.readFileSync('cmapmaker.js', 'utf8') + '\nthis.api = { maker: cMapMaker, table: listTable, map: mapLibre, area: areaSearchController, geo: geoCont, win: winCont };', context);
const { maker, table, map, area, geo, win } = context.api;
const camera = { center: [135, 34], zoom: 15, bearing: 20, pitch: 30 };
map.on = () => {};
map.map = { getCenter: () => camera.center, getZoom: () => camera.zoom, getBearing: () => camera.bearing,
    getPitch: () => camera.pitch, flyTo: value => flights.push(value) };
table.keywordSuggestions = query => { suggestionCalls++; return query.trim() ? ['新大阪の施設', '新三国の施設'] : []; };
table.filterKeyword = query => searches.push(query);
table.getFilterList = () => [['node/1']]; table.select = id => selections.push(id);
area.renderDisplayStatus = () => {}; geo.writePoiCircle = () => {};
maker.changeMode = mode => assert.equal(mode, 'list'); maker.clearDatail = () => { maker.detail = null; };
win.sidebarSize = 2;
const flush = () => { for (const [id, fn] of [...timers]) { timers.delete(id); fn(); } };
const key = (value, isComposing = false) => input.events.keydown({ key: value, isComposing, preventDefault() {} });
maker.addEvents();
input.value = '新'; input.events.input({ isComposing: true });
assert.equal(suggestionCalls, 0, 'IME conversion does not update prematurely');
key('Enter', true); assert.equal(searches.length, 0, 'IME confirmation does not submit search');
input.events.compositionend();
assert.equal(suggestions.hidden, false); assert.equal(suggestions.children.length, 2);
assert.equal(input.attrs['aria-expanded'], 'true');
key('ArrowDown'); assert.equal(input.attrs['aria-activedescendant'], 'keyword_suggestion_0');
key('Enter'); assert.equal(input.value, '新大阪の施設'); assert.equal(suggestions.hidden, true);
assert.equal(icon.classes.has('fa-xmark'), true);
flush(); assert.deepEqual(searches, ['新大阪の施設']); assert.deepEqual(selections, ['node/1']);
maker.searchKeyword('another pending query');
maker.detail = {}; maker.keywordButtonAction();
assert.equal(timers.size, 0, 'clear cancels pending search');
assert.equal(input.value, ''); assert.equal(maker.detail, null);
assert.equal(searches.at(-1), ''); assert.equal(icon.classes.has('fa-search'), true);
assert.equal(JSON.stringify(flights[0]), JSON.stringify({ ...camera, essential: true }), 'clear restores camera before first search');
input.value = '新'; input.events.input({ isComposing: false }); key('Escape');
assert.equal(suggestions.hidden, true); assert.equal(input.attrs['aria-expanded'], 'false');
input.events.focus(); suggestions.children[1].events.click(); flush();
assert.equal(searches.at(-1), '新三国の施設', 'mouse/touch selection submits chosen text');
assert.equal(selections.length, 2);
console.log('PASS: IME composition, suggestion keyboard/click/Escape, search/clear icon, cancelled search and camera restore');
