"use strict";

// PoiData Control
class poiCont {
	static pdata = { geojson: [], targets: [], enable: [] };					//poi data variable
	static adata = [];															//act data variable /  poi's latlng & geoidx
	static cat_cache = {};
	static latlngs = {};
	static geoidx = {};
	static #parent = [];			// (Poiのみ)親ポリゴンを示す
	static polygons = [];			// Polygon内に含まれるか調べるためのポリゴン一覧

	static pois() { return { pois: poiCont.pdata, acts: poiCont.adata, latlngs: poiCont.latlngs } };

	static targets() {													// return all targets
		let target = [];
		poiCont.pdata.targets.forEach(names => target = target.concat(names));	// poisのtarget集計
		if (poiCont.adata.length > 0) target.concat(Conf.google.targetName);
		return basic.uniq(target);
	};

	static delete_all() { poiCont.pdata = { geojson: [], targets: [], enable: [] } };

	static set_actjson(json) { poiCont.adata = json };		// set GoogleSpreadSheetから帰ってきたJson

	static add_geojson(pois) {								// add geojson pois / pois: {geojson: [],targets: []}
		let children = [];
		pois.geojson.forEach((node, node_idx) => {			// 既存Poiに追加
			let enable = poiCont.pdata.enable[node_idx] == undefined ? false : poiCont.pdata.enable[node_idx];
			let poi = { "geojson": pois.geojson[node_idx], "targets": pois.targets[node_idx], "enable": enable };
			if (!enable) {
				poiCont.pdata.enable[node_idx] = enable;
				poiCont.set_geojson(poi);
				if (poiCont.latlngs[node.id] == undefined) {// 初期登録時
					let ll = GeoCont.flat2single(node.geometry.coordinates, node.geometry.type);
					poiCont.latlngs[node.id] = [ll[1], ll[0]];
					poiCont.geoidx[node.id] = node_idx;
					if (node.geometry.type !== "Point") {	// way or polygon
						let targets = poiCont.pdata.targets[node_idx];
						if (targets.length > 0 && (targets.length !== 1 || targets[0] !== "wikipedia")) {
							if (GeoCont.multi2flat(node.geometry.coordinates)[0].length < 50) {
								let exp = Conf.osm[targets[0]].expression;
								node.properties.stroke = exp.stroke;
								node.properties["stroke-width"] = exp["stroke-width"];
								node.properties.fill = exp.stroke;
								node.properties["fill-opacity"] = 0.3;
								leaflet.geojsonAdd(node);
							};
						};
						if (node.geometry.type == "Polygon") poiCont.polygons[node.id] = node;	// 後でPolygon内のPoi検索に利用
					};
					children[node.id] = node;											// Polygonもchildrenに追加
				};
			}
		});
		var pt1 = {
			"type": "Feature",
			"properties": {},
			"geometry": {
				"type": "Point",
				"coordinates": [0, 0]
			}
		};
		for (const child in children) {	// childrenがpolygonに含まれているか確認
			pt1.geometry.coordinates[0] = poiCont.latlngs[child][1];
			pt1.geometry.coordinates[1] = poiCont.latlngs[child][0];
			for (const polygon in poiCont.polygons) {
				if (child !== polygon) {	// 同一要素はチェックしない
					if (turf.inside(pt1, poiCont.polygons[polygon])) {	// ポリゴン内に存在する場合
						console.log(child + " in " + polygon);
						poiCont.#parent[child] = poiCont.polygons[polygon];
					};
				}
			}
		};
	};

	static set_geojson(poi) {								// add_geojsonのサブ機能
		let cidx = poiCont.pdata.geojson.findIndex((val) => val.id == poi.geojson.id);
		if (cidx === -1) {       	                   	// 無い時は追加
			poiCont.pdata.geojson.push(poi.geojson);
			cidx = poiCont.pdata.geojson.length - 1;
		};
		if (poiCont.pdata.targets[cidx] == undefined) {  		// targetが無い時は追加
			poiCont.pdata.targets[cidx] = poi.targets;
		} else {
			poiCont.pdata.targets[cidx] = Object.assign(poiCont.pdata.targets[cidx], poi.targets);
		};
		poiCont.pdata.enable[cidx] = poi.enable;
	};

	static get_parent(osmid) {											// osmidを元に親geojson全体を返す
		return poiCont.#parent[osmid];
	};

