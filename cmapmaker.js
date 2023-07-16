class CMapMaker {

	constructor() {
		this.status = "initialize";
		this.detail = false;				// viewDetail表示中はtrue
		this.open_osmid = "";				// viewDetail表示中はosmid
		this.last_modetime = 0;
		this.mode = "map";

		this.id = 0;
		this.moveMapBusy = 0;
		this.changeKeywordWaitTime;
	};

	init() {
		console.log("CMapMaker: init.");
		MapLibre.on('moveend', this.eventMoveMap.bind(cMapMaker));   		// マップ移動時の処理
		MapLibre.on('zoomend', this.eventZoomMap.bind(cMapMaker));			// ズーム終了時に表示更新
		list_keyword.addEventListener('change', this.eventChangeKeyword.bind(cMapMaker));	// 
		list_category.addEventListener('change', this.eventChangeCategory.bind(cMapMaker));	// category change
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
			list_collapse_icon.className = params[this.mode][0];
			list_collapse.classList[params[this.mode][1]]('show');
			this.last_modetime = Date.now();
			this.status = "normal";
			mapid.focus();
		};
	};

	changeMap() {	// Change Map Style(rotation)
		MapLibre.changeMap();
	};

	load_static() {	// check static osm mode
		return new Promise((resolve, reject) => {
			if (!Conf.static.mode) {		// static mode以外は即終了
				resolve("cMapMaker: no static mode");
			} else {
				$.ajax({ "type": 'GET', "dataType": 'json', "url": Conf.static.osmjson, "cache": false }).done(function (data) {
					let ovanswer = OvPassCnt.set_osmjson(data);
					poiCont.add_geojson(ovanswer);
					resolve(ovanswer);
				}).fail(function (jqXHR, statusText, errorThrown) {
					console.log("cMapMaker: " + statusText);
					reject(jqXHR, statusText, errorThrown);
				});;
			};
		});
	};

	viewArea(targets) {			// Areaを表示させる
		console.log(`viewArea: Start.`);
		targets = targets[0] == "-" ? Conf.PoiView.targets : targets;	// '-'はすべて表示
		let pois = poiCont.get_pois(targets);
		targets.forEach((target) => {
			console.log("viewArea: " + target);
			MapLibre.addGeojson({ "type": "FeatureCollection", "features": pois.geojson }, target);
		});
		console.log("viewArea: End.");
	};

	viewPoi(targets) {		// Poiを表示させる
		let setcount = 0;
		let nowselect = listTable.getSelCategory();
		nowselect = nowselect[0] == "" ? "-" : nowselect[nowselect.length - 1];
		console.log(`viewPoi: Start(now select ${nowselect}).`);
		let zm = MapLibre.getZoom();
		poiMarker.delete_all();
		targets = targets[0] == "-" ? Conf.PoiView.targets : targets;					// '-'はすべて表示
		let subcategory = Conf.PoiView.targets.indexOf(nowselect) > -1 || nowselect == "-" ? false : true;	// サブカテゴリ選択時はtrue
		if (subcategory) {	// targets 内に選択肢が含まれていない場合（サブカテゴリ選択時）
			let target = listTable.getSelCategory()[0];			// メインカテゴリを取得
			if (zm >= Conf.PoiViewZoom[target]) {
				poiMarker.set("", false, listTable.flist);
				setcount = setcount + listTable.flist.length;
			} else {
				let flist = listTable.filterTarget(Conf.google.targetName);
				poiMarker.set("", true, flist);
			}
		} else {			// targets 内に選択肢が含まれている場合
			targets.forEach((target) => {
				if (target == nowselect || nowselect == "-") {	// 選択している種別の場合
					let activity = target == Conf.google.targetName;
					if (zm >= Conf.PoiViewZoom[target] || activity) {
						poiMarker.set(target, activity,);
						setcount++;
					}
				}
			});
		}
		/*
		if (setcount == 0 && listTable.getFlistCount() > 0) {		// Poi表示無し&リストテーブルには存在する = ズーム無視で表示
			let flist = listTable.filterTarget(Conf.google.targetName);
			poiMarker.set("", true, flist);
		}
		*/
		console.log("viewPoi: End.");
	};

	get_poi(targets) {		// OSMとGoogle SpreadSheetからPoiを取得してリスト化
		return new Promise((resolve) => {
			console.log("cMapMaker: get_poi: Start");
			winCont.spinner(true);
			var keys = (targets !== undefined && targets !== "") ? targets : Object.values(Conf.PoiView.targets);
			let PoiLoadZoom = 99;
			for (let [key, value] of Object.entries(Conf.PoiViewZoom)) {
				if (key !== Conf.google.targetName) PoiLoadZoom = value < PoiLoadZoom ? value : PoiLoadZoom;
			};
			if ((MapLibre.getZoom() < PoiLoadZoom) && !Conf.static.mode) {
				winCont.spinner(false);
				console.log("[success]cMapMaker: get_poi End(more zoom).");
				resolve({ "update": true });
			} else {
				OvPassCnt.get(keys, status_write).then(ovanswer => {
					winCont.spinner(false);
					if (ovanswer) poiCont.add_geojson(ovanswer);
					console.log("[success]cMapMaker: get_poi End.");
					global_status.innerHTML = "";
					resolve({ "update": true });
				})/*.catch(() => {
					winCont.spinner(false);
					console.log("[error]cMapMaker: get_poi end.");
					global_status.innerHTML = "";
					resolve({ "update": false });
				})*/;
			};
		});

		function status_write(progress) {
			global_status.innerHTML = progress;
		};
	};

	viewDetail(osmid, openid) {	// PopUpを表示(marker,openid=actlst.id)
		const detail_close = () => {
			let catname = listTable.getSelCategory() !== "-" ? `?category=${listTable.getSelCategory()}` : "";
			winCont.modal_close();
			history.replaceState('', '', location.pathname + catname + location.hash);
			this.open_osmid = "";
			this.detail = false;
			mapid.focus();
		};
		if (this.detail) detail_close();
		let osmobj = poiCont.get_osmid(osmid);
		let tags = osmobj == undefined ? { "targets": [] } : osmobj.geojson.properties;
		tags["*"] = "*";
		let target = osmobj == undefined ? "*" : osmobj.targets[0];
		let category = poiCont.get_catname(tags);
		let title = `<img src="./${Conf.icon.path}/${poiMarker.get_icon(tags)}" class="normal">`, message = "";

		for (let i = 0; i < Conf.osm[target].titles.length; i++) {
			if (tags[Conf.osm[target].titles[i]] !== void 0) {
				title += `${tags[Conf.osm[target].titles[i]]}`;
				break;
			};
		};
		if (title == "") title = category[0];
		if (title == "") title = glot.get("undefined");
		winCont.menu_make(Conf.detail_menu, "modal_menu");
		winCont.modal_progress(0);
		this.open_osmid = osmid;

		message += modal_osmbasic.make(tags);		// append OSM Tags(仮…テイクアウトなど判別した上で最終的には分ける)
		if (tags.wikipedia !== undefined) {			// append wikipedia
			message += modal_wikipedia.element();
			winCont.modal_progress(100);
			modal_wikipedia.make(tags).then(html => {
				modal_wikipedia.set_dom(html);
				winCont.modal_progress(0);
			});
		};

		// append activity
		let catname = listTable.getSelCategory() !== "-" ? `&category=${listTable.getSelCategory()}` : "";
		let actlists = poiCont.get_actlist(osmid);
		history.replaceState('', '', location.pathname + "?" + osmid + (!openid ? "" : "." + openid) + catname + location.hash);
		if (actlists.length > 0) {	// アクティビティ有り
			message += modal_activities.make(actlists);
			winCont.modal_open({ "title": title, "message": message, "append": Conf.detail_view.buttons, "mode": "close", "callback_close": detail_close, "menu": true, "openid": openid });
		} else {					// アクティビティ無し
			winCont.modal_open({ "title": title, "message": message, "append": Conf.detail_view.buttons, "mode": "close", "callback_close": detail_close, "menu": true, "openid": openid });
		}
		this.detail = true;
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

	playback() {					// 指定したリストを連続再生()
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
			MapLibre.setZoom(Conf.listTable.playback.zoomLevel);
			this.mode_change("list");
			this.status = "playback";
			icon_change("stop");
			setTimeout(view_control, speed_calc(), listTable.getFilterList(), 0);
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

	// EVENT: map moveend発生時のイベント
	eventMoveMap() {
		const MoveMapPromise = function (resolve, reject) {
			console.log("eventMoveMap: Start.");
			if (this.moveMapBusy > 1) return; 		// 処理中の時は戻る
			if (this.moveMapBusy == 1) clearTimeout(this.id);		// no break and cancel old timer.
			this.moveMapBusy = 1;
			this.id = setTimeout(() => {
				console.log("eventMoveMap: End.");
				this.moveMapBusy = 2;
				this.get_poi().then((status) => {
					this.moveMapBusy = 0;
					let targets = (Conf.listTable.targets.indexOf("targets") > -1) ? [listTable.getSelCategory()] : ["-"];
					if (Conf.PoiView.update_mode == "all" || status.update) {
						listTable.make();					// view all list
						listTable.makeCategory(Conf.listTable.targets);
						cMapMaker.eventChangeCategory();
						this.viewArea(targets);	// in targets
						this.viewPoi(targets);		// in targets
						resolve();
					} else {
						this.moveMapBusy = 0;
						let bindMoveMapPromise = MoveMapPromise.bind(this);
						bindMoveMapPromise(resolve, reject);	// 失敗時はリトライ(接続先はoverpass.jsで変更)
					};
				})/*.catch(() => {
					this.moveMapBusy = 0;
					console.log("eventMoveMap: Reject");
					reject();
				});*/
			}, 700);
		};
		return new Promise((resolve, reject) => {
			if (this.moveMapBusy < 2) {
				let bindMoveMapPromise = MoveMapPromise.bind(cMapMaker);
				bindMoveMapPromise(resolve, reject);
			} else {
				resolve();
			}
		});
	};

	// EVENT: View Zoom Level & Status Comment
	eventZoomMap() {
		let poizoom = false;
		for (let [key, value] of Object.entries(Conf.PoiViewZoom)) {
			if (MapLibre.getZoom() >= value) poizoom = true;
		};
		let message = `${glot.get("zoomlevel")}${Math.round(MapLibre.getZoom())} `;
		if (!poizoom) message += `<br>${glot.get("morezoom")}`;
		zoomlevel.innerHTML = "<h2 class='zoom'>" + message + "</h2>";
	};

	// EVENT: キーワード検索
	eventChangeKeyword() {
		if (this.changeKeywordWaitTime > 0) {
			window.clearTimeout(this.changeKeywordWaitTime);
			this.changeKeywordWaitTime = 0;
		};
		this.changeKeywordWaitTime = window.setTimeout(() => {
			listTable.filterKeyword();
			this.mode_change('list');
		}, 500);
	};

	// EVENT: change category
	eventChangeCategory() {
		let selcategory = listTable.getSelCategory();
		listTable.filterCategory(selcategory);
		//let targets = (Conf.listTable.targets.indexOf("targets") > -1) ? [list_category.value] : ["-"];
		if (Conf.PoiView.update_mode == "filter") { this.viewPoi([selcategory]) };	// in targets
		let catname = selcategory !== "-" ? `?category=${selcategory}` : "";
		history.replaceState('', '', location.pathname + catname + location.hash);
	};
};
