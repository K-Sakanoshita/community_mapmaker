"use strict";

// PoiData Control
var poiCont = (function () {
	var pdata = { geojson: [], targets: [], enable: [] };					//poi data variable
	var adata = [], latlngs = {}, geoidx = {};								//act data variable /  poi's latlng & geoidx

	return {
		pois: () => { return { pois: pdata, acts: adata, latlngs: latlngs } },
		targets: () => {													// return all targets
			let target = [];
			pdata.targets.forEach(names => target = target.concat(names));	// poisのtarget集計
			if (adata.length > 0) target.concat(Conf.google.targetName);
			return basic.uniq(target);
		},
		all_clear: () => { pdata = { geojson: [], targets: [], enable: [] } },
		set_actjson: (json) => { adata = json; },			// set GoogleSpreadSheetから帰ってきたJson
		add_geojson: (pois) => {      						// add geojson pois / pois: {geojson: [],targets: []}
			if (pois.enable == undefined) pois.enable = [];
			pois.geojson.forEach((val1, idx1) => {			// 既存Poiに追加
				let enable = pois.enable[idx1] == undefined ? true : pois.enable[idx1];
				let poi = { "geojson": pois.geojson[idx1], "targets": pois.targets[idx1], "enable": enable };
				poiCont.set_geojson(poi);
			});
			pdata.geojson.forEach((node, node_idx) => {
				if (latlngs[node.id] == undefined) {
					let ll = GeoCont.flat2single(node.geometry.coordinates, node.geometry.type);
					delete node.geometry.coordinates;			// メモリ削減のため座標情報を削除
					latlngs[node.id] = [ll[1], ll[0]];
					geoidx[node.id] = node_idx;
				}
			});
		},
		set_geojson: (poi) => {								// add_geojsonのサブ機能
			let cidx = pdata.geojson.findIndex((val) => val.id == poi.geojson.id);
			if (cidx === -1) {       	                   	// 無い時は追加
				pdata.geojson.push(poi.geojson);
				cidx = pdata.geojson.length - 1;
			};
			if (pdata.targets[cidx] == undefined) {  		// targetが無い時は追加
				pdata.targets[cidx] = poi.targets;
			} else {
				pdata.targets[cidx] = Object.assign(pdata.targets[cidx], poi.targets);
			};
			if (poi.enable !== undefined) pdata.enable[cidx] = poi.enable;
		},
		get_osmid: (osmid) => {           								// osmidを元にgeojsonと緯度経度、targetを返す
			let idx = geoidx[osmid];
			return idx == undefined ? undefined : { geojson: pdata.geojson[idx], latlng: latlngs[osmid], targets: pdata.targets[idx], enable: pdata.enable[idx] };
		},
		get_actid: (actid) => {
			let act = adata.filter(line => actid == line.id);
			return act == undefined ? undefined : act[0];
		},
		get_actlist: (osmid) => {		// get activities by osmid
			return adata.filter(a => a.osmid == osmid);
		},
		get_catname: (tags) => {          								// get Category Name from Conf.category(Global Variable)
			let key1 = Conf.category_keys.find(key => (tags[key] !== undefined) && key !== "*");
			key1 = key1 == undefined ? "*" : key1;
			let key2 = tags[key1] == undefined ? "*" : tags[key1];
			let catname = (key2 !== "") ? Conf.category[key1][key2] : "";   // known tags
			if (catname == undefined) console.log("get_catname: no key: " + key1 + "," + key2);
			return (catname == undefined) ? "-" : catname;
		},
		get_wikiname: (tags) => {          								// get Wikipedia Name from tag
			let wikiname = tags["wikipedia"] ? tags["wikipedia"].split(':')[1] : "";	// value値の":"の右側を返す
			return wikiname;
		},
		get_target: (targets) => {										// 指定したtargetのpoisとactsを返す
			let pois = filter_geojson(targets);
			return { "pois": pois, "acts": targets.indexOf(Conf.google.targetName) > -1 ? adata : [] };
		},
		list: function (targets) {              						// Grid.js向きの配列を出力
			let pois = filter_geojson(targets), datas = []; 			// targetsに指定されたpoiのみフィルター
			pois.geojson.forEach((node) => {
				let tags = node.properties;
				let name = tags.name == undefined ? "-" : tags.name;
				let category = poiCont.get_catname(tags);
				datas.push([node.id, "-", category, name]);
			});
			if (targets.indexOf(Conf.google.targetName) > -1) {			// targets内にgooglesheetがある場合
				adata.forEach((line) => {
					if (line !== undefined) {
						let newmode = line.id.split('/')[0];
						switch (newmode) {
							case "libc":
								let mm = !parseInt(line.mm) ? "--" : ("00" + line.mm).substr(-2);
								let dd = !parseInt(line.dd) ? "--" : ("00" + line.dd).substr(-2);
								datas.push([line.id, `${line.yyyy}/${mm}/${dd}`, line.category, line.title]);
								break;
							default:
								datas.push([line.id, basic.formatDate(new Date(line.updatetime), "YYYY/MM/DD"), line.category, line.title]);
								break;
						};
					};
				});
			};
			datas.sort((a, b) => { return (a[0] > b[0]) ? 1 : -1 });
			return datas;
		}
	};
	function filter_geojson(targets) {
		let tars = [], enas = [], lls = [];
		let geojson = pdata.geojson.filter((geojson_val, geojson_idx) => {
			let found = false;
			for (let target_idx in pdata.targets[geojson_idx]) {
				if (targets.includes(pdata.targets[geojson_idx][target_idx])) {
					tars.push(pdata.targets[geojson_idx]);
					lls.push(latlngs[geojson_val.id]);
					enas.push(pdata.enable[geojson_idx]);
					found = true;
					break;
				};
			};
			return found;
		});
		return { geojson: geojson, latlng: lls, targets: tars, enable: enas };
	};
})();