	static get_osmid(osmid) {           								// osmidを元にgeojsonと緯度経度、targetを返す
		let idx = poiCont.geoidx[osmid];
		return idx == undefined ? undefined : {
			geojson: poiCont.pdata.geojson[idx], latlng: poiCont.latlngs[osmid],
			targets: poiCont.pdata.targets[idx], enable: poiCont.pdata.enable[idx]
		};
	};

	static get_actid(actid) {
		let act = poiCont.adata.filter(line => actid == line.id);
		return act == undefined ? undefined : act[0];
	};
	static get_actlist(osmid) {		// get activities by osmid
		return poiCont.adata.filter(a => a.osmid == osmid);
	};

	static get_catname(tags) {          								// get Category Name from Conf.category(Global Variable)
		if (poiCont.cat_cache[tags.id] !== undefined) return Array.from(poiCont.cat_cache[tags.id]);  // 配列をコピーして返す(参照返しだと値が壊れる)
		let catname = "", mainkey = "", mainval = "";
		let mainkeys = Conf.category_keys.filter(key => (tags[key] !== undefined) && key !== "*");	// srarch tags
		if (mainkeys == undefined) return Conf.category.tag['*']['*'];
		for (mainkey of mainkeys) {
			mainval = tags[mainkey] == undefined ? "*" : tags[mainkey];
			catname = Conf.category[mainkey][mainval];
			catname = (catname !== undefined) ? catname : "";
			if (catname !== "") break;		// if found catname then break
		}

		let subcatname = "";
		let subtag = Conf.category_sub[mainval];									// ex: subtag = {"religion": {"shinto":"a.svg","buddhist":"b.svg"}}
		if (subtag !== undefined) {
			for (let subkey of Object.keys(subtag)) {								// subkey: ex: religion
				if (subcatname !== "") break;
				for (let subval of Object.keys(subtag[subkey])) { 					// subval: ex: shinto
					subcatname = (tags[subkey] == subval) ? subtag[subkey][subval] : "";
					if (subcatname !== "") break;
				};
			};
		};
		if (catname == "") {
			console.log("poiMarker: get_catname: no key: " + mainkey + "," + mainval + " / " + tags.id);
			catname = glot.get("undefined");
		};
		poiCont.cat_cache[tags.id] = [catname, subcatname];
		return [catname, subcatname];
	};

	static get_wikiname(tags) {          									// get Wikipedia Name from tag
		let wikiname = tags["wikipedia"] ? tags["wikipedia"].split(':')[1] : "";	// value値の":"の右側を返す
		return wikiname;
	};

	static get_target(target) {											// 指定したtargetのpoisとactsを返す
		let pois = poiCont.#filter_geojson(target);
		let acts = [];
		switch (target) {
			case "":
			case "activity":
				acts = poiCont.adata;
				break;
			default:
				acts = poiCont.adata.filter(a => { return a.category == target });
				break;
		};
		return { "pois": pois, "acts": acts };
	};

