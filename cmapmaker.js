/*	Main Process */
"use strict";

// Global Variable
var map;						// leaflet map object
var Conf = {};					// Config Praams
const LANG = (window.navigator.userLanguage || window.navigator.language || window.navigator.browserLanguage).substr(0, 2) == "ja" ? "ja" : "en";
const FILES = ["./baselist.html", "./data/config.json", './data/system.json', './data/overpass.json', `./data/category-${LANG}.json`, `data/datatables-${LANG}.json`, `./data/marker.json`];
const glot = new Glottologist();

// initialize
console.log("Welcome to MapMaker.");
window.addEventListener("DOMContentLoaded", function () {
	let jqXHRs = [];
	for (let key in FILES) { jqXHRs.push($.get(FILES[key])) };
	$.when.apply($, jqXHRs).always(function () {
		let arg = {}, baselist = arguments[0][0];								// Get Menu HTML
		for (let i = 1; i <= 6; i++) arg = Object.assign(arg, arguments[i][0]);	// Make Config Object
		Object.keys(arg).forEach(key1 => {
			Conf[key1] = {};
			Object.keys(arg[key1]).forEach((key2) => Conf[key1][key2] = arg[key1][key2]);
		});

		window.onresize = WinCont.window_resize;      	// 画面サイズに合わせたコンテンツ表示切り替え
		glot.import("./data/glot.json").then(() => {	// Multi-language support
			// document.title = glot.get("title");		// Title(no change / Google検索で日本語表示させたいので)
			cMapmaker.init(baselist);					// Mapmaker Initialize
			Marker.init();								// Marker Initialize
			WinCont.menu_make();
			// Google Analytics
			if (Conf.google.Analytics !== "") {
				$('head').append('<script async src="https://www.googletagmanager.com/gtag/js?id=' + Conf.default.GoogleAnalytics + '"></script>');
				window.dataLayer = window.dataLayer || [];
				function gtag() { dataLayer.push(arguments); };
				gtag('js', new Date());
				gtag('config', Conf.google.Analytics);
			};
			glot.render();
		});
	});
});

var cMapmaker = (function () {
	var view_license = false, _status = "initialize", last_modetime;

	return {
		// Initialize
		init: (baselist) => {
			// Set Window Size(mapidのサイズ指定が目的)
			WinCont.window_resize();

			// get GoogleSpreadSheet
			gSpreadSheet.get(Conf.google.AppScript, Conf.google.sheetName).then(json => poiCont.set_json(json));

			// initialize leaflet
			map = leaflet.init();
			leaflet.controlAdd("bottomleft", "zoomlevel", "");
			leaflet.controlAdd("topleft", "baselist", baselist, "leaflet-control m-1");	// Make: base list
			leaflet.locateAdd();
			WinCont.window_resize();
			cmap_events.map_zoom();														// Zoom 
			$("#dataid").hover(
				() => { map.scrollWheelZoom.disable(); map.dragging.disable() },
				() => { map.scrollWheelZoom.enable(); map.dragging.enable() }
			);
			cMapmaker.poi_get().then(() => {
				//dataList.view(targets);
				//DisplayStatus.splash(false);
				if (location.search !== "") {    	// 引数がある場合
					let osmid = location.search.replace(/[?&]fbclid.*/, '');    // facebook対策
					osmid = osmid.replace('-', '/').replace('=', '/').slice(1);
					// let tags = poiCont.get_osmid(osmid).geojson.properties;	// poi直リンク（あとで作る）
					// if (tags !== undefined) cMapmaker.view(tags.id);
				};
				cMapmaker.poi_view();
				map.on('moveend', () => cmap_events.map_move());             				// マップ移動時の処理
				map.on('zoomend', () => cmap_events.map_zoom());							// ズーム終了時に表示更新
				console.log("cmapmaker: initial end.");
			});

			// initialize last_modetime
			last_modetime = Date.now();
		},

		// About license
		licence: (once) => {
			if ((once == 'once' && view_license == false) || once == undefined) {
				let msg = { msg: glot.get("licence_message") + glot.get("more_message"), ttl: glot.get("licence_title") };
				WinCont.modal_open({ "title": msg.ttl, "message": msg.msg, "mode": "close", callback_close: WinCont.modal_close });
				view_license = true;
			};
		},

		mode_change: (mode) => {
			if (_status !== "mode_change" && (last_modetime + 300) < Date.now()) {
				_status = "mode_change";
				let params = { 'map': ['down', 'remove', 'start'], 'list': ['up', 'add', 'stop'] };
				mode = !mode ? (list_collapse.classList.contains('show') ? 'map' : 'list') : mode;
				console.log('mode_change: ' + mode + ' : ' + last_modetime + " : " + Date.now());
				list_collapse_icon.className = 'fas fa-chevron-' + params[mode][0];
				list_collapse.classList[params[mode][1]]('show');
				if (mode == "list") listTable.datalist_make(Object.values(Conf.targets));
				last_modetime = Date.now();
				_status = "normal";
			};
		},
		
		// Poiを表示させる
		poi_view: () => {
			if (map.getZoom() >= Conf.default.iconViewZoom) {
				Object.values(Conf.targets).forEach(key => Marker.set(key));
			}else{
				Marker.all_clear();
			};
		},

		// OSMとGoogle SpreadSheetからPoiを取得してリスト化
		poi_get: (targets) => {
			return new Promise((resolve, reject) => {
				console.log("cMapmaker: poi_get start...");
				var keys = (targets !== undefined && targets !== "") ? targets : Object.values(Conf.targets);
				if (map.getZoom() < Conf.default.iconViewZoom) {
					console.log("cMapmaker: poi_get end(more zoom).");
					resolve();
				} else {
					OvPassCnt.get(keys).then(ovanswer => {
						poiCont.all_clear();
						poiCont.add_geojson(ovanswer);
						// cMapmaker.update();
						console.log("cMapmaker: poi_get end(success).");
						resolve();
					}) /* .catch((jqXHR, statusText, errorThrown) => {
						console.log("cMapmaker: poi_get end(overror). " + statusText);
						// cMapmaker.update();
						reject();
					}); */
				};
			});
		},

		// Search Address(Japan Only)
		poi_search: (keyword) => {
			getLatLng(keyword, (latnng) => {
				map.setZoom(Conf.default.SearchZoom);
				map.panTo(latnng);
			}, () => {
				WinCont.modal_open({
					title: glot.get("addressnotfound_title"), message: glot.get("addressnotfound_body"),
					mode: "close", callback_close: () => { WinCont.modal_close() }
				});
			})
		},

		qr_add: (target, osmid) => {
			let marker = Marker.get(target, osmid);
			if (marker !== undefined) {
				let wiki = marker.mapmaker_lang.split(':');
				let url = encodeURI(`https://${wiki[0]}.${Conf.osm.wikipedia.domain}/wiki/${wiki[1]}`);
				let pix = map.latLngToLayerPoint(marker.getLatLng());
				let ll2 = map.layerPointToLatLng(pix);
				basic.getWikipedia(wiki[0], wiki[1]).then(text => Marker.qr_add(target, osmid, url, ll2, text));
			};
		},

		status: () => { return _status }, // ステータスを返す

		// Try Again
		all_clear: () => {
			WinCont.modal_open({
				title: glot.get("restart_title"),
				message: glot.get("restart_message"),
				mode: "yesno",
				callback_yes: () => {
					cMapmaker.custom(false);
					Marker.all_clear();
					poiCont.all_clear();
					WinCont.modal_close();
				},
				callback_no: () => WinCont.modal_close()
			});
		}
	};
})();

