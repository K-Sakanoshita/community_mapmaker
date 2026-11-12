const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('cmapmaker.js','utf8');
const method=source.slice(source.indexOf('    viewDetail('),source.indexOf('    syncPoiStatus('));
const node={"tags": {"information": "board", "name": "小竹医院前 掲示板", "operator": "小竹医院", "tourism": "information"}};
let tags={id:'node/13295784146',...node.tags},name='',output;
const context=vm.createContext({
 console:{log(){},warn(){}},Conf:{icon:{fgPath:'icons'},menu:{modal:[],activities:[]},etc:{localSave:''}},
 poiCont:{get_osmid:()=>({geojson:{properties:tags},targets:[]}),getActlistByOsmid:()=>[],
  getCatnames:()=>['案内','案内板'],getIcon:()=>'information.png',getOSMname:()=>name},
 glot:{lang:'ja',get:key=>key},
 listTable:{getSelCategory:()=>['イベント'],recordView(){}},
 areaSearchController:{matchReasonHtml:()=>''},
 winCont:{setSidebar:async()=>{},menu_make(){},setProgress(){},makeDetail:params=>{output=params;}},
 mapLibre:{viewMiniMap(){}},location:{pathname:'/',hash:''},history:{replaceState(){}},
 document:{getElementById:()=>({scrollTo(){}})}
});
vm.runInContext(fs.readFileSync('detail/osmbasic.js','utf8')+'\nthis.osmBasic=new OSMbasic();',context);
context.osmBasic.makeAreaFacilities=()=>'';
vm.runInContext('this.cMapMaker=({loadDetailLibraries:async()=>{},withIndoorLevel:value=>value,changeMode(){},'+method+'});',context);
(async()=>{
 const original=JSON.stringify(tags);
 assert.match(context.osmBasic.make(tags),/案内\(案内板\)<\/div>/);
 assert.equal(JSON.stringify(tags),original,'basic rendering preserves source tags');
 for(const [venue,operator,expected] of [
  ['',node.tags.operator,'案内 / 小竹医院'],
  ['掲示板','小竹医院','掲示板 / 小竹医院'],
  ['小竹医院','小竹医院','小竹医院'],
  ['掲示板',undefined,'掲示板'],['掲示板','  ','掲示板'],
  ['掲示板','A&B <test>','掲示板 / A&amp;B &lt;test&gt;']
 ]){
  name=venue;tags={id:'node/13295784146',operator};await context.cMapMaker.viewDetail(tags.id);
  assert.equal(output.title.replace(/^<img[^>]*>/,''),expected);
  assert.match(output.message,/案内\(案内板\)<\/div>/,'body shows type/subtype only');
  assert.doesNotMatch(output.message,/小竹医院|A&amp;B/,'operator appears in title only');
 }
 console.log('PASS: operator in detail title only, category/name fallback, duplicate prevention, escaping and unchanged body type');
})().catch(error=>{console.error(error);process.exitCode=1;});
