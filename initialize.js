/*	Main Process */
"use strict";

// Global Variable
var Conf = {};					// Config Praams
const LANG = (window.navigator.userLanguage || window.navigator.language || window.navigator.browserLanguage).substr(0, 2) == "ja" ? "ja" : "en";
const FILES = [
	"./baselist.html", "./data/config.json", './data/config-system.json', './data/config-activities.json',
	'./data/overpass.json', `./data/marker.json`, `./data/category-${LANG}.json`, `data/listtable-${LANG}.json`,
	`./data/glot-custom.json`, `data/glot-system.json`];
const glot = new Glottologist();
var gSheet = new GoogleSpreadSheet();
var cMapmaker = new CMapMaker();
var cmap_events = new cMapEvents();
var modal_takeout = new modal_Takeout();
var modal_activities = new modal_Activities();
var modal_wikipedia = new modal_Wikipedia();
var basic = new Basic();
var poiMarker = new PoiMarker();
var leaflet = new Leaflet();


// initialize
console.log("Welcome to MapMaker.");
window.addEventListener("DOMContentLoaded", function () {
	let jqXHRs = [];
	for (let key in FILES) { jqXHRs.push($.get(FILES[key])) };
	$.when.apply($, jqXHRs).always(function () {
		let arg = {}, basehtml = arguments[0][0];								// Get Menu HTML
		for (let i = 1; i <= 7; i++) arg = Object.assign(arg, arguments[i][0]);	// Make Config Object
		Object.keys(arg).forEach(key1 => {
			Conf[key1] = {};
			Object.keys(arg[key1]).forEach((key2) => Conf[key1][key2] = arg[key1][key2]);
		});
		glot.data = Object.assign(glot.data, arguments[8][0]);					// import glot data
		glot.data = Object.assign(glot.data, arguments[9][0]);					// import glot data

		window.onresize = winCont.window_resize;    // 画面サイズに合わせたコンテンツ表示切り替え
		// document.title = glot.get("title");		// Title(no change / Google検索で日本語表示させたいので)
		cMapmaker.init(basehtml);					// Mapmaker Initialize
		if (Conf.google.Analytics !== "") {			// Google Analytics
			let AnalyticsURL = '<script async src="https://www.googletagmanager.com/gtag/js?id=' + Conf.default.GoogleAnalytics + '"></script>';
			document.getElementsByTagName('head').insertAdjacentHTML("beforeend", AnalyticsURL);
			window.dataLayer = window.dataLayer || [];
			function gtag() { dataLayer.push(arguments); };
			gtag('js', new Date());
			gtag('config', Conf.google.Analytics);
		};
	});
});