class poiMarker {

	static markers = {};

	static get_icon(tags) {		// get icon filename
		let keyn = Conf.category_keys.find(key => (tags[key] !== undefined) && key !== "*");
		keyn = keyn == undefined ? "*" : keyn;		// カテゴリに無いPOIへの対応
		return Conf.marker_tag[keyn][tags[keyn]];
	};

	static set(target, actonly) {								// Poi表示

		const make_marker = function (params) {		// Make Marker(Sometimes multiple markers are returned)
			return new Promise((resolve, reject) => {
				let tags = params.poi.geojson.properties.tags == undefined ? params.poi.geojson.properties : params.poi.geojson.properties.tags;
				let name = tags[params.langname] == undefined ? tags.name : tags[params.langname];
				name = (name == "" || name == undefined) ? "" : name;
				let actlists = poiCont.get_actlist(params.poi.geojson.id);
				let size, html = `<div class="d-flex align-items-center">`;
				let span_width = name !== "" ? name.length * Conf.effect.text.size : 0;
				let css_name = actlists.length > 0 ? "icon_attention" : "icon_normal";
				size = parseInt(basic.getStyleSheetValue(css_name, "height"));
				if (actlists.length > 0) html += `<img class="attention" src="./image/attention_noframe.svg">`;
				html += `<img class="${css_name}" src="./${Conf.icon.path}/${poiMarker.get_icon(tags)}" icon-name="${name}">`;
				let span = `<span class="icon" style="font-size: ${Conf.effect.text.size}px">${name}</span>`;
				if (name !== "" && Conf.effect.text.view) html += span;
				let icon = L.divIcon({ "className": "", "iconSize": [size + span_width, size], "iconAnchor": [size / 2, size / 2], "html": html + "</div>" });
				let marker = L.marker(new L.LatLng(params.poi.latlng[0], params.poi.latlng[1]), { icon: icon, draggable: false });
				marker.addTo(map).on('click', e => { cMapmaker.detail_view(e.target.mapmaker_id) });
				marker.mapmaker_id = params.poi.geojson.id;
				marker.mapmaker_key = params.target;
				marker.mapmaker_lang = params.langname;
				resolve([marker]);
			});
		};

		console.log("Marker.set: " + target);
		poiMarker.delete(target);
		poiMarker.markers[target] = [];
		let LL = GeoCont.get_LL();
		let all = poiCont.get_target(target);
		if (all.pois.geojson !== undefined) {		// pois表示
			all.pois.geojson.forEach(function (geojson, idx) {
				let poi = { "geojson": all.pois.geojson[idx], "targets": all.pois.targets[idx], "latlng": all.pois.latlng[idx], "enable": all.pois.enable[idx] };
				if (poi.enable && GeoCont.check_inner(poi.latlng, LL)) {
					let actlists = poiCont.get_actlist(poi.geojson.id);
					let actflag = (actonly && actlists.length > 0) ? true : !actonly;
					if (actflag) {
						make_marker({ target: target, poi: poi, act: all.acts, langname: 'name' }).then(marker => {
							if (marker !== undefined) marker.forEach(val => poiMarker.markers[target].push(val));	// 複数Marker対応(Wikipediaの解説など)
						});
					};
				};
			});
		};
	}

