/*	Main Process */
"use strict";

// Global Variable
var map;						// leaflet map object
var Layers = {};				// Layer Status,geojson,svglayer
var Conf = {};					// Config Praams
var Control = { "locate": "", "maps": "", "minimap": "" };		// leaflet control object
const LANG = (window.navigator.userLanguage || window.navigator.language || window.navigator.browserLanguage).substr(0, 2) == "ja" ? "ja" : "en";
const FILES = ["./baselist.html", "./modals.html", "./data/config.json", './data/target.json', `./data/category-${LANG}.json`, `data/datatables-${LANG}.json`, `./data/marker.json`];
const glot = new Glottologist();
const Mono_Filter = ['grayscale:90%', 'bright:85%', 'contrast:130%', 'sepia:15%'];;

// initialize
$(document).ready(function () {
	console.log("Welcome to MapMaker.");
	let jqXHRs = [];
	for (let key in FILES) { jqXHRs.push($.get(FILES[key])) };
	$.when.apply($, jqXHRs).always(function () {
		let arg = {}, baselist = arguments[0][0];								// Get Menu HTML
		$("#modals").html(arguments[1][0]);										// Make Modal HTML
		for (let i = 2; i <= 6; i++) arg = Object.assign(arg, arguments[i][0]);	// Make Config Object
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
			if (Conf.default.GoogleAnalytics !== "") {
				$('head').append('<script async src="https://www.googletagmanager.com/gtag/js?id=' + Conf.default.GoogleAnalytics + '"></script>');
				window.dataLayer = window.dataLayer || [];
				function gtag() { dataLayer.push(arguments); };
				gtag('js', new Date());
				gtag('config', Conf.default.GoogleAnalytics);
			};
			glot.render();
		});
	});
});

