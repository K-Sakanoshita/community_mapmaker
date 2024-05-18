"use strict";
// OverPass Server Control(With easy cache)
class OverPassControl {

	constructor() {
		this.Cache = { "geojson": [], "targets": [] };   // Cache variable
		this.LLc = {};
		this.CacheZoom = 14;
		this.UseServer = 0;
		this.tags = {};
		this.CacheIdxs = {};		// 連想配列にtargets内のidxを保存
	}

	// Overpass APIからデータ取得
	// targets: Conf.osm内の目標 / progress: 処理中に呼び出すプログラム
	getGeojson(targets, progress) {
		return new Promise((resolve, reject) => {
			var LL = mapLibre.get_LL();
			let CT = geoCont.ll2tile(mapLibre.getCenter(), OvPassCnt.CacheZoom);
			console.log("OvPassCnt: Check:" + CT.tileX + "." + CT.tileY);
			if (OvPassCnt.LLc[CT.tileX + "." + CT.tileY] !== void 0 || Conf.static.mode) {
				console.log("OvPassCnt: Cache Hit.");       // Within Cache range
				resolve(OvPassCnt.Cache);
			} else {
				let tileNW = geoCont.ll2tile(LL.NW, OvPassCnt.CacheZoom);	// 緯度経度→タイル座標(左上、右下)→緯度経度
				let tileSE = geoCont.ll2tile(LL.SE, OvPassCnt.CacheZoom);
				let NW = geoCont.tile2ll(tileNW, OvPassCnt.CacheZoom, "NW");
				let SE = geoCont.tile2ll(tileSE, OvPassCnt.CacheZoom, "SE");
				let maparea = SE.lat + ',' + NW.lng + ',' + NW.lat + ',' + SE.lng;
				let query = "";
				targets.forEach(key => {
					if (Conf.osm[key] !== undefined) Conf.osm[key].overpass.forEach(val => query += val + ";");
				});
				let url = Conf.system.OverPassServer[OvPassCnt.UseServer] + `?data=[out:json][timeout:30][bbox:${maparea}];(${query});out body meta;>;out skel;`;
				console.log("OvPassCnt: GET: " + url);
				$.ajax({
					"type": 'GET', "dataType": 'json', "url": url, "cache": false, "xhr": () => {
						var xhr = new window.XMLHttpRequest();
						xhr.addEventListener("progress", (evt) => {
							console.log("OvPassCnt: Progress: " + evt.loaded);
							if (progress !== undefined) progress(evt.loaded);
						}, false);
						return xhr;
					}
				}).done(function (data) {
					console.log("OvPassCnt: done.");
					// geoCont.box_write(NW, SE);		// Cache View
					for (let y = tileNW.tileY; y < tileSE.tileY; y++) {
						for (let x = tileNW.tileX; x < tileSE.tileX; x++) {
							OvPassCnt.LLc[x + "." + y] = true;
						};
					};
					if (data.elements.length == 0) { resolve(); return };
					let osmxml = data;
					let geojson = osmtogeojson(osmxml, { flatProperties: true });
					OvPassCnt.setTargets(geojson.features);
					OvPassCnt.Cache.geojson.forEach((key, idx) => {	// no target no geojson
						if (OvPassCnt.Cache.targets[idx] == undefined) {
							delete OvPassCnt.Cache.geojson[idx];
							delete OvPassCnt.Cache.targets[idx];
						};
					});
					console.log("OvPassCnt: Cache Update");
					resolve(OvPassCnt.Cache);
				}).fail(function (jqXHR, statusText, errorThrown) {
					console.log("OvPassCnt: " + statusText);
					OvPassCnt.UseServer = (OvPassCnt.UseServer + 1) % Conf.system.OverPassServer.length;
					reject(jqXHR, statusText, errorThrown);
				});
			};
		});
	}

