const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.attrs = {}; this.events = {}; this.className = ''; }
    appendChild(node) { this.children.push(node); return node; }
    setAttribute(key, value) { this.attrs[key] = value; }
    addEventListener(type, fn) { this.events[type] = fn; }
    set innerHTML(html) {
        this.html = html; this.children = [];
        if (html.startsWith('<a ')) {
            const a = new Element('a'); a.className = 'dropdown-item'; a.appendChild(new Element('span'));
            const span = new Element('span'); span.className = 'dropdown-item';
            this.children.push(a, span);
        }
    }
    get innerHTML() { return this.html; }
    insertAdjacentHTML(position, html) { const node = new Element('div'); node.html = html; this.appendChild(node); }
    querySelector(selector) {
        const [tag, cls] = selector.split('.');
        return descendants(this).find(node => node.tagName === tag && (!cls || node.className.split(' ').includes(cls)));
    }
    cloneNode() {
        const clone = new Element(this.tagName); clone.className = this.className; clone.attrs = {...this.attrs}; clone.html = this.html;
        clone.children = this.children.map(node => node.cloneNode()); return clone;
    }
}
function descendants(root) { return root.children.flatMap(node => [node, ...descendants(node)]); }
const root = new Element('div');
const configuration = vm.runInNewContext('('+fs.readFileSync('data/config-user.jsonc','utf8')+')');
configuration.menu.mainSystem = JSON.parse(fs.readFileSync('tests/fixtures/juso-menu.json', 'utf8'));
configuration.poiView.editZoom = { amenity: 14 };
const labels = {menu_other:'その他',editMode_label:'編集モード',external:'External',local:'Local'};
const toggles = [];
const context = vm.createContext({
    Conf: {...configuration, menu_list:{template:"<a class='dropdown-item'><span></span></a><span class='dropdown-item'></span>",divider:'<div class="dropdown-divider"></div>'}},
    document:{getElementById:()=>root,createElement:tag=>new Element(tag)},
    glot:{get:key=>labels[key]??key},
    cMapMaker:{editModeSwitchEnabled:true,setEditMode:value=>toggles.push(value)}
});
vm.runInContext(fs.readFileSync('lib/winlib.js','utf8')+'\nthis.controller=new WinCont();',context);
context.controller.menu_make([
    {'glot-model':'external',linkto:'https://example.test',divider:true},
    {'glot-model':'local',linkto:'javascript:local()'},
    {linkto:'html:<b>Raw HTML</b>'},
    ...configuration.menu.mainSystem
], 'menu');
let details = descendants(root).filter(node=>node.tagName==='details');
assert.equal(details.length,1);
assert.equal(details[0].children[0].children[0].textContent,'その他');
const edits = descendants(root).filter(node=>node.id==='editModeButton');
assert.equal(edits.length,1,'one configured edit switch is rendered');
assert.equal(edits[0].attrs['aria-checked'],'false');
edits[0].events.click(); assert.deepEqual(toggles,[true]);
let stopped = false;
details[0].children[0].events.click({stopPropagation(){stopped=true;}});
assert.ok(stopped,'expanding a group does not close its Bootstrap parent');
const links = descendants(root).filter(node=>node.tagName==='a');
assert.equal(links[0].attrs.target,'_new');
assert.equal(links[1].attrs.target,'');
assert.equal(links[2].attrs.href,'javascript:poiStatusCont.export()');
assert.equal(links[3].attrs.href,'javascript:poiStatusCont.import()');
assert.ok(root.children.some(node=>node.innerHTML==='<b>Raw HTML</b>'),'legacy raw HTML entries remain supported');
assert.ok(descendants(details[0]).some(node=>node.html?.includes('dropdown-divider')));
context.Conf.etc.editMode = true;
context.controller.menu_make(configuration.menu.mainSystem,'menu');
assert.equal(descendants(root).filter(node=>node.id==='editModeButton').length,1,'rebuilding does not duplicate items');
assert.equal(descendants(root).find(node=>node.id==='editModeButton').attrs['aria-checked'],'true');
context.cMapMaker.editModeSwitchEnabled = false;
context.controller.menu_make(configuration.menu.mainSystem,'menu');
assert.equal(descendants(root).filter(node=>node.id==='editModeButton').length,0,'fixed mode hides the switch');
assert.equal(descendants(root).filter(node=>node.tagName==='a').length,2,'data tools remain available');
context.controller.menu_make([{'glot-model':'menu_other',children:[{action:'editMode'}]}],'menu');
assert.equal(root.children.length,0,'empty groups are omitted');
context.controller.menu_make([{'glot-model':'menu_other',children:[{'glot-model':'menu_other',children:[{linkto:'javascript:local()','glot-model':'local'}]}]}],'menu');
assert.equal(descendants(root).filter(node=>node.tagName==='details').length,2,'nested submenus are supported');
console.log('PASS: configurable nested menus, edit switch visibility/state, data tools, parent click handling and legacy entries');
