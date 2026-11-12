const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const Stub = class {};
const button = { disabled: false, setAttribute(name, value) { this[name] = value; } };
const indicator = {};
const context = vm.createContext({ console, URL, setTimeout, clearTimeout,
    window: { APP_LANGUAGE: 'ja' }, winCont: {}, document: { getElementById: id => id === 'editModeButton' ? button : indicator },
    location: { href: 'https://example.test/?category=cafe#map' },
    history: { replaceState(a, b, url) { this.url = url; } },
    list_category: { value: 'cafe' }, list_keyword: { value: 'search' },
    IndoorControl: Stub, Glottologist: Stub, Basic: Stub, PoiStatusCont: Stub,
    OverPassControl: Stub, Maplibre: Stub, GeoCont: Stub, ListTable: Stub, PoiCont: Stub,
    MapFeature3D: Stub, PlaygroundModelFactories: {}, GoogleSpreadSheet: Stub,
    HistoricalNewsController: Stub, NewsTicker: Stub, ChangeController: Stub,
    AreaFeatureLinker: Stub, AreaSearchController: Stub, ListActionButtons: Stub
});
vm.runInContext(fs.readFileSync('cmapmaker.js', 'utf8') + '\nthis.maker = cMapMaker; this.poi = poiCont; this.win = winCont; this.labels = glot;', context);
context.Conf = { etc: { editMode: false } };
context.poi.revision = 0;
const maker = context.maker;
let renders = 0, updates = 0, closed = 0, confirm = false;
maker.clearDatail = () => closed++;
maker.changeMode = mode => { maker.mode = mode; };
maker.refreshLocalFilters = () => { renders++; };
maker.updateView = async () => { updates++; };
context.win.confirm = ({ callback }) => callback(confirm);
context.labels.get = key => key;
(async () => {
    maker.editModeSwitchEnabled = false;
    assert.equal(await maker.setEditMode(true), false, 'fixed mode cannot switch');
    maker.editModeSwitchEnabled = true;
    assert.equal(await maker.setEditMode(true), true);
    assert.equal(context.Conf.etc.editMode, true);
    assert.equal(button['aria-checked'], 'true');
    assert.equal(button.disabled, false);
    assert.equal(context.list_category.value, '');
    assert.equal(context.list_keyword.value, '');
    assert.equal(context.history.url, '/?edit=true#map');
    assert.equal(renders, 1);
    assert.equal(updates, 1);
    maker.mode = 'edit';
    assert.equal(await maker.setEditMode(false), false, 'cancel preserves the form and editing mode');
    assert.equal(context.Conf.etc.editMode, true);
    assert.equal(closed, 1);
    confirm = true;
    assert.equal(await maker.setEditMode(false), true);
    assert.equal(context.Conf.etc.editMode, false);
    assert.equal(button['aria-checked'], 'false');
    assert.equal(indicator.className, 'fa-solid fa-pen-to-square');
    assert.equal(context.poi.revision, 2);
    assert.equal(updates, 2);
    assert.equal(await maker.setEditMode(false), false, 'same mode does not repeat work');
    console.log('PASS: dynamic edit switching, fixed mode, menu state, URL and unsaved form confirmation');
})().catch(error => { console.error(error); process.exitCode = 1; });
