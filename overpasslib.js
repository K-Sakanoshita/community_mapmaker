"use strict";
// OverPass Server Control(With easy cache)
class OverPassControl {

	constructor() {
		this.Cache = { "geojson": [], "targets": [] };   // Cache variable
		this.LLc = {};
		this.CacheZoom = 14;
		this.UseServer = 0;
	}

	get(targets) {
		return new Promise((resolve, reject) => {
			var LL = GeoCont.get_LL();
			let CT = GeoCont.ll2tile(map.getBounds().getCenter(), OvPassCnt.CacheZoom);
			console.log("Check:" + CT.tileX + "." + CT.tileY);
			if (OvPassCnt.LLc[CT.tileX + "." + CT.tileY] !== void 0 || Conf.static.mode) {
				console.log("OvPassCnt: Cache Hit.");       // Within Cache range
				resolve(OvPassCnt.Cache);
			} else {
				let tileNW = GeoCont.ll2tile(LL.NW, OvPassCnt.CacheZoom);	// 緯度経度→タイル座標(左上、右下)→緯度経度
				let tileSE = GeoCont.ll2tile(LL.SE, OvPassCnt.CacheZoom);
				let NW = GeoCont.tile2ll(tileNW, OvPassCnt.CacheZoom, "NW");
				let SE = GeoCont.tile2ll(tileSE, OvPassCnt.CacheZoom, "SE");
				let maparea = SE.lat + ',' + NW.lng + ',' + NW.lat + ',' + SE.lng;
				let query = "";
				targets.forEach(key => {
					if (Conf.osm[key] !== undefined) Conf.osm[key].overpass.forEach(val => query += val + ";");
				});
				let url = Conf.system.OverPassServer[OvPassCnt.UseServer] + `?data=[out:json][timeout:30][bbox:${maparea}];(${query});out body meta;>;out skel;`;
				console.log("GET: " + url);
				$.ajax({
					"type": 'GET', "dataType": 'json', "url": url, "cache": false, "xhr": () => {
						var xhr = new window.XMLHttpRequest();
						xhr.addEventListener("progress", (evt) => { console.log("OvPassCnt: Progress: " + evt.loaded) }, false);
						return xhr;
					}
				}).done(function (data) {
					console.log("OvPassCnt: done.");
					// GeoCont.box_write(NW, SE);		// Cache View
					for (let y = tileNW.tileY; y < tileSE.tileY; y++) {
						for (let x = tileNW.tileX; x < tileSE.tileX; x++) {
							OvPassCnt.LLc[x + "." + y] = true;
						};
					};
					if (data.elements.length == 0) { resolve(); return };
					let osmxml = data;
					let geojson = osmtogeojson(osmxml, { flatProperties: true });
					OvPassCnt.set_targets(geojson.features);
					OvPassCnt.Cache.geojson.forEach((key, idx) => {	// no target no geojson
						if (OvPassCnt.Cache.targets[idx] == undefined) delete OvPassCnt.Cache.geojson[idx];
					});
					console.log("OvPassCnt: Cache Update");
					resolve(OvPassCnt.Cache);
				}).fail(function (jqXHR, statusText, errorThrown) {
					console.log(statusText);
					OvPassCnt.UseServer = (OvPassCnt.UseServer + 1) % Conf.system.OverPassServer.length;
					reject(jqXHR, statusText, errorThrown);
				});
			};
		});
	}

	get_osmid(query) {
		return new Promise((resolve, reject) => {
			let params = query.split("/");
			let url = Conf.system.OverPassServer[OvPassCnt.UseServer] + `?data=[out:json][timeout:30];${params[0]}(${params[1]});out body meta;>;out skel;`;
			console.log("GET: " + url);
			$.ajax({ "type": 'GET', "dataType": 'json', "url": url, "cache": false }).done(function (osmxml) {
				console.log("OvPassCnt.get: done.");
				if (osmxml.elements.length == 0) { resolve(); return };
				let geojson = osmtogeojson(osmxml, { flatProperties: true });
				OvPassCnt.set_targets(geojson.features);
				console.log("OvPassCnt: Cache Update");
				resolve(OvPassCnt.Cache);
			}).fail(function (jqXHR, statusText, errorThrown) {
				console.log(statusText);
				OvPassCnt.UseServer = (OvPassCnt.UseServer + 1) % Conf.system.OverPassServer.length;
				reject(jqXHR, statusText, errorThrown);
			});
		})
	}

	// tagを元にtargetを設定
	set_targets(geojson) {
		console.log("set_targets: " + geojson.length);
		geojson.forEach((val1) => {
			let cidx = OvPassCnt.Cache.geojson.findIndex(function (val2) {
				if (val2 !== undefined) if (val2.properties.id == val1.properties.id) return true;
			});
			if (cidx === -1) { // キャッシュが無い時は更新
				OvPassCnt.Cache.geojson.push(val1);
				cidx = OvPassCnt.Cache.geojson.length - 1;
			};

			let keys = Object.keys(Conf.osm).filter(key => Conf.osm[key].file == undefined);
			keys.forEach(target => {
				Conf.osm[target].tags.forEach(function (tag) {
					let tag_kv = tag.split("=").concat([""]);
					let tag_not = tag_kv[0].slice(-1) == "!" ? true : false;
					tag_kv[0] = tag_kv[0].replace(/!/, "");
					if (val1.properties[tag_kv[0]] !== undefined) { // タグがある場合
						if ((val1.properties[tag_kv[0]] == tag_kv[1] ^ tag_not) || tag_kv[1] == "") {
							if (OvPassCnt.Cache.targets[cidx] == undefined) { // 
								OvPassCnt.Cache.targets[cidx] = [target];
							} else if (OvPassCnt.Cache.targets[cidx].indexOf(target) === -1) {
								OvPassCnt.Cache.targets[cidx].push(target);
							};
						};
					};
				});
			});
		});
	}

	get_target(ovanswer, target) {
		let geojson = ovanswer.geojson.filter(function (val, gidx) {
			let found = false;
			for (let tidx in ovanswer.targets[gidx]) {
				if (ovanswer.targets[gidx][tidx] == target) { found = true; break };
			};
			return found;
		});
		return geojson;
	}

	set_osmjson(osmjson) {		// set Static osmjson
		let geojson = osmtogeojson(osmjson, { flatProperties: true });
		OvPassCnt.set_targets(geojson.features);
		let latlng = Conf.static.osmbounds;
		let tileNW = GeoCont.ll2tile(latlng.NW, OvPassCnt.CacheZoom);
		let tileSE = GeoCont.ll2tile(latlng.SE, OvPassCnt.CacheZoom);
		for (let y = tileNW.tileY; y <= tileSE.tileY; y++) {
			for (let x = tileNW.tileX; x <= tileSE.tileX; x++) {
				OvPassCnt.LLc[x + "." + y] = true;
			};
		};
		return OvPassCnt.Cache;
	}

}
var OvPassCnt = new OverPassControl();