	static list(targets) {              									// Grid.js向きの配列を出力
		let pois = poiCont.#filter_geojson(targets), datas = []; 			// targetsに指定されたpoiのみフィルター
		for (const [idx, node] of pois.geojson.entries()) {
			let tags = node.properties, data = [];
			Conf.list.columns.poi_fields.forEach(key => {
				if (key == "#category") {									// #は内部データを利用する意味
					let names = poiCont.get_catname(tags);
					if (names[1] !== "") names[0] = `${names[0]}(${names[1]})`;
					data.push(names[0]);		// category追加
				} else if (key.indexOf("#parent") > -1) {					// 親データを使う意味
					if (tags.id == "way/1093901723") {
						console.log();
					}
					let pGeo = poiCont.get_parent(tags.id);
					let ptag;
					if (pGeo != undefined) ptag = pGeo.properties[key.substring(key.indexOf(".") + 1)];
					data.push(ptag == undefined ? "" : ptag);				// osmtag追加
				} else {
					data.push(tags[key] == undefined ? "-" : tags[key]);	// osmtag追加
				};
			});
			data.push(pois.targets[idx]);									// listの最後にtargetを追加
			datas.push(data);
		};
		if (targets.indexOf(Conf.google.targetName) > -1) {			// targetsにgooglesheet名があればリストに追加
			poiCont.adata.forEach((line) => {
				if (line !== undefined) {
					let newmode = line.id.split('/')[0];
					switch (newmode) {
						case "libc":
							let mm = !parseInt(line.mm) ? "--" : ("00" + line.mm);
							let dd = !parseInt(line.dd) ? "--" : ("00" + line.dd);
							mm = mm.substring(mm.length - 2);
							dd = dd.substring(mm.length - 2);
							datas.push([line.id, `${line.yyyy}/${mm}/${dd}`, line.category, line.title]);
							data.push(targets);								// listの最後にtargetを追加
							break;
						default:
							let data = [];
							Conf.list.columns.act_fields.forEach(key => {
								if (key.indexOf("datetime") > -1) {			// フィールド名に日時を含む場合
									data.push(basic.formatDate(new Date(line.updatetime), "YYYY/MM/DD"));
								} else if (key.indexOf("#category") > -1) {
									let osm_data = poiCont.get_osmid(line.osmid);
									if (osm_data !== undefined) {
										let osm_category = poiCont.get_catname(osm_data.geojson.properties);
										data.push(osm_category);			// Categoryを指定した場合
									};
								} else if (key.indexOf("#") > -1) {
									let tag_name = key.substring(key.indexOf("#") + 1);
									let osm_key = poiCont.get_osmid(line.osmid).geojson.properties[tag_name];
									data.push(osm_key);						// OSM tag名を指定した場合
								} else {
									data.push(line[key] == undefined ? "-" : line[key]);	// gsheet追加
								}
							});
							data.push(targets);									// listの最後にtargetを追加
							datas.push(data);
							break;
					};
				};
			});
		};
		datas.sort((a, b) => { return (a[0] > b[0]) ? 1 : -1 });
		return datas;
	}

	static #filter_geojson(targets) {
		let tars = [], enas = [], lls = [];
		let geojson = poiCont.pdata.geojson.filter((geojson_val, geojson_idx) => {
			let found = false;
			for (let target_idx in poiCont.pdata.targets[geojson_idx]) {
				if (targets.includes(poiCont.pdata.targets[geojson_idx][target_idx])) {
					tars.push(poiCont.pdata.targets[geojson_idx]);
					lls.push(poiCont.latlngs[geojson_val.id]);
					enas.push(poiCont.pdata.enable[geojson_idx]);
					found = true;
					break;
				};
			}
			return found;
		});
		return { geojson: geojson, latlng: lls, targets: tars, enable: enas };
	}

}

class poiMarker {

	static #markers = {};
	static #osmpois = [];		// アイコン表示させたOSMIDリスト

	static get_icon(tags) {		// get icon filename
		let mainico = "", subicon = "", mainkey = "", mainval = "";
		let mainkeys = Conf.category_keys.filter(key => (tags[key] !== undefined) && key !== "*");	// srarch tags
		if (mainkeys == undefined) return Conf.marker.tag['*']['*'];
		for (mainkey of mainkeys) {
			mainval = tags[mainkey] == undefined ? "*" : tags[mainkey];
			try {
				mainico = Conf.marker.tag[mainkey][mainval];
			} catch {
				mainico = "";
			}
			mainico = (mainico !== undefined) ? mainico : "";
			if (mainico !== "") break;		// if found icon then break
		}

		let subtag = Conf.marker.subtag[mainval];					// ex: subtag = {"religion": {"shinto":"a.svg","buddhist":"b.svg"}}
		if (subtag !== undefined) {
			for (let subkey of Object.keys(subtag)) {				// subkey: ex: religion
				if (subicon !== "") break;
				for (let subval of Object.keys(subtag[subkey])) { 	// subval: ex: shinto
					subicon = (tags[subkey] == subval) ? subtag[subkey][subval] : "";
					if (subicon !== "") break;
				};
			};
		};
		mainico = subicon !== "" ? subicon : mainico;
		return mainico == "" ? Conf.marker.tag['*']['*'] : mainico;
	}