	getOsmIds(osmids) {
		osmids = [...new Set(osmids)];
		return new Promise((resolve, reject) => {
			let params = "(", pois = { node: "", way: "", relation: "" };
			osmids.forEach(id => {
				let query = id.split("/");
				pois[query[0]] += query[1] + ",";
			});
			Object.keys(pois).forEach(category => {
				if (pois[category] !== "") params += `${category}(id:${pois[category].slice(0, -1)});`;
			});
			let url = Conf.system.OverPassServer[OvPassCnt.UseServer] + '?data=[out:json][timeout:30];' + params + ');out body meta;>;out skel;';
			console.log("OvPassCnt: GET: " + url);
			$.ajax({ "type": 'GET', "dataType": 'json', "url": url, "cache": false }).done(function (osmxml) {
				console.log("OvPassCnt: getOsmIds: done.");
				if (osmxml.elements.length == 0) { resolve(); return };
				let geojson = osmtogeojson(osmxml, { flatProperties: true });
				OvPassCnt.setTargets(geojson.features);
				console.log("OvPassCnt: Cache Update");
				resolve(OvPassCnt.Cache);
			}).fail(function (jqXHR, statusText, errorThrown) {
				console.log("OvPassCnt: " + statusText);
				OvPassCnt.UseServer = (OvPassCnt.UseServer + 1) % Conf.system.OverPassServer.length;
				reject(jqXHR, statusText, errorThrown);
			});
		})
	}

	// tagを元にtargetを設定
	setTargets(geojson) {
		console.log("OvPassCnt: setTargets: " + geojson.length);

		if (Object.keys(OvPassCnt.tags).length == 0) {		// initialize
			let osmkeys = Object.keys(Conf.osm).filter(key => Conf.osm[key].file == undefined);
			osmkeys.forEach(target => {
				Conf.osm[target].tags.forEach(function (tag) {
					let tag_kv = tag.split("=").concat([""]);
					let tag_not = tag_kv[0].slice(-1) == "!" ? true : false;
					tag_kv[0] = tag_kv[0].replace(/!/, "");
					if (OvPassCnt.tags[tag_kv[0]] == undefined) {
						OvPassCnt.tags[tag_kv[0]] = {};	// Key作成
					}
					if (OvPassCnt.tags[tag_kv[0]][tag_kv[1]] == undefined) {
						OvPassCnt.tags[tag_kv[0]][tag_kv[1]] = { "target": "" };	// val作成
					}
					let at = [target].concat(OvPassCnt.tags[tag_kv[0]][tag_kv[1]].target).filter(Boolean);
					OvPassCnt.tags[tag_kv[0]][tag_kv[1]] = { "tag_not": tag_not, "target": at };
				});
			});
		};

		geojson.forEach((val) => {
			let cidx = OvPassCnt.CacheIdxs[val.properties.id];
			if (cidx == undefined) { // キャッシュが無い時は更新
				OvPassCnt.Cache.geojson.push(val);
				cidx = OvPassCnt.Cache.geojson.length - 1;
				OvPassCnt.CacheIdxs[val.properties.id] = cidx;
				OvPassCnt.Cache.targets[cidx] = [];
			};

			Object.keys(OvPassCnt.tags).forEach(tag_key => {
				if (val.properties[tag_key] !== undefined) { // タグがある場合
					Object.keys(OvPassCnt.tags[tag_key]).forEach(tag_val => {
						let tag_not = OvPassCnt.tags[tag_key][tag_val].tag_not;
						if ((val.properties[tag_key] == tag_val ^ tag_not) || tag_val == "") {
							if (val.properties[tag_key] !== "no") {	// no velueは無視
								let target = OvPassCnt.tags[tag_key][tag_val].target;
								if (OvPassCnt.Cache.targets[cidx].length === 0) { // 
									OvPassCnt.Cache.targets[cidx] = target;
								} else if (OvPassCnt.Cache.targets[cidx].indexOf(target) === -1) {
									let ot = OvPassCnt.Cache.targets[cidx];
									OvPassCnt.Cache.targets[cidx] = ot.concat(target);
								};
							};
						};
					});
				};
			});
		});
		console.log("OvPassCnt: setTargets: end");
	}

	getTarget(ovanswer, target) {
		let geojson = ovanswer.geojson.filter(function (val, gidx) {
			let found = false;
			for (let tidx in ovanswer.targets[gidx]) {
				if (ovanswer.targets[gidx][tidx] == target) { found = true; break };
			};
			return found;
		});
		return geojson;
	}

	setOsmJson(osmjson) {		// set Static osmjson
		let geojson = osmtogeojson(osmjson, { flatProperties: true });
		OvPassCnt.setTargets(geojson.features);
		return OvPassCnt.Cache;
	}

}
