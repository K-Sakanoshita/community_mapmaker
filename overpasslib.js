"use strict";

// OverPass Server Control(With easy cache)
var OvPassCnt = (function () {
	var Cache = { "geojson": [], "targets": [] };   // Cache variable
	var LLc = { "NW": { "lat": 0, "lng": 0 }, "SE": { "lat": 0, "lng": 0 } }; // latlng cache area

	return {
		get: function (targets, poi, progress) {
			let LL = GeoCont.get_LL();
			return new Promise((resolve, reject) => {
				if (LL.NW.lat < LLc.NW.lat && LL.NW.lng > LLc.NW.lng &&
					LL.SE.lat > LLc.SE.lat && LL.NW.lat < LLc.NW.lat) {
					console.log("OvPassCnt: Cache Hit.");       // Within Cache range
					resolve(Cache);
				} else {
					Cache = { "geojson": [], "targets": [] };
					let offset_lat = (LL.NW.lat - LL.SE.lat) / 4;
					let offset_lng = (LL.SE.lng - LL.NW.lng) / 4;
					let SE_lat = LL.SE.lat - offset_lat;
					let SE_lng = LL.SE.lng + offset_lng;
					let NW_lat = LL.NW.lat + offset_lat;
					let NW_lng = LL.NW.lng - offset_lng;
					let maparea = SE_lat + ',' + NW_lng + ',' + NW_lat + ',' + SE_lng;
					LLc = { "SE": { "lat": SE_lat, "lng": SE_lng }, "NW": { "lat": NW_lat, "lng": NW_lng } }; // Save now LL(Cache area)
					let query = "";
					targets.forEach(key => { for (let idx in Conf.target[key].overpass) query += Conf.target[key].overpass[idx] + ";" });
					let url = Conf.default.OverPassServer + `?data=[out:json][timeout:30][bbox:${maparea}];(${query});(._;>;);out body qt;`;
					console.log("GET: " + url);
					$.ajax({
						"type": 'GET', "dataType": 'json', "url": url, "cache": false, "xhr": () => {
							var xhr = new window.XMLHttpRequest();
							xhr.addEventListener("progress", function (evt) {
								console.log("OvPassCnt.get: Progress: " + evt.loaded );
								if (progress !== undefined) progress(evt.loaded);
							}, false);
							return xhr;
						}
					}).done(function (data) {
						console.log("OvPassCnt.get: done.");
						if (data.elements.length == 0) { resolve(); return };
						let osmxml = data;
						let geojson = osmtogeojson(osmxml, { flatProperties: true });
						geojson = geojson.features.filter(node => {      			// 非対応の店舗はキャッシュに載せない
							let tags = node.properties;
							if (poi && !targets.includes("wikipedia")) {			// Poi(Wikipedia以外)の場合
								if (PoiCont.get_catname(tags) !== "") {
									let result = false;     // takeaway and delivery tag check
									let take1 = tags.takeaway == undefined ? "" : tags.takeaway;                        // どれか一つにYesがあればOK
									let take2 = tags["takeaway:covid19"] == undefined ? "" : tags["takeaway:covid19"];
									let deli1 = tags.delivery == undefined ? "" : tags.delivery;
									let deli2 = tags["delivery:covid19"] == undefined ? "" : tags["delivery:covid19"];
									if ([take1, take2].includes("yes")) result = true;
									if ([take1, take2].includes("only")) result = true;
									if ([deli1, deli2].includes("yes")) result = true;
									if ([deli1, deli2].includes("only")) result = true;
									if ([take1, take2, deli1, deli2].filter(Boolean).length > 0) {  // タグが一つでもあれば判定終了
										if (result) return node;
									} else {        	        				// 自動販売機や図書館など
										return node;
									};
								};
							} else if (poi && targets.includes("wikipedia")) {	// Poi(Wikipedia)の場合
								if (PoiCont.get_wikiname(tags)) return node;	// tagがある場合は残す
							} else {											// Poi以外の場合(LineやPolygon)
								return node;
							};
						});
						OvPassCnt.set_targets(geojson);
						console.log("OvPassCnt: Cache Update");
						resolve(Cache);
					}).fail(function (jqXHR, statusText, errorThrown) {
						console.log(statusText);
						reject(jqXHR, statusText, errorThrown);
					});
				}
			});
		},

		set_targets: (geojson) => {    // geojsonからtargetsを割り振る
			console.log("set_targets: " + geojson.length);
			geojson.forEach(function (val1) {
				let cidx = Cache.geojson.findIndex(function (val2) {
					if (val2.properties.id == val1.properties.id) return true;
				});
				if (cidx === -1) {                          // キャッシュが無い時は更新
					Cache.geojson.push(val1);
					cidx = Cache.geojson.length - 1;
				};

				let keys = Object.keys(Conf.target).filter(key => Conf.target[key].file == undefined);
				keys.forEach(val2 => {
					var target = val2;
					Conf.target[target].tags.forEach(function (tag) {		// target[category].tags による該当チェック
						let tag_kv = tag.split("=").concat([""]);
						let tag_not = tag_kv[0].slice(-1) == "!" ? true : false;
						tag_kv[0] = tag_kv[0].replace(/!/, "");
						if (val1.properties[tag_kv[0]] !== undefined) {		// タグがある場合
							if ((val1.properties[tag_kv[0]] == tag_kv[1] ^ tag_not) || tag_kv[1] == "") {
								if (Cache.targets[cidx] == undefined) {  	// 
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
		}
	}
})();
