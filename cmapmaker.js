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

	addEvents() {
		console.log("CMapMaker: init.");
		mapLibre.on('moveend', this.eventMoveMap.bind(cMapMaker));   		// マップ移動時の処理
		mapLibre.on('zoomend', this.eventZoomMap.bind(cMapMaker));			// ズーム終了時に表示更新
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
			winCont.window_resize();
		};
	};

	changeMap() {	// Change Map Style(rotation)
		mapLibre.changeMap();
	};

	load_static() {	// check static osm mode
		return new Promise((resolve, reject) => {
			if (!Conf.static.mode) {		// static mode以外は即終了
				resolve("cMapMaker: no static mode");
			} else {
				$.ajax({ "type": 'GET', "dataType": 'json', "url": Conf.static.osmjson, "cache": false }).done(function (data) {
					let ovanswer = OvPassCnt.setOsmJson(data);
					poiCont.add_geojson(ovanswer)
					poiCont.setActlnglat()
					console.log("cMapMaker: static load done.")
					resolve(ovanswer);
				}).fail(function (jqXHR, statusText, errorThrown) {
					console.log("cMapMaker: " + statusText);
					reject(jqXHR, statusText, errorThrown);
				});
			};
		});
	};

	viewArea(targets) {			// Areaを表示させる
		console.log(`viewArea: Start.`);
		targets = targets[0] == "-" ? Object.keys(Conf.view.poiZoom) : targets;	// '-'はすべて表示
		let pois = poiCont.getPois(targets);
		targets.forEach((target) => {
			console.log("viewArea: " + target);
			mapLibre.addLine({ "type": "FeatureCollection", "features": pois.geojson }, target);
		});
		console.log("viewArea: End.");
	}

	viewPoi(targets) {		// Poiを表示させる
		let setcount = 0;
		let nowselect = listTable.getSelCategory();
		nowselect = nowselect[0] == "" ? "-" : nowselect[nowselect.length - 1];
		console.log(`viewPoi: Start(now select ${nowselect}).`);
		poiMarker.delete_all();
		targets = targets[0] == "-" ? Object.keys(Conf.view.poiZoom) : targets;					// '-'はすべて表示
		let subcategory = Object.keys(Conf.view.poiZoom).indexOf(nowselect) > -1 || nowselect == "-" ? false : true;	// サブカテゴリ選択時はtrue
		if (subcategory) {	// targets 内に選択肢が含まれていない場合（サブカテゴリ選択時）
			poiMarker.setPoi("", false, listTable.flist);
			setcount = setcount + listTable.flist.length;
		} else {			// targets 内に選択肢が含まれている場合
			console.log("viewPoi: " + targets.concat())
			targets.forEach((target) => {
				if (target == nowselect || nowselect == "-") {	// 選択している種別の場合
					poiMarker.setPoi(target, target == Conf.google.targetName);
					setcount++;
				}
			})
		}
		console.log("viewPoi: End.")
	}

	// 画面内のActivity画像を表示させる
	makeImages() {
		let LL = mapLibre.get_LL(true);
		let acts = poiCont.adata.filter(act => { return geoCont.checkInner(act.lnglat, LL) && act.picture_url1 !== "" });
		acts = acts.map(act => {
			let urls = [];
			let actname = act.id.split("/")[0];
			let forms = Conf.activities[actname].form;
			Object.keys(forms).forEach(key => { if (forms[key].type == "image_url") urls.push(act[key]) });
			return { "src": urls, "osmid": act.osmid, "title": act.title }
		});
		winCont.setImages(images, acts);
	}

	// OSMとGoogle SpreadSheetからPoiを取得してリスト化
	updateOsmPoi(targets) {
		return new Promise((resolve) => {
			console.log("cMapMaker: updateOsmPoi: Start");
			winCont.spinner(true);
			var keys = (targets !== undefined && targets !== "") ? targets : Object.keys(Conf.view.poiZoom);
			let PoiLoadZoom = 99;
			for (let [key, value] of Object.entries(Conf.view.poiZoom)) {
				if (key !== Conf.google.targetName) PoiLoadZoom = value < PoiLoadZoom ? value : PoiLoadZoom;
			};
			if ((mapLibre.getZoom(true) < PoiLoadZoom)) {
				winCont.spinner(false);
				console.log("[success]cMapMaker: updateOsmPoi End(more zoom).");
				resolve({ "update": true });
			} else {
				OvPassCnt.getGeojson(keys, status_write).then(ovanswer => {
					winCont.spinner(false);
					if (ovanswer) {
						poiCont.add_geojson(ovanswer)
						poiCont.setActlnglat()
					};
					console.log("[success]cMapMaker: updateOsmPoi End.");
					global_status.innerHTML = "";
					resolve({ "update": true });
				}).catch(() => {
					winCont.spinner(false);
					console.log("[error]cMapMaker: updateOsmPoi end.");
					global_status.innerHTML = "";
					resolve({ "update": false });
				});
			};
		});

		function status_write(progress) {
			global_status.innerHTML = progress;
		};
	};

	viewImage(imgdom) {
		console.log("viewImage: Start.");
		let osmid = imgdom.getAttribute("osmid");
		let poi = poiCont.get_osmid(osmid);
		let zoomlv = Math.max(mapLibre.getZoom(true), Conf.map.modalZoom);
		if (poi !== undefined) {
			mapLibre.flyTo(poi.lnglat, zoomlv);
			cMapMaker.viewDetail(osmid);
			console.log("viewImage: View OK.");
		}
	}

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
		if (osmobj == undefined) { console.log("Error: No osmobj"); return }	// Error

		let tags = osmobj.geojson.properties;
		let target = osmobj.targets[0];
		tags["*"] = "*";
		target = target == undefined ? "*" : target;					// targetが取得出来ない実在POI対応
		let category = poiCont.getCatnames(tags);
		let title = `<img src="./${Conf.icon.path}/${poiMarker.get_icon(tags)}">`, message = "";

		for (let i = 0; i < Conf.osm[target].titles.length; i++) {
			if (tags[Conf.osm[target].titles[i]] !== void 0) {
				title += `${tags[Conf.osm[target].titles[i]]}`;
				break;
			};
		};
		if (title == "") title = category[0];
		if (title == "") title = glot.get("undefined");
		winCont.menu_make(Conf.menu.modal, "modal_menu");
		winCont.modal_progress(0);
		this.open_osmid = osmid;

		message += modal_osmbasic.make(tags);		// append OSM Tags(仮…テイクアウトなど判別した上で最終的には分ける)
		if (tags.wikipedia !== undefined) {			// append wikipedia
			message += modal_wikipedia.element();
			winCont.modal_progress(100);
			modal_wikipedia.make(tags, Conf.wikipedia.image).then(html => {
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
			winCont.modal_open({ "title": title, "message": message, "append": Conf.menu.buttons, "mode": "close", "callback_close": detail_close, "menu": true, "openid": openid });
		} else {					// アクティビティ無し
			winCont.modal_open({ "title": title, "message": message, "append": Conf.menu.buttons, "mode": "close", "callback_close": detail_close, "menu": true, "openid": openid });
		}
		this.detail = true;

	};

	shareURL(actid) {	// URL共有機能
		actid = actid == undefined ? "" : "." + actid;
		let url = location.origin + location.pathname + location.search + actid + location.hash;
		navigator.clipboard.writeText(url);
	};

	playback() {		// 指定したリストを連続再生()
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
			mapLibre.setZoom(Conf.listTable.playback.zoomLevel);
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
		let csv = basic.makeArray2CSV(poiCont.makeList(Conf.listTable.target));
		let bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
		let blob = new Blob([bom, csv], { 'type': 'text/csv' });

		let link = document.getElementById(linkid) ? document.getElementById(linkid) : document.createElement("a");
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
				this.updateOsmPoi().then((status) => {
					this.moveMapBusy = 0;
					switch (status.update) {
						case true:
							this.moveMapBusy = 0;
							let targets = [listTable.getSelCategory()];
							console.log("eventMoveMap:" + targets)
							if (Conf.view.poiFilter !== "") {		// 非連動以外は更新
								listTable.makeList();					// view all list
								listTable.makeSelectList(Conf.listTable.category)
								listTable.filterCategory(listTable.getSelCategory())
								this.viewArea(targets);	// in targets
								this.viewPoi(targets);	// in targets
								this.makeImages()
							};
							resolve();
							break;
						case false:
							let bindMoveMapPromise = MoveMapPromise.bind(this);
							bindMoveMapPromise(resolve, reject);	// 失敗時はリトライ(接続先はoverpass.jsで変更)
							break;
					}
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
		for (let [key, value] of Object.entries(Conf.view.poiZoom)) {
			if (mapLibre.getZoom(true) >= value) poizoom = true;
		};
		let message = `${glot.get("zoomlevel")}${mapLibre.getZoom(true)} `;
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
			listTable.filterKeyword(list_keyword.value);
			this.mode_change('list');
		}, 500);
	};

	// EVENT: カテゴリ変更時のイベント
	eventChangeCategory() {
		let selcategory = listTable.getSelCategory();
		let targets = Conf.listTable.target == "targets" ? [selcategory] : ["-"];
		listTable.filterCategory(selcategory);
		if (Conf.view.poiFilter == "filter") { this.viewPoi(targets) };	// in targets
		let catname = selcategory !== "-" ? `?category=${selcategory}` : "";
		history.replaceState('', '', location.pathname + catname + location.hash);
	};
};
