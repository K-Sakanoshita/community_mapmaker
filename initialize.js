/*	Main Process */
"use strict";

// Global Variable
var Conf = {};					// Config Praams
const GTAG = '<script async src="https://www.googletagmanager.com/gtag/js?id=';
const LANG = (window.navigator.userLanguage || window.navigator.language || window.navigator.browserLanguage).substr(0, 2) == "ja" ? "ja" : "en";
const FILES = [
	"./baselist.html", "./data/config-user.jsonc", './data/config-system.jsonc', './data/config-activities.json',
	`./data/marker.json`, `./data/category-${LANG}.json`, `data/listtable-${LANG}.json`,
	`./data/glot-custom.json`, `data/glot-system.json`, './data/overpass-system.json', `./data/overpass-custom.json`];
const glot = new Glottologist();
var modal_takeout = new modal_Takeout();
var modal_activities = new modal_Activities();
var modal_wikipedia = new modal_Wikipedia();
var basic = new Basic();
var leaflet = new Leaflet();
var GeoCont = new Geocont();

// initialize
console.log("Welcome to MapMaker.");
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
		Conf.category_keys = Object.keys(Conf.category);			// Make Conf.category_keys
		Conf.category_subkeys = Object.keys(Conf.category_sub);		// Make Conf.category_subkeys
		glot.data = Object.assign(glot.data, arguments[7][0]);		// import glot data
		glot.data = Object.assign(glot.data, arguments[8][0]);		// import glot data
		Conf = Object.assign(Conf, arguments[9][0]);				// import OverPass
		Conf.osm = Object.assign(Conf.osm, arguments[10][0].osm);	// import OverPass
		window.onresize = winCont.window_resize;    				// 画面サイズに合わせたコンテンツ表示切り替え
		document.title = glot.get("site_title");					// Title
		winCont.window_resize();									// Set Window Size(mapidのサイズ指定が目的)
		winCont.splash(true);
		listTable.init();
		
		Promise.all([
			gSheet.get(Conf.google.AppScript), cMapmaker.load_static(), leaflet.init()	// get_zoomなどleafletの情報が必要なためleaflet.init後に実行
		]).then(results => {
			// leaflet add control
			leaflet.controlAdd("bottomleft", "zoomlevel", "");
			leaflet.controlAdd("topleft", "baselist", basehtml, "leaflet-control m-1");			// Make: base list
			leaflet.locateAdd();
			leaflet.controlAdd("bottomright", "global_status", "", "text-information");	// Make: progress
			leaflet.controlAdd("bottomright", "global_spinner", "", "spinner-border text-primary d-none");
			winCont.playback(Conf.listTable.playback.view);		// playback control view:true/false
			winCont.download(Conf.listTable.download);			// download view:true/false

			// mouse hover event(baselist mouse scroll)
			baselist.addEventListener("mouseover", () => { map.scrollWheelZoom.disable(); map.dragging.disable() }, false);
			baselist.addEventListener("mouseleave", () => { map.scrollWheelZoom.enable(); map.dragging.enable() }, false);

			// save gSheet and osmdata
			poiCont.set_actjson(results[0]);
			let osmids = poiCont.pois().acts.map(act => { return act.osmid });
			osmids = osmids.filter(Boolean);
			if (osmids.length > 0 && !Conf.static.mode) OvPassCnt.get_osmids(osmids).then(geojson => {
				console.log(geojson);
				poiCont.add_geojson(geojson);
			});

			winCont.window_resize();

			cMapmaker.mode_change("map");									// initialize last_modetime
			winCont.menu_make(Conf.menu, "main_menu");
			glot.render();
			cmap_events.init();
			cmap_events.map_move().then(() => {
				winCont.splash(false);
				if (location.search !== "") {    							// 引数がある場合
					let search = location.search.replace(/[?&]fbclid.*/, '').replace(/%2F/g, '/');  // facebook対策
					search = search.replace('-', '/').replace('=', '/').slice(1);
					search = search.slice(-1) == "/" ? search.slice(0, -1) : search;				// facebook対策(/が挿入される)
					let params = search.split('&');	// -= -> / and split param
					history.replaceState('', '', location.pathname + "?" + search + location.hash);
					for (const param of params) {
						let key = param.split('/')[0];
						let value = param.split('/')[1];
						switch (key) {
							case "category":
								listTable.select_category(value);
								cmap_events.category_change();
								break;
							case "node":
							case "way":
							case "relation":
								let subparam = param.split('.');					// split child elements(.)
								cMapmaker.detail_view(subparam[0], subparam[1]);
								break;
						};
					};
				};
			});
		});

		/* 		if (Conf.google.Analytics !== "") {			// Google Analytics
					let AnalyticsURL = GTAG + Conf.default.GoogleAnalytics + '"></script>';
					document.getElementsByTagName('head').insertAdjacentHTML("beforeend", AnalyticsURL);
					window.dataLayer = window.dataLayer || [];
					function gtag() { dataLayer.push(arguments); };
					gtag('js', new Date());
					gtag('config', Conf.google.Analytics);
		}; */
		console.log("initial: End.");
	});
});
