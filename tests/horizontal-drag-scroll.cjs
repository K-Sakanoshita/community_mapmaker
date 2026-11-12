const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const context=vm.createContext({});
vm.runInContext(fs.readFileSync('lib/winlib.js','utf8')+'\nthis.win=new WinCont();',context);
const handlers={},classes=new Set(),captured=new Set();
const element={scrollLeft:30,scrollWidth:900,clientWidth:300,
 classList:{add:name=>classes.add(name),remove:name=>classes.delete(name)},
 addEventListener(type,fn,capture){handlers[type]=fn;if(type==='click')assert.equal(capture,true);},
 setPointerCapture:id=>captured.add(id),hasPointerCapture:id=>captured.has(id),releasePointerCapture:id=>captured.delete(id)};
context.win.enableHorizontalDrag(element);
const event=(values={})=>({pointerType:'mouse',pointerId:1,button:0,buttons:1,clientX:200,detail:1,
 preventDefault(){this.prevented=true;},stopImmediatePropagation(){this.stopped=true;},...values});
handlers.pointerdown(event());handlers.pointermove(event({clientX:197}));
assert.equal(element.scrollLeft,30);assert.equal(captured.size,0,'small jitter preserves ordinary button target');
handlers.pointerup(event());let click=event();handlers.click(click);assert(!click.stopped,'ordinary clicks select a date');
handlers.pointerdown(event());handlers.pointermove(event({clientX:120}));
assert.equal(element.scrollLeft,110);assert(classes.has('is-dragging'));assert(captured.has(1));
handlers.pointerup(event());assert(!classes.has('is-dragging'));assert.equal(captured.size,0);
click=event();handlers.click(click);assert(click.stopped&&click.prevented,'drag release cannot select a date');
handlers.pointerdown(event());handlers.pointerup(event());click=event();handlers.click(click);assert(!click.stopped,'next click works');
handlers.pointerdown(event());handlers.pointermove(event({clientX:100}));handlers.pointerup(event());
click=event({detail:0});handlers.click(click);assert(!click.stopped,'keyboard activation remains enabled');
const before=element.scrollLeft;
handlers.pointerdown(event({pointerType:'touch'}));handlers.pointermove(event({pointerType:'touch',clientX:100}));assert.equal(element.scrollLeft,before,'touch keeps native scrolling');
handlers.pointerdown(event({button:2}));handlers.pointermove(event({clientX:100}));assert.equal(element.scrollLeft,before,'right mouse button does not scroll');
handlers.pointerdown(event());handlers.pointermove(event({clientX:100}));handlers.pointercancel(event());assert(!classes.has('is-dragging'));
handlers.pointerdown(event());handlers.pointermove(event({buttons:0,clientX:100}));assert(!classes.has('is-dragging'),'release outside before capture resets the gesture');
console.log('PASS: drag scroll, click/jitter distinction, release suppression, next click, keyboard, touch, right-click and cancellation');