	static get(target, osmid) {				// Poi取得
		let idx = poiMarker.markers[target].findIndex(val => val.mapmaker_id == osmid);
		let marker = poiMarker.markers[target][idx];
		return marker;
	}

	static qr_add(target, osmid, url, latlng, text) {
		let idx = poiMarker.markers[target].findIndex(val => val.mapmaker_id == osmid);
		let qrcode = new QRCode({ content: url, join: true, container: "svg", width: 128, height: 128 });
		let data = qrcode.svg();
		let icon = L.divIcon({ "className": "icon", "iconSize": [512, 128], "html": `<div class="d-flex"><div class="flex-row">${data}</div><div class="p-2 bg-light"><span>${text}</span></div></div>` });
		let qr_marker = L.marker(new L.LatLng(latlng.lat, latlng.lng), { icon: icon, draggable: true });
		qr_marker.addTo(map);
		qr_marker.mapmaker_id = osmid + "-qr";
		qr_marker.mapmaker_key = target;
		qr_marker.mapmaker_svg = qrcode.svg;
		poiMarker.markers[target][idx] = [poiMarker.markers[target][idx], qr_marker];
		map.closePopup();
	}

	static select(poiid, detail) {								// Map move to PoiId & Zoom(config)
		return new Promise((resolve, reject) => {
			let poi = poiCont.get_osmid(poiid);
			let zoomlv = Conf.default.act_iconViewZoom >= map.getZoom() ? Conf.default.act_iconViewZoom : map.getZoom();
			if (poi !== undefined) {	// poi = osmid
				map.flyTo(poi.latlng, zoomlv, { animate: true, duration: 0.5 });
				if (detail) cMapmaker.detail_view(poiid, poiid);
				resolve();
			} else {					// poi = actid
				poi = poiCont.get_actid(poiid);
				let osmid = poiCont.get_osmid(poi.osmid);
				if (osmid !== undefined) {	// Found Poi
					map.flyTo(osmid.latlng, zoomlv, { animate: true, duration: 0.5 });
					if (detail) cMapmaker.detail_view(poi.osmid, poiid);
					resolve();
				} else {						// Not Found Poi
					winCont.spinner(true);
					OvPassCnt.get_osmid(poi.osmid).then((geojson) => {
						poiCont.add_geojson(geojson);
						osmid = poiCont.get_osmid(poi.osmid);
						map.flyTo(osmid.latlng, zoomlv, { animate: true, duration: 0.5 });
						if (detail) cMapmaker.detail_view(poi.osmid, poiid);
						winCont.spinner(false);
						resolve();
					}).catch((e) => {
						console.log(e);
						alert(glot.get("sverror_message"));
						winCont.spinner(false);
						reject();
					});
				};
			}
		});
	}

	static all_clear() { Object.keys(poiMarker.markers).forEach((target) => poidelete(target)) }	// all delete

	static delete(target, osmid) {														// Marker delete * don't set pdata
		if (osmid == undefined || osmid == "") {	// all osmid
			if (poiMarker.markers[target] !== undefined) {
				poiMarker.markers[target].forEach(marker => delmaker(marker));
				poiMarker.markers[target] = [];
			};
		} else {									// delete osmid
			let idx = poiMarker.markers[target].findIndex(vals => {
				let val = vals.length == undefined ? vals : vals[0];
				return val.mapmaker_id == osmid;
			});
			delmaker(poiMarker.markers[target][idx]);
		};
		map.closePopup();

		function delmaker(marker) {	// 実際にマーカーを消す処理
			if (marker == undefined) return;
			if (marker.length == undefined) { map.removeLayer(marker); return };
			marker.forEach(m => map.removeLayer(m));								// qr_code で markerが複数ある場合
		};
	}
};