class cMapEvents {

	constructor() {
		this.busy = false;
		this.id = 0;
	};

	map_move(e) {                					// map.moveend発生時のイベント
		console.log("cmapmaker: move event start.");
		if (this.busy > 1) return;					// 処理中の時は戻る
		if (this.busy == 1) clearTimeout(this.id);	// no break and cancel old timer.
		this.busy = 1;
		this.id = setTimeout(() => {
			this.busy = 2;
			cMapmaker.poi_get().then(() => {
				console.log("cmapmaker: move event end.");
				cMapmaker.poi_view();
				this.busy = 0;
			});
		}, 2000);
	};

	map_zoom() {				// View Zoom Level & Status Comment
		let nowzoom = map.getZoom();
		let message = `${glot.get("zoomlevel")}${map.getZoom()} `;
		if (nowzoom < Conf.default.iconViewZoom) message += `<br>${glot.get("morezoom")}`;
		$("#zoomlevel").html("<h2 class='zoom'>" + message + "</h2>");
	};

	detail_view(marker) {	// PopUpを表示
		// let target = marker.target.mapmaker_key;
		let osmid = marker.target.mapmaker_id;
		let tags = poiCont.get_osmid(osmid).geojson.properties;
		let micon = marker.target.mapmaker_icon;
		let title = `<img src="./image/${micon}">${tags.name == undefined ? glot.get("undefined") : tags.name}`;
		let message = "";

		// append wikipedia
		if (tags.wikipedia !== undefined) {
			message += modal_wikipedia.element();
			modal_wikipedia.make(tags).then(html => modal_wikipedia.set_dom(html));
		};

		// append activity
		let actlists = poiCont.get_actlist(marker.target.mapmaker_id);
		if (actlists.length > 0) message += `<h5>${glot.get("activities")}</h5>` + modal_activities.make(actlists);

		WinCont.modal_open({ "title": title, "message": message, "mode": "close", "callback_close": function () { WinCont.modal_close() } });
	};
};
var cmap_events = new cMapEvents();

class FromControl {
	// Google Spreadsheet Control Form
	form_edit(json) {
		listTable.select(json['OSMID']);
		$("#osmid").html(json['OSMID']);
		$("#area").val(json['場所']);
		$("#planting").val(formatDate(new Date(json['植樹日']), "YYYY-MM-DD"));
		$("#name").val(json['愛称']);
		$("#picture_url").val(json['写真アドレス']);

		let picurl = json['写真アドレス'];
		let pattern = new RegExp('^(https?:\\/\\/)?((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|((\\d{1,3}\\.){3}\\d{1,3}))(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*(\\?[;&a-z\\d%_.~+=-]*)?(\\#[-a-z\\d_]*)?$', 'i');
		if (pattern.test(picurl) && picurl !== "") {
			console.log("picture url is valid");
			$("#picture_img").attr('src', picurl);
			$("#picture_img").show();
		} else {
			console.log("picture url is invalid");
			$("#picture_img").attr('src', "");
			$("#picture_img").hide();
		};
		$("#memo").val(json['メモ']);
		$('#PoiEdit_Modal').modal({ backdrop: false, keyboard: false });
	};

	form_save(callback) {
		let commit = {};
		if (confirm("この内容で登録しますか？")) {
			$('#PoiEdit_Button').hide();
			commit['index'] = $('#index').val();
			commit['OSMID'] = $('#osmid').html();
			commit['場所'] = $('#area').val();
			commit['植樹日'] = $('#planting').val().replace(/-/g, "/");
			commit['愛称'] = $('#name').val();
			commit['写真アドレス'] = $('#picture_url').val();
			commit['メモ'] = $('#memo').val();
			console.log(commit);
			PoiData.set(commit, false).then(() => callback());
		};
		$('#PoiEdit_Modal').modal("hide");
		return;
	};
};
var form = new FromControl();	// Google Spreadsheet Control Form

