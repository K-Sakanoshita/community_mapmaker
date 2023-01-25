class CMapMaker {

	constructor() {
		this.status = "initialize";
		this.detail = false;				// detail_view表示中はtrue
		this.open_osmid = "";				// detail_view表示中はosmid
		this.last_modetime = 0;
		this.mode = "map";
	};

	about() {
		let msg = { msg: glot.get("about_message"), ttl: glot.get("about") };
		winCont.modal_open({ "title": msg.ttl, "message": msg.msg, "mode": "close", callback_close: winCont.modal_close, "menu": false });
	};

	licence() {			// About license
		let msg = { msg: glot.get("licence_message") + glot.get("more_message"), ttl: glot.get("licence_title") };
		winCont.modal_open({ "title": msg.ttl, "message": msg.msg, "mode": "close", callback_close: winCont.modal_close, "menu": false });
	};

	mode_change(newmode) {	// mode change(list or map)
		if (this.status !== "mode_change" && (this.last_modetime + 300) < Date.now()) {
			this.status = "mode_change";
			let params = { 'map': ['fas fa-list', 'remove', 'start'], 'list': ['fas fa-map', 'add', 'stop'] };
			this.mode = !newmode ? (list_collapse.classList.contains('show') ? 'map' : 'list') : newmode;
			console.log('mode_change: ' + this.mode + ' : ' + this.last_modetime + " : " + Date.now());
			leaflet.enable(this.mode == "map");
			list_collapse_icon.className = params[this.mode][0];
			list_collapse.classList[params[this.mode][1]]('show');
			this.last_modetime = Date.now();
			this.status = "normal";
			mapid.focus();
		};
	};

	load_static() {	// check static osm mode
		return new Promise((resolve, reject) => {
			if (!Conf.static.mode) {		// static mode以外は即終了
				resolve("cMapmaker: no static mode");
			} else {
				$.ajax({ "type": 'GET', "dataType": 'json', "url": Conf.static.osmjson, "cache": false }).done(function (data) {
					let ovanswer = OvPassCnt.set_osmjson(data);
					poiCont.add_geojson(ovanswer);
					resolve(ovanswer);
				}).fail(function (jqXHR, statusText, errorThrown) {
					console.log("cMapmaker: " + statusText);
					reject(jqXHR, statusText, errorThrown);
				});;
			};
		});
	};

	view_poi(targets) {		// Poiを表示させる
		let setcount = 0;
		let oldselect = list_category.value == "" ? "-" : list_category.value;
		console.log(`cMapmaker: view_poi: Start(now select ${oldselect}).`);
		let zm = map.getZoom();
		poiMarker.delete_all();
		targets = targets[0] == "-" ? Conf.PoiView.targets : targets;	// '-'はすべて表示
		targets.forEach((target) => {
			if (target == oldselect || oldselect == "-") {	// 選択している種別の場合
				if (zm >= Conf.PoiViewZoom[target]) {
					poiMarker.set(target, target == "activity",);
					setcount++;
				}
			}
		});
		if (setcount == 0) poiMarker.set("", false, listTable.flist);		// 含まれない(=listTable.flist)&絞り込み時はズーム無関係
		console.log("cMapmaker: view_poi: End.");
	};

	get_poi(targets) {		// OSMとGoogle SpreadSheetからPoiを取得してリスト化
		return new Promise((resolve) => {
			console.log("cMapmaker: get_poi: Start");
			winCont.spinner(true);
			var keys = (targets !== undefined && targets !== "") ? targets : Object.values(Conf.PoiView.targets);
			let PoiLoadZoom = 99;
			for (let [key, value] of Object.entries(Conf.PoiViewZoom)) {
				PoiLoadZoom = value < PoiLoadZoom ? value : PoiLoadZoom;
			};
			if ((map.getZoom() < PoiLoadZoom) && !Conf.static.mode) {
				winCont.spinner(false);
				console.log("[success]cMapmaker: get_poi End(more zoom).");
				resolve({ "update": true });
			} else {
				OvPassCnt.get(keys, status_write).then(ovanswer => {
					winCont.spinner(false);
					poiCont.add_geojson(ovanswer);
					console.log("[success]cMapmaker: get_poi End.");
					global_status.innerHTML = "";
					resolve({ "update": true });
				}).catch(() => {
					winCont.spinner(false);
					console.log("[error]cMapmaker: get_poi end.");
					global_status.innerHTML = "";
					resolve({ "update": false });
				});
			};
		});

		function status_write(progress) {
			global_status.innerHTML = progress;
		};
	};

	qr_add(target, osmid) {			// QRコードを表示
		let marker = poiMarker.get(target, osmid);
		if (marker !== undefined) {
			let wiki = marker.mapmaker_lang.split(':');
			let url = encodeURI(`https://${wiki[0]}.${Conf.osm.wikipedia.domain}/wiki/${wiki[1]}`);
			let pix = map.latLngToLayerPoint(marker.getLatLng());
			let ll2 = map.layerPointToLatLng(pix);
			basic.getWikipedia(wiki[0], wiki[1]).then(datas => poiMarker.qr_add(target, osmid, url, ll2, datas[0]));
		};
	};

	detail_view(osmid, openid) {	// PopUpを表示(marker,openid=actlst.id)
		const detail_close = () => {
			let catname = list_category.value !== "-" ? `?category=${list_category.value}` : "";
			winCont.modal_close();
			history.replaceState('', '', location.pathname + catname + location.hash);
			cMapmaker.open_osmid = "";
			cMapmaker.detail = false;
		};
		if (cMapmaker.detail) detail_close();
		let osmobj = poiCont.get_osmid(osmid);
		let tags = osmobj == undefined ? { "targets": [] } : osmobj.geojson.properties;
		tags["*"] = "*";
		let target = osmobj == undefined ? "*" : osmobj.targets[0];
		let category = poiCont.get_catname(tags);
		let title = "", message = "";

		for (let i = 0; i < Conf.osm[target].titles.length; i++) {
			if (tags[Conf.osm[target].titles[i]] !== void 0) {
				title = `<img src="./${Conf.icon.path}/${poiMarker.get_icon(tags)}">${tags[Conf.osm[target].titles[i]]}`;
				break;
			};
		};
		if (title == "") title = category[0];
		if (title == "") title = glot.get("undefined");
		winCont.menu_make(Conf.detail_menu, "modal_menu");
		winCont.modal_progress(0);
		cMapmaker.open_osmid = osmid;

		// append OSM Tags(仮…テイクアウトなど判別した上で最終的には分ける)
		message += modal_osmbasic.make(tags);

		// append wikipedia
		if (tags.wikipedia !== undefined) {
			message += modal_wikipedia.element();
			winCont.modal_progress(100);
			modal_wikipedia.make(tags).then(html => {
				modal_wikipedia.set_dom(html);
				winCont.modal_progress(0);
			});
		};

		// append activity
		let actlists = poiCont.get_actlist(osmid);
		if (actlists.length > 0) message += modal_activities.make(actlists);
		let catname = list_category.value !== "-" ? `&category=${list_category.value}` : "";
		history.replaceState('', '', location.pathname + "?" + osmid + (!openid ? "" : "." + openid) + catname + location.hash);
		winCont.modal_open({ "title": title, "message": message, "append": Conf.detail_view.buttons, "mode": "close", "callback_close": detail_close, "menu": true, "openid": openid });
		//if (openid !== undefined && actlists.length > 0) document.getElementById(openid.replace("/", "")).scrollIntoView();

		$('[data-toggle="popover"]').popover();			// set PopUp
		cMapmaker.detail = true;
	};

	url_share(actid) {			// URL共有機能
		function execCopy(string) {
			let pre = document.createElement('pre');			// ClipBord Copy
			pre.style.userSelect = 'auto';
			let text = document.createElement("div");
			text.appendChild(pre).textContent = string;
			text.style.position = 'fixed';
			text.style.right = '200%';
			document.body.appendChild(text);
			document.getSelection().selectAllChildren(text);
			let copy = document.execCommand("copy");
			document.body.removeChild(text);
			return copy;
		};
		actid = actid == undefined ? "" : "." + actid;
		let url = location.origin + location.pathname + location.search + actid + location.hash;
		execCopy(url);
	};

	playback(flist) {					// 指定したリストを連続再生()
		const view_control = (list, idx) => {
			if (list.length >= (idx + 1)) {
				listTable.select(list[idx][0]);
				poiMarker.select(list[idx][0], false);
				if (this.status == "playback") {
					setTimeout(view_control, speed_calc(), list, idx + 1);
				};
			} else {
				listTable.disabled(false);
				listTable.heightSet(listTable.height + "px");	// mode end
				this.status = "normal";							// mode stop
				icon_change("play");
			};
		};
		const icon_change = (mode) => { list_playback.className = 'fas fa-' + mode };
		const speed_calc = () => { return ((parseInt(list_speed.value) / 100) * Conf.listTable.playback.timer) + 100 };
		if (this.status !== "playback") {
			listTable.disabled(true);
			listTable.heightSet(listTable.height / 4 + "px");
			leaflet.zoomSet(Conf.listTable.playback.zoomLevel);
			cMapmaker.mode_change("list");
			this.status = "playback";
			icon_change("stop");
			setTimeout(view_control, speed_calc(), flist, 0);
		} else {
			listTable.disabled(false);
			listTable.heightSet(listTable.height + "px");		// mode end
			this.status = "normal";								// mode stop
			icon_change("play");
		};
	};

	download() {
		const linkid = "temp_download";
		let csv = "", link;
		Conf.listTable.targets.forEach(target => { csv += basic.makeArray2CSV(poiCont.list(target)) });
		let bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
		let blob = new Blob([bom, csv], { 'type': 'text/csv' });

		link = document.getElementById(linkid) ? document.getElementById(linkid) : document.createElement("a");
		link.id = linkid;
		link.href = URL.createObjectURL(blob);
		link.download = "my_data.csv";
		link.dataset.downloadurl = ['text/plain', link.download, link.href].join(':');
		document.body.appendChild(link);
		link.click();
	};
};
var cMapmaker = new CMapMaker();

