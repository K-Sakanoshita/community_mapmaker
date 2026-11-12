const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const available = new Set(['node/1', 'node/2', 'node/photo']);
let queries = 0, queryLayers;
const map = {
    getLayer: id => ['marker-bg-normal', 'marker-fg-normal'].includes(id),
    queryRenderedFeatures(point, options) {
        queries++; queryLayers = options.layers;
        assert.equal(JSON.stringify(point), '[20,30]');
        return [{ properties: { id: 'node/1' } }, { properties: { id: 'node/2' } },
            { id: 'node/1' }, { properties: { id: 'missing' } }];
    }
};
const popups = [];
const element = () => ({ children: [], appendChild(child) { this.children.push(child); },
    addEventListener(type, handler) { this[type] = handler; } });
const context = vm.createContext({
    console, mapLibre: { map },
    document: { createElement: element },
    maplibregl: { Popup: class {
        constructor() { popups.push(this); }
        setLngLat(value) { this.lnglat = value; return this; }
        setDOMContent(value) { this.content = value; return this; }
        addTo(value) { this.map = value; return this; }
        remove() { this.removed = true; }
    } }
});
vm.runInContext(fs.readFileSync('lib/poilib.js', 'utf8') + '\nthis.poi = new PoiCont();', context);
context.poiCont = context.poi;
context.poi.get_osmid = id => available.has(id) ? {} : undefined;
context.poi.photoMarkers = { getIdsAtPoint: () => ['node/photo', 'node/2'] };
const ids = context.poi.getMarkerSelectionIds({ point: { x: 20, y: 30 } }, 'node/1');
assert.equal(JSON.stringify(ids), '["node/1","node/2","node/photo"]', 'normal, photo and duplicate layers produce unique visible facility IDs');
assert.equal(JSON.stringify(queryLayers), '["marker-bg-normal","marker-fg-normal"]');
assert.equal(queryLayers.some(id => /shadow|text|favorite/.test(id)), false, 'labels and shadows do not create unrelated candidates');
assert.equal(JSON.stringify(context.poi.getMarkerSelectionIds({}, 'node/1')), '["node/1"]');
assert.equal(queries, 1, 'non-pointer fallback does not query an invalid screen position');

vm.runInContext(fs.readFileSync('lib/mapfeature3d.js', 'utf8') + '\nthis.Picker = MapFeature3D;', context);
let selected;
const picker = new context.Picker({ getSelectionTitle: () => 'Choose', getFeatureLabel: id => 'Facility ' + id,
    onSelect: id => { selected = id; } });
const event = { point: { x: 20, y: 30 }, lngLat: [135, 34], originalEvent: {} };
assert.equal(picker.handleMarkerClick(event, 'node/1', ids, map), true, 'chooser works even when 3D rendering is disabled');
assert.equal(popups.length, 1);
assert.equal(popups[0].map, map);
assert.equal(popups[0].content.children.length, 4);
assert.equal(popups[0].content.children[2].textContent, 'Facility node/2');
assert.equal(picker.handleMarkerClick(event, 'node/1', ids, map), true);
assert.equal(popups.length, 1, 'multiple native layer callbacks for one click open one chooser');
assert.equal(picker.handleMarkerClick({ ...event, originalEvent: {} }, 'node/1', ['node/1'], map), false, 'a lone facility keeps direct selection');
assert.equal(JSON.stringify(picker.getSelectionIds('node/1', 'model/1', ['node/photo', 'node/1'])), '["node/1","node/photo","model/1"]', 'existing model candidate joins marker candidates');
popups[0].content.children[2].click();
Promise.resolve().then(() => {
    assert.equal(selected, 'node/2');
    assert.equal(popups[0].removed, true);
    console.log('PASS: mixed marker hit testing, deduplication, one chooser per click, selection without 3D, model coexistence and single-marker navigation');
}).catch(error => { console.error(error); process.exitCode = 1; });