	// Poi表示(actonly:true時はGSheetデータが無いと非表示)
	// params{ target, actonly, flist } / flist指定時はtargetを無視
	static set(target, actonly, flist) {

		const make_marker = function (params) {		// Make Marker(Sometimes multiple markers are returned)
			return new Promise((resolve, reject) => {
				let tags = params.poi.geojson.properties.tags == undefined ? params.poi.geojson.properties : params.poi.geojson.properties.tags;
				let name = tags[params.langname] == undefined ? tags.name : tags[params.langname];
				name = tags["bridge:name"] == undefined ? name : tags["bridge:name"];	// 橋の名称があれば優先
				name = (name == "" || name == undefined) ? "" : name;
				let actlists = poiCont.get_actlist(params.poi.geojson.id);
				let html = `<div class="d-flex align-items-center">`;
				let span_width = name !== "" ? name.length * Conf.effect.text.size : 0;
				let css_name = actlists.length > 0 ? "attention" : "normal";
				let size = Conf.icon[css_name];
				html += `<img class="${css_name}" src="./${Conf.icon.path}/${poiMarker.get_icon(tags)}" icon-name="${name}" onclick="cMapmaker.detail_view('${params.poi.geojson.id}')">`;
				let span = `<span class="icon ${css_name} fs-${Conf.effect.text.size}">${name}</span>`;
				if (name !== "" && Conf.effect.text.view) html += span;
				let icon = L.divIcon({ "className": "", "iconSize": [size + span_width, size], "iconAnchor": [size / 2, size / 2], "html": html + "</div>" });
				let marker = L.marker(new L.LatLng(params.poi.latlng[0], params.poi.latlng[1]), { icon: icon, draggable: false, zIndexOffset: params.zIndexOffset });
				marker.addTo(map); //.on('click', e => { cMapmaker.detail_view(e.target.mapmaker_id) });
				marker.mapmaker_id = params.poi.geojson.id;
				marker.mapmaker_key = params.target;
				marker.mapmaker_lang = params.langname;
				resolve([marker]);
			});
		};

		let LL = GeoCont.get_LL();
		if (flist !== undefined) {
			// set flist
			console.log("poiMarker: set: " + flist.length + " counts");
			target = "flist";
			poiMarker.delete_all();
			poiMarker.#markers.flist = [];
			flist.forEach(list => {
				let poi = poiCont.get_osmid(list[0]);
				if (poi !== undefined) {
					if (poi.enable == false && GeoCont.check_inner(poi.latlng, LL)) {
						poi.enable = true;
						let actlists = poiCont.get_actlist(poi.geojson.id);
						let viewflag = (actonly && actlists.length > 0) ? true : !actonly;
						if (viewflag && !poiMarker.#osmpois.includes(poi.geojson.id)) {		// act ok and 未表示の場合
							let zIdx = actlists.length > 0 ? 1000 : 0;
							poiMarker.#osmpois.push(poi.geojson.id);
							make_marker({ target: target, poi: poi, langname: 'name', zIndexOffset: zIdx }).then(
								marker => { poiMarker.#markers[target].push(marker) }
							);
						};
					};
				};
			});
		} else {
			// set target(activity etc.)
			let org_target = target;
			target = target == "-" ? "" : target;
			if (target !== "") target = (Conf.PoiView.targets.indexOf(target) > -1) ? target : "activity";
			console.log("poiMarker: set: " + target);
			poiMarker.delete(target);
			poiMarker.#markers[target] = [];
			let all = poiCont.get_target(target);
			if (all.pois.geojson !== undefined) {	// pois&acts表示
				all.pois.geojson.forEach(function (geojson, idx) {
					let poi = { "geojson": all.pois.geojson[idx], "targets": all.pois.targets[idx], "latlng": all.pois.latlng[idx], "enable": all.pois.enable[idx] };
					if (poi.enable == false && GeoCont.check_inner(poi.latlng, LL)) {
						poi.enable = true;
						let actlists = poiCont.get_actlist(poi.geojson.id);
						let viewflag = (actonly && actlists.length > 0) ? true : !actonly;
						if (viewflag && !poiMarker.#osmpois.includes(geojson.id)) {		// act ok and 未表示の場合
							let zIdx = actlists.length > 0 ? 1000 : 0;
							poiMarker.#osmpois.push(geojson.id);
							make_marker({ target: target, poi: poi, langname: 'name', zIndexOffset: zIdx }).then(marker => {
								if (marker !== undefined) marker.forEach(val => poiMarker.#markers[target].push(val));	// 複数Marker対応(Wikipediaの解説など)
							});
						};
					};
				});
			};

			if (all.acts.length > 0) {				// acts表示
				all.acts.forEach((act) => {
					if (!poiMarker.#osmpois.includes(act.osmid)) {
						let osm = poiCont.get_osmid(act.osmid);
						if (osm !== undefined && (act.category == org_target || org_target == "activity")) {
							let poi = { "geojson": osm.geojson, "targets": osm.targets, "latlng": osm.latlng, "enable": osm.enable };
							if (poi.enable == false && GeoCont.check_inner(poi.latlng, LL)) {
								poi.enable = true;
								poiMarker.#osmpois.push(poi.geojson.id);
								make_marker({ target: target, poi: poi, langname: 'name' }).then(marker => {
									if (marker !== undefined) marker.forEach(val => poiMarker.#markers[target].push(val));	// 複数Marker対応(Wikipediaの解説など)
								});
							};
						} else {
							console.log("poiMarker: no load osm data: " + act.osmid);
						};
					}
				});
			};
		};
	}

	static get(target, osmid) {				// Poi取得
		let idx = poiMarker.#markers[target].findIndex(val => val.mapmaker_id == osmid);
		let marker = poiMarker.#markers[target][idx];
		return marker;
	}

	static qr_add(target, osmid, url, latlng, text) {
		let idx = poiMarker.#markers[target].findIndex(val => val.mapmaker_id == osmid);
		let qrcode = new QRCode({ content: url, join: true, container: "svg", width: 128, height: 128 });
		let data = qrcode.svg();
		let icon = L.divIcon({ "className": "icon", "iconSize": [512, 128], "html": `<div class="d-flex"><div class="flex-row">${data}</div><div class="p-2 bg-light"><span>${text}</span></div></div>` });
		let qr_marker = L.marker(new L.LatLng(latlng.lat, latlng.lng), { icon: icon, draggable: true });
		qr_marker.addTo(map);
		qr_marker.mapmaker_id = osmid + "-qr";
		qr_marker.mapmaker_key = target;
		qr_marker.mapmaker_svg = qrcode.svg;
		poiMarker.#markers[target][idx] = [poiMarker.#markers[target][idx], qr_marker];
		map.closePopup();
	}

	static select(poiid, detail) {								// Map move to PoiId & Zoom(config)
		return new Promise((resolve, reject) => {
			let poi = poiCont.get_osmid(poiid);
			let zoomlv = Conf.PoiViewZoom["activity"] >= map.getZoom() ? Conf.PoiViewZoom["activity"] : map.getZoom();
			if (poi !== undefined) {	// poi = osmid
				map.flyTo(poi.latlng, zoomlv, { animate: true, duration: 0.5 });
				if (detail) cMapmaker.detail_view(poi.geojson.id, poiid);
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
					OvPassCnt.get_osmids([poi.osmid]).then((geojson) => {
						poiCont.add_geojson(geojson);
						osmid = poiCont.get_osmid(poi.osmid);
						map.flyTo(osmid.latlng, zoomlv, { animate: true, duration: 0.5 });
						if (detail) cMapmaker.detail_view(poi.osmid, poiid);
						winCont.spinner(false);
						resolve();
					}).catch((e) => {
						console.log("poiMarker: " + e);
						alert(glot.get("sverror_message"));
						winCont.spinner(false);
						reject();
					});
				};
			}
		});
	}

	static delete_all() {
		Conf.PoiView.targets.forEach((target) => poiMarker.delete(target));
		poiMarker.delete("flist");
		poiMarker.#osmpois = [];
	}

	static delete(target, osmid) {					// Marker delete * don't set pdata
		if (osmid == undefined || osmid == "") {	// all osmid
			if (poiMarker.#markers[target] !== undefined) {
				poiMarker.#markers[target].forEach(marker => {
					poiMarker.#osmpois = poiMarker.#osmpois.filter(n => n !== marker.mapmaker_id);
					delmaker(marker);
				});
				poiMarker.#markers[target] = [];
			};
		} else {									// delete osmid
			let idx = poiMarker.#markers[target].findIndex(vals => {
				let val = vals.length == undefined ? vals : vals[0];
				return val.mapmaker_id == osmid;
			});
			poiMarker.#osmpois = poiMarker.#osmpois.filter(n => n !== poiMarker.#markers[target][idx].mapmaker_id);
			delmaker(poiMarker.#markers[target][idx]);
		};
		map.closePopup();

		function delmaker(marker) {	// 実際にマーカーを消す処理
			if (marker == undefined) return;
			if (marker.length == undefined) { map.removeLayer(marker); return };
			marker.forEach(m => map.removeLayer(m));								// qr_code で markerが複数ある場合
		};
	}
};
