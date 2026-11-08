const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
    constructor() { this.children = []; this.events = {}; this.attrs = {}; }
    append(...items) { this.children.push(...items); }
    setAttribute(key, value) { this.attrs[key] = value; }
    addEventListener(key, listener) { this.events[key] = listener; }
}
let zoom = 15, opened;
const events = new Map();
const map = { getZoom: () => zoom, on: (key, cb) => events.set(key, cb), off: (key, cb) => { if (events.get(key) === cb) events.delete(key); } };
const markers = [];
class Marker {
    constructor(options) { this.element = options.element; markers.push(this); }
    setLngLat(value) { this.coordinates = value; return this; }
    addTo(value) { this.map = value; return this; }
    remove() { this.removed = true; }
}
const context = vm.createContext({ console, URL, document: { baseURI:'https://example.org/map/', createElement: () => new Element() }, window: {}, glot: { get: key => 'localized:' + key } });
vm.runInContext(fs.readFileSync('lib/imageviewer.js', 'utf8') + '\nImageViewer.open = value => this.opened = value; this.viewer = ImageViewer;', context);
vm.runInContext(fs.readFileSync('lib/mapimagelinks.js', 'utf8') + '\nthis.Controller = MapImageLinks;', context);
const controller = new context.Controller({ Marker, viewer: context.viewer });
const config = { use: true, minZoom: 13, maxZoom: 19, items: [
    { titleKey:'brochure', coordinates:[135,34], links:[{titleKey:'map', image:'./full.jpg',thumbnail:'./small.jpg'}, {image:'javascript:alert(1)'}, {image:'./full2.jpg',thumbnail:'file:///tmp/x'}] },
    { coordinates:[999,34], links:[{image:'./bad.jpg'}] },
    { use:false, coordinates:[135,34], links:[{image:'./hidden.jpg'}] }
] };
controller.init(map, config);
assert.equal(controller.boards.length, 1);
const board = controller.boards[0];
assert.equal(board.element.attrs['aria-label'], 'localized:brochure');
const links = board.element.children[1];
assert.equal(links.children.length,1);
assert.equal(links.children[0].children[0].src,'https://example.org/map/small.jpg');
links.children[0].events.click();
assert.equal(context.opened.image,'https://example.org/map/full.jpg');
assert.equal(context.opened.title,'localized:map');
let stopped=false;board.element.events.click({stopPropagation(){stopped=true;}});assert.equal(stopped,true);
assert.equal(board.element.hidden,false);
zoom=12;events.get('zoom')();assert.equal(board.element.hidden,true);
zoom=19;events.get('zoom')();assert.equal(board.element.hidden,true);
zoom=15;events.get('zoom')();assert.equal(board.element.hidden,false);
controller.init(map,{use:false});
assert.equal(markers[0].removed,true);assert.equal(events.size,0);assert.equal(controller.boards.length,0);
console.log('PASS: configurable geographic image links, safe sources, shared viewer, zoom visibility and cleanup');