var cMapmaker = (function () {
	var view_license = false, _status = "initialize"
	var LL = {};

	return {
		// Initialize
		init: (baselist) => {
			// Set Window Size(mapidのサイズ指定が目的)
			WinCont.window_resize();

			// get GoogleSpreadSheet
			gSpreadSheet.get(Conf.default.GoogleAppScript).then(json => poiCont.set_json(json));

			// initialize leaflet
			leaflet.init();
			leaflet.controlAdd("bottomleft", "zoomlevel", "");
			leaflet.controlAdd("topleft", "baselist", baselist, "leaflet-control m-1");	// Make: base list
			Control["locate"] = L.control.locate({ position: 'topright', strings: { title: glot.get("location") }, locateOptions: { maxZoom: 16 } }).addTo(map);
			WinCont.window_resize();
			cMapmaker.zoom_view();														// Zoom 
			map.on('moveend', cMapmaker.event_move);             						// マップ移動時の処理
			map.on('zoomend', () => cMapmaker.zoom_view());								// ズーム終了時に表示更新
			$("#baselist").hover(
				() => { map.scrollWheelZoom.disable(); map.dragging.disable() },
				() => { map.scrollWheelZoom.enable(); map.dragging.enable() });
		},

		// About license
		licence: (once) => {
			if ((once == 'once' && view_license == false) || once == undefined) {
				let msg = { msg: glot.get("licence_message") + glot.get("more_message"), ttl: glot.get("licence_title") };
				WinCont.modal_open({ "title": msg.ttl, "message": msg.msg, "mode": "close", callback_close: WinCont.modal_close });
				view_license = true;
			};
		},

		// mode_change
		mode_change: (event, mode) => {
			let params = { 'map': ['down', 'remove', 'start'], 'list': ['up', 'add', 'stop'] };
			event.stopImmediatePropagation();
			mode = !mode ? (list_collapse.classList.contains('show') ? 'map' : 'list') : mode;
			console.log('mode_change: ' + mode);
			list_collapse_icon.className = 'fas fa-chevron-' + params[mode][0];
			list_collapse.classList[params[mode][1]]('show');
			//leaflet[params[mode][2]]();
			if (mode == "list") {
				listTable.datalist_make("park");
			};
		},

		event_move: (e) => {                // map.moveend発生時のイベント
			console.log("cmapmaker: move event start.");
			if (LL.busy > 1) return;					// 処理中の時は戻る
			if (LL.busy == 1) clearTimeout(LL.id);		// no break and cancel old timer.

			LL.busy = 1;
			if (cMapmaker.status() == "initialize") {	// 初期イベント(移動)
				LL.busy = 2;
				cMapmaker.poi_get().then(() => {
					//dataList.view(targets);
					//DisplayStatus.splash(false);
					if (location.search !== "") {    	// 引数がある場合
						let osmid = location.search.replace(/[?&]fbclid.*/, '');    // facebook対策
						osmid = osmid.replace('-', '/').replace('=', '/').slice(1);
						// let tags = poiCont.get_osmid(osmid).geojson.properties;	// poi直リンク（あとで作る）
						// if (tags !== undefined) cMapmaker.view(tags.id);
					}
					Object.keys(Conf.target).forEach(key => { Marker.set(key) });
					console.log("cmapmaker: initial end.");
					_status = "normal";
					LL.busy = 0;
				});
			} else {
				LL.id = setTimeout(() => {
					LL.busy = 2;
					cMapmaker.poi_get().then(() => {
						console.log("cmapmaker: move event end.");
						Object.keys(Conf.target).forEach(key => { Marker.set(key) });
						LL.busy = 0;
					});
				}, 2000);
			}
		},

		poi_get: (keys) => { 								// OSMとGoogle SpreadSheetからPoiを取得してリスト化
			return new Promise((resolve, reject) => {
				console.log("cMapmaker: poi_get start...");
				var targets = [];
				if (keys == undefined || keys == "") {
					for (let key in Conf.target) targets.push(key);
				} else {
					targets = keys;
				};
				if (map.getZoom() < Conf.default.IconViewZoom) {
					console.log("cMapmaker: poi_get end(more zoom).");
					resolve();
				} else {
					OvPassCnt.get(targets).then(ovanswer => {
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

		// 情報（アイコンなど）を地図に追加
		poi_add: key => {
			WinCont.modal_open({ "title": glot.get("loading_title"), "message": glot.get("loading_message"), "mode": "" });
			WinCont.modal_spinner(true);
			if (Conf.target[key].file !== undefined) {		// "file"がある場合
				$.get(Conf.target[key].file).then((csv) => {
					let geojsons = GeoCont.csv2geojson(csv, key);
					let targets = geojsons.map(() => [key]);
					poiset(key, { "geojson": geojsons, "targets": targets });
				});
			} else {
				OvPassCnt.get([key], true)
					.then((ovasnswer) => {
						if (ovasnswer == undefined) {
							let modal = { "title": glot.get("nodata_title"), "message": glot.get("nodata_message"), "mode": "close", "callback_close": () => WinCont.modal_close() };
							WinCont.modal_open(modal);
						} else {
							poiset(key, ovasnswer);
						};
					}).catch(() => {
						let modal = { "title": glot.get("sverror_title"), "message": glot.get("sverror_message"), "mode": "close", "callback_close": () => cMapmaker.all_clear() };
						WinCont.modal_open(modal);
					})
			};

			function poiset(key, answer) {
				let geojsons = { geojson: [], targets: [] };
				answer.geojson.forEach((geojson, idx) => {
					let geo = geojson.geometry;
					let cords = geo.coordinates;
					cords = GeoCont.multi2flat(cords, geo.type);
					cords = GeoCont.flat2single(cords, geo.type);
					cords = GeoCont.bboxclip([cords], true);
					if (cords.length > 0) {
						geojson.geometry.type = "Point";
						geojson.geometry.coordinates = cords[0];
						geojsons.geojson.push(geojson);
						geojsons.targets.push(answer.targets[idx]);
					};
				});
				poiCont.add_geojson(geojsons);
			};
		},

		// delete poi
		poi_del: (target, osmid) => {
			let poi = poiCont.get_osmid(osmid);
			if (poi !== undefined) {
				poi.enable = false;
				poiCont.set_geojson(poi);
				Marker.delete(target, osmid);
			};
		},

		// Image List and select
		poi_marker_change: (target, osmid, filename) => {
			switch (filename) {
				case "":
				case undefined:
					let html = "", images = [];
					Object.keys(Conf.marker_tag).forEach(key1 => {
						Object.keys(Conf.marker_tag[key1]).forEach((key2) => {
							let filename = Conf.marker_tag[key1][key2];
							if (images.indexOf(filename) == -1) { images.push(filename) };
						});
					});
					Object.assign(images, Conf.marker_append_files);
					images.sort();
					Object.keys(images).forEach(fidx => { html += `<a href="#" onclick="cMapmaker.poi_marker_change('${target}','${osmid}','${images[fidx]}')"><img class="iconx2" src="./image/${images[fidx]}"></a>` });
					WinCont.modal_open({ "title": "", "message": html, "mode": "close", callback_close: WinCont.modal_close });
					break;
				default:
					Marker.change_icon(target, osmid, filename);
					WinCont.modal_close();
					break;
			};
		},

		qr_add: (target, osmid) => {
			let marker = Marker.get(target, osmid);
			if (marker !== undefined) {
				let wiki = marker.mapmaker_lang.split(':');
				let url = encodeURI(`https://${wiki[0]}.${Conf.target.wikipedia.domain}/wiki/${wiki[1]}`);
				let pix = map.latLngToLayerPoint(marker.getLatLng());
				let ll2 = map.layerPointToLatLng(pix);
				basic.getWikipedia(wiki[0], wiki[1]).then(text => Marker.qr_add(target, osmid, url, ll2, text));
			};
		},

		status: () => { return _status }, // ステータスを返す

		// View Zoom Level & Status Comment
		zoom_view: () => {
			let nowzoom = map.getZoom();
			let message = `${glot.get("zoomlevel")}${map.getZoom()} `;
			if (nowzoom < Conf.default.MinZoomLevel) {
				message += `<br>${glot.get("morezoom")}`;
			} else {
				if (nowzoom < Conf.default.LimitZoomLevel) message += `<br>${glot.get("morezoom2")}`;
			};
			message += `<br>${glot.get("custommode")}`;
			$("#zoomlevel").html("<h2 class='zoom'>" + message + "</h2>");
		},

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
	}
})();

// listTable管理(イベントやPoi情報を表示)
class ListTable {

	constructor() {
		this.table;
		this.lock = false;
		this.timeout = 0;
	};

	init() { // dataListに必要な初期化
		function keyword_change() {        				// キーワード検索
			if (this.timeout > 0) {
				window.clearTimeout(this.timeout);
				this.timeout = 0;
			};
			this.timeout = window.setTimeout(() => listTable.filter(keyword.value, 500));
		};
		keyword.removeEventListener('change', keyword_change);
		keyword.addEventListener('change', keyword_change);

		function category_change() {        			// カテゴリ名でキーワード検索
			let category = category_list.value;
			listTable.filter(category == "-" ? "" : category);
		};
		keyword.removeEventListener('change', category_change);
		keyword.addEventListener('change', category_change);
	};

	category_make(result) {    							// Poi種別リストを作成
		WinCont.select_clear(`category_list`);
		let pois = result.map(data => { return data.category });
		pois = pois.filter((x, i, self) => { return self.indexOf(x) === i });
		pois.map(poi => WinCont.select_add(`category_list`, poi, poi));
	};

	datalist_make(targets) {  							// リスト表示
		this.lock = true;
		if (this.table !== undefined) this.table.destroy();
		let result = poiCont.list(targets);
		this.table = $('#tableid').DataTable({
			"columns": Object.keys(Conf.datatables_columns).map(function (key) { return Conf.datatables_columns[key] }),
			"data": result,
			"processing": true,
			"filter": true,
			"destroy": true,
			"deferRender": true,
			"dom": 't',
			"language": Conf.datatables_lang,
			"order": [],    // ソート禁止(行選択時にズレが生じる)
			"ordering": true,
			"orderClasses": false,
			"paging": true,
			"processing": false,
			"pageLength": 100000,
			"select": 'single',
			scrollY: window.innerHeight * 0.4,
			"scrollCollapse": true
		});
		$('#modal_select_table').css("width", "");
		listTable.category_make(result);
		// let osmids = result.filter(val => val.enable).map(val => val.osmid);
		this.one_select([]);
		this.table.draw();
		this.table.off('select');
		this.table.on('select', (e, dt, type, indexes) => {
			e.stopPropagation();
			if (type === 'row') {
				var data = this.table.rows(indexes).data().pluck('osmid');
				Marker.center(data[0]);
			}
		});
		this.lock = false;
	};

	one_select(osmids) {
		let alldata = this.table.rows().data().toArray();
		let join_ids = osmids.join('|');
		alldata.forEach((val, idx) => { if (join_ids.indexOf(val.osmid) > -1) this.table.row(idx).select() });
	};

	indexes() { // アイコンをクリックした時にデータを選択
		let selects = this.table.rows('.selected').indexes();
		selects = table.rows(selects).data();
		return selects.toArray();
	};

	filter(keyword) {
		console.log("ListTable: filter keyword: " + keyword);
		this.table.search(keyword).draw();
	};                		// キーワード検索
	filtered() { this.table.rows({ filter: 'applied' }).data().toArray() }; 		// 現在の検索結果リスト
	filtered_select() { this.table.rows({ filter: 'applied' }).select() };
	filtered_deselect() { this.table.rows({ filter: 'applied' }).deselect() };
};
var listTable = new ListTable();

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
	}

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
	}
}
var form = new FromControl()	// Google Spreadsheet Control Form
