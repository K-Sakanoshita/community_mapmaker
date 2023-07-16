/*	Main Process */
"use strict";

// Global Variable
var Conf = {};					// Config Praams
const GTAG = '<script async src="https://www.googletagmanager.com/gtag/js?id=';
const LANG = (window.navigator.userLanguage || window.navigator.language || window.navigator.browserLanguage).substr(0, 2) == "ja" ? "ja" : "en";
const FILES = [
	"./baselist.html", "./data/config-user.jsonc", './data/config-system.jsonc', './data/config-activities.jsonc',
	`./data/marker.jsonc`, `./data/category-${LANG}.jsonc`, `data/listtable-${LANG}.jsonc`,
	`./data/glot-custom.jsonc`, `data/glot-system.jsonc`, './data/overpass-system.jsonc', `./data/overpass-custom.jsonc`];
const glot = new Glottologist();
var modal_takeout = new modal_Takeout();
var modal_activities = new modal_Activities();
var modal_wikipedia = new modal_Wikipedia();
var basic = new Basic();
var OvPassCnt = new OverPassControl();
var MapLibre = new Maplibre();
var GeoCont = new Geocont();
var listTable = new ListTable();
var cMapMaker = new CMapMaker();

// initialize
console.log("Welcome to Community Map Maker.");
console.log("initialize: Start.");
window.addEventListener("DOMContentLoaded", function () {
	let jqXHRs = [];
	for (let key in FILES) { jqXHRs.push($.get(FILES[key])) };
	$.when.apply($, jqXHRs).always(function () {
		let basehtml = arguments[0][0];												// Get Menu HTML
		for (let i = 1; i <= 6; i++) {
			let types = typeof arguments[i][0];
			Conf = Object.assign(Conf, types == "string" ? JSON5.parse(arguments[i][0]) : arguments[i][0]);
		};
		Conf.category_keys = Object.keys(Conf.category);						// Make Conf.category_keys
		Conf.category_subkeys = Object.keys(Conf.category_sub);					// Make Conf.category_subkeys
		glot.data = Object.assign(glot.data, JSON5.parse(arguments[7][0]));		// import glot data
		glot.data = Object.assign(glot.data, JSON5.parse(arguments[8][0]));		// import glot data
		Conf = Object.assign(Conf, JSON5.parse(arguments[9][0]));				// import OverPass
		Conf.osm = Object.assign(Conf.osm, JSON5.parse(arguments[10][0]).osm);	// import OverPass
		window.onresize = winCont.window_resize;    							// 画面サイズに合わせたコンテンツ表示切り替え
		document.title = glot.get("site_title");								// Title
		winCont.window_resize();												// Set Window Size(mapidのサイズ指定が目的)
		winCont.splash(true);
		listTable.init();

		Promise.all([
			gSheet.get(Conf.google.AppScript), cMapMaker.load_static(), MapLibre.init(Conf)	// get_zoomなどMapLibreの情報が必要なためMapLibre.init後に実行
		]).then(results => {
			// MapLibre add control
			MapLibre.addControl("bottom-left", "zoomlevel", "");
			MapLibre.addControl("top-left", "baselist", basehtml, "Maplibre-control m-0 p-0");			// Make: base list
			MapLibre.addNavigation("bottom-right");
			MapLibre.addControl("bottom-right", "maplist", "<button onclick='cMapMaker.changeMap()'><i class='fas fa-layer-group fa-lg'></i></button>", "maplibregl-ctrl-group");
			MapLibre.addControl("bottom-right", "global_status", "", "text-information");	// Make: progress
			MapLibre.addControl("bottom-right", "global_spinner", "", "spinner-border text-primary d-none");
			MapLibre.addScale("bottom-left");
			winCont.playback(Conf.listTable.playback.view);		// playback control view:true/false
			winCont.download(Conf.listTable.download);			// download view:true/false
			cMapMaker.mode_change("map");									// initialize last_modetime
			winCont.menu_make(Conf.menu, "main_menu");
			cMapMaker.init();
			glot.render();

			const init_close = function () {
				let eventMoveMap = cMapMaker.eventMoveMap.bind(cMapMaker);
				eventMoveMap().then(() => {
					winCont.splash(false);
					if (location.search !== "") {    							// 引数がある場合
						let search = location.search.replace(/[?&]fbclid.*/, '').replace(/%2F/g, '/');  // facebook対策
						search = search.replace('-', '/').replace('=', '/').slice(1);
						search = search.slice(-1) == "/" ? search.slice(0, -1) : search;				// facebook対策(/が挿入される)
						let params = search.split('&');	// -= -> / and split param
						history.replaceState('', '', location.pathname + "?" + search + location.hash);
						for (const param of params) {
							let keyv = param.split('/');
							switch (keyv[0]) {
								case "category":
									listTable.selectCategory(keyv[1]);
									cMapMaker.eventChangeCategory();
									break;
								case "node":
								case "way":
								case "relation":
									let subparam = param.split('.');					// split child elements(.)
									cMapMaker.viewDetail(subparam[0], subparam[1]);
									break;
							};
						};
					};
				});
			}

			// save gSheet and osmdata
			poiCont.set_actjson(results[0]);
			let osmids = poiCont.pois().acts.map(act => { return act.osmid });
			osmids = osmids.filter(Boolean);
			if (osmids.length > 0 && !Conf.static.mode) {
				OvPassCnt.get_osmids(osmids).then(geojson => {
					poiCont.add_geojson(geojson);
					init_close();
				});
			} else {
				init_close();
			}

		});
		console.log("initial: End.");
	});
});
