"use strict";

// OverPass Server Control(With easy cache)
var OvPassCnt = (function () {
	var Cache = { "geojson": [], "targets": [] };   // Cache variable
	var LLc = { "NW": { "lat": 0, "lng": 0 }, "SE": { "lat": 0, "lng": 0 } }; // latlng cache area

	return {
		get: function (targets, poi, progress) {
			let LL = GeoCont.get_LL();
			return new Promise((resolve, reject) => {
				if ((LL.NW.lat < LLc.NW.lat && LL.NW.lng > LLc.NW.lng &&
					LL.SE.lat > LLc.SE.lat && LL.NW.lat < LLc.NW.lat) || Conf.default.maxbounds !== "") {
					console.log("OvPassCnt: Cache Hit.");       // Within Cache range
					resolve(Cache);
				} else {
					Cache = { "geojson": [], "targets": [] };
					let SE_lat, SE_lng, NW_lat, NW_lng, maparea;
					let offset_lat = (LL.NW.lat - LL.SE.lat) / 2;
					let offset_lng = (LL.SE.lng - LL.NW.lng) / 2;
					if (Conf.default.maxbounds.length > 1) {
						let latlng = Conf.default.maxbounds;
						SE_lat = latlng[0][0];
						NW_lng = latlng[0][1];
						NW_lat = latlng[1][0];
						SE_lng = latlng[1][1];
					} else {
						SE_lat = LL.SE.lat - offset_lat;
						SE_lng = LL.SE.lng + offset_lng;
						NW_lat = LL.NW.lat + offset_lat;
						NW_lng = LL.NW.lng - offset_lng;
					}
					maparea = SE_lat + ',' + NW_lng + ',' + NW_lat + ',' + SE_lng;
					LLc = { "SE": { "lat": SE_lat, "lng": SE_lng }, "NW": { "lat": NW_lat, "lng": NW_lng } }; // Save now LL(Cache area)
					let query = "";
					targets.forEach(key => {
						if (Conf.osm[key] !== undefined) Conf.osm[key].overpass.forEach(val => query += val + ";");
					});
					let url = Conf.system.OverPassServer + `?data=[out:json][timeout:30][bbox:${maparea}];(${query});out body meta;>;out skel;`;
					console.log("GET: " + url);
					$.ajax({
						"type": 'GET', "dataType": 'json', "url": url, "cache": false, "xhr": () => {
							var xhr = new window.XMLHttpRequest();
							xhr.addEventListener("progress", function (evt) {
								console.log("OvPassCnt.get: Progress: " + evt.loaded);
								if (progress !== undefined) progress(evt.loaded);
							}, false);
							return xhr;
						}
					}).done(function (data) {
						console.log("OvPassCnt.get: done.");
						if (data.elements.length == 0) { resolve(); return };
						let osmxml = data;
						let geojson = osmtogeojson(osmxml, { flatProperties: true });
						OvPassCnt.set_targets(geojson.features);
						console.log("OvPassCnt: Cache Update");
						resolve(Cache);
					}).fail(function (jqXHR, statusText, errorThrown) {
						console.log(statusText);
						reject(jqXHR, statusText, errorThrown);
					});
				};
			});
		},

		set_targets: (geojson) => {    // geojsonからtargetsを割り振る
			console.log("set_targets: " + geojson.length);
			geojson.forEach((val1) => {
				let cidx = Cache.geojson.findIndex(function (val2) {
					if (val2.properties.id == val1.properties.id)
						return true;
				});
				if (cidx === -1) { // キャッシュが無い時は更新
					Cache.geojson.push(val1);
					cidx = Cache.geojson.length - 1;
				};

				let keys = Object.keys(Conf.osm).filter(key => Conf.osm[key].file == undefined);
				keys.forEach(val2 => {
					var target = val2;
					Conf.osm[target].tags.forEach(function (tag) {
						let tag_kv = tag.split("=").concat([""]);
						let tag_not = tag_kv[0].slice(-1) == "!" ? true : false;
						tag_kv[0] = tag_kv[0].replace(/!/, "");
						if (val1.properties[tag_kv[0]] !== undefined) { // タグがある場合
							if ((val1.properties[tag_kv[0]] == tag_kv[1] ^ tag_not) || tag_kv[1] == "") {
								if (Cache.targets[cidx] == undefined) { // 
									Cache.targets[cidx] = [target];
								} else if (Cache.targets[cidx].indexOf(target) === -1) {
									Cache.targets[cidx].push(target);
								};
							};
						};
					});
				});
			});
		},

		// ovanswerから指定したtargetのgeojsonを返す
		get_target: (ovanswer, target) => {
			let geojson = ovanswer.geojson.filter(function (val, gidx) {
				let found = false;
				for (let tidx in ovanswer.targets[gidx]) {
					if (ovanswer.targets[gidx][tidx] == target) { found = true; break };
				};
				return found;
			});
			//console.log(geojson);
			return geojson;
		},

		// ローカルosmjsonをキャッシュに取り込む
		set_osmjson: (osmjson) => {
			let geojson = osmtogeojson(osmjson, { flatProperties: true });
			OvPassCnt.set_targets(geojson.features);
			let latlng = Conf.default.maxbounds;
			let SE_lat = latlng[0][0];
			let NW_lng = latlng[0][1];
			let NW_lat = latlng[1][0];
			let SE_lng = latlng[1][1];
			LLc = { "SE": { "lat": SE_lat, "lng": SE_lng }, "NW": { "lat": NW_lat, "lng": NW_lng } }; // Save now LL(Cache area)
		}
	}
})();