class cMapEvents {

	constructor() {
		this.busy = 0;
		this.id = 0;
		this.timeout;
	};

	init() {
		console.log("cMapEvents: init.");
		map.on('moveend', () => cmap_events.map_move());   						// マップ移動時の処理
		map.on('zoomend', () => cmap_events.map_zoom());						// ズーム終了時に表示更新
		list_keyword.addEventListener('change', cmap_events.keyword_change);
		list_category.addEventListener('change', cmap_events.category_change);	// category change
	};

	map_move() {                							// map.moveend発生時のイベント
		return new Promise((resolve, reject) => {
			if (cmap_events.busy < 2) {
				cmap_events.#map_move_promise(resolve, reject)
			} else {
				resolve();
			}
		});
	};

	#map_move_promise(resolve, reject) {
		console.log("cMapEvents: map_move Start.");
		if (this.busy > 1) return; 		// 処理中の時は戻る
		if (this.busy == 1) clearTimeout(this.id);		// no break and cancel old timer.
		this.busy = 1;
		this.id = setTimeout(() => {
			console.log("cMapEvents: map_move: End.");
			this.busy = 2;
			cMapmaker.get_poi().then((status) => {
				this.busy = 0;
				let targets = (Conf.listTable.targets.indexOf("targets") > -1) ? [list_category.value] : ["-"];
				if (Conf.PoiView.update_mode == "all" || status.update) {
					listTable.make();					// view all list
					listTable.make_category(Conf.listTable.targets);
					cMapmaker.view_poi(targets);	// in targets
					resolve();
				} else {
					this.busy = 0;
					cmap_events.#map_move_promise(resolve, reject);	// 失敗時はリトライ(接続先はoverpass.jsで変更)
				};
			})/*.catch(() => {
				this.busy = 0;
				console.log("cMapEvents: map_move: Reject");
				reject();
			});*/
		}, 700);
	};

	map_zoom() {				// View Zoom Level & Status Comment
		let poizoom = false;
		for (let [key, value] of Object.entries(Conf.PoiViewZoom)) {
			if (map.getZoom() >= value) poizoom = true;
		};
		let message = `${glot.get("zoomlevel")}${map.getZoom()} `;
		if (!poizoom) message += `<br>${glot.get("morezoom")}`;
		zoomlevel.innerHTML = "<h2 class='zoom'>" + message + "</h2>";
	};

	// EVENT: キーワード検索
	keyword_change() {
		if (cmap_events.timeout > 0) {
			window.clearTimeout(cmap_events.timeout);
			cmap_events.timeout = 0;
		};
		cmap_events.timeout = window.setTimeout(() => {
			listTable.filter_keyword();
			cMapmaker.mode_change('list');
		}, 500);
	};

	// EVENT: change category
	category_change() {
		listTable.filter_category(list_category.value);
		//let targets = (Conf.listTable.targets.indexOf("targets") > -1) ? [list_category.value] : ["-"];
		if (Conf.PoiView.update_mode == "filter") cMapmaker.view_poi([list_category.value]);	// in targets
		let catname = list_category.value !== "-" ? `?category=${list_category.value}` : "";
		history.replaceState('', '', location.pathname + catname + location.hash);
		leaflet.enable(cMapmaker.mode == "map");
	};
};
var cmap_events = new cMapEvents();