// listTable管理(イベントやPoi情報を表示)
class listTable {

	static constructor() {
		this.grid;
		this.columns = [];
		this.lock = false;		// true then disable listtable
		this.list = [];
		this.timeout;
		this.height;
		this.flist;
	};

	static init() { // dataListに必要な初期化
		listTable.columns = Conf.list.columns.common;
		listTable.height = window.innerHeight * 0.4;

		function keyword_change() {        				// キーワード検索
			if (listTable.timeout > 0) {
				window.clearTimeout(listTable.timeout);
				listTable.timeout = 0;
			};
			listTable.timeout = window.setTimeout(() => {
				listTable.flist = listTable.#filter(listTable.list, list_keyword.value);
				listTable.grid.updateConfig({ "data": listTable.flist }).forceRender(document.getElementById("tableid"));
				cMapmaker.mode_change('list');
			}, 500);
		};
		list_keyword.removeEventListener('change', keyword_change);
		list_keyword.addEventListener('change', keyword_change);

		function category_change() {        			// カテゴリ名でキーワード検索
			listTable.flist = list_category.value !== "-" ? listTable.#filter(listTable.list, list_category.value) : listTable.list;
			listTable.grid.updateConfig({ "data": listTable.flist, "autoWidth": false }).forceRender(document.getElementById("tableid"));
			cMapmaker.mode_change('list');
		};
		list_category.removeEventListener('change', category_change);
		list_category.addEventListener('change', category_change);
	};

	static make(targets) {  									// リスト表示
		listTable.list = poiCont.list(targets);
		listTable.flist = listTable.list;
		listTable.#categorys(listTable.list);
		let option = { "columns": listTable.columns, "data": listTable.list, "height": listTable.height, sort: true, fixedHeader: true, "autoWidth": false };
		if (listTable.grid !== undefined) {
			listTable.grid.updateConfig(option).forceRender(document.getElementById("tableid"));
		} else {
			listTable.grid = new gridjs.Grid(option).render(document.getElementById("tableid"));
		};
		listTable.grid.on('rowClick', (...args) => {
			console.log("listTable: rowClick start");
			if (!listTable.lock) {
				listTable.lock = true;
				winCont.spinner(true);
				try {
					let actid = args[1].cell(0).data;
					listTable.select(actid);
					poiMarker.select(actid, true).then(() => {
						console.log("listTable: rowClick OK");
					}).catch(() => {
						console.log("listTable: rowClick NG");
					}).then(() => { listTable.lock = false });
				} catch (error) {
					winCont.spinner(false);
					listTable.lock = false;
				};
			};
		});
	};

	static disabled(mode) {
		list_category.disabled = mode;
		list_keyword.disabled = mode;
		listTable.lock = mode;
	};

	static heightSet(height) {									// set table height
		listTable.grid.updateConfig({ "height": height }).forceRender(document.getElementById("tableid"));
		cMapmaker.mode_change('list');
	};

	static select(actid) {									// リスト選択
		let rows = document.getElementsByClassName('gridjs-tr selected');
		if (rows.length > 0) Array.from(rows).forEach(row => { row.classList.remove("selected") });
		let lstidx = listTable.flist.findIndex(elm => elm[0] === actid);
		if (lstidx > -1) {
			let row = document.querySelector("#tableid table").rows[lstidx + 1];
			row.classList.add("selected");
			row.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
		}
	}

	static #filter(result, keyword) {						// 指定したキーワードで絞り込み
		return result.filter((row) => {
			return row.join(',').indexOf(keyword) > -1;
		});
	};

	static #categorys(result) {    							// resultを元に種別リストを作成
		winCont.select_clear(`list_category`);
		let pois = result.map(data => { return data[2] });
		pois = pois.filter((x, i, self) => { return self.indexOf(x) === i });
		pois.map(poi => winCont.select_add(`list_category`, poi, poi));
	};
}
