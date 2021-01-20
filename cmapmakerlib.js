"use strict";

// PoiData Control
var poiCont = (function () {
	var pdata = { geojson: [], targets: [], enable: [] };					// OvPassの応答(features抜き)と対象Keyの保存
	var adata = [[]];
	var latlngs = {}, geoidx = {};											// 緯度経度  osmid: {lat,lng} / osmidからgeojsonのindexリスト

	return {
		pois: () => { return { pois: pdata, acts: adata } },
		targets: () => {									// return all targets
			let target = [];
			poiCont.pois().targets.forEach(names => target = target.concat(names));
			return basic.uniq(target);
		},
		all_clear: () => { pdata = { geojson: [], targets: [], enable: [] } },
		set_json: (json) => {								// set GoogleSpreadSheetから帰ってきたJson
			adata = json;
		},
		add_geojson: (pois) => {      						// add geojson pois / pois: {geojson: [],targets: []}
			if (pois.enable == undefined) pois.enable = [];
			pois.geojson.forEach((val1, idx1) => {			// 既存Poiに追加
				let enable = pois.enable[idx1] == undefined ? true : pois.enable[idx1];
				let poi = { "geojson": pois.geojson[idx1], "targets": pois.targets[idx1], "enable": enable };
				poiCont.set_geojson(poi);
			});
			pdata.geojson.forEach((node, node_idx) => {
				let ll, lat = 0, lng = 0, counts = node.geometry.coordinates[0].length;;
				ll = GeoCont.flat2single(node.geometry.coordinates, node.geometry.type);
				latlngs[node.id] = { "lat": ll[1], "lng": ll[0] };
				geoidx[node.id] = node_idx;
			});
		},
		set_geojson: (poi) => {								// add_geojsonのサブ機能
			let cidx = pdata.geojson.findIndex((val) => val.id == poi.geojson.id);
			if (cidx === -1) {       	                   // 無い時は追加
				pdata.geojson.push(poi.geojson);
				cidx = pdata.geojson.length - 1;
			};
			if (pdata.targets[cidx] == undefined) {  	// targetが無い時は追加
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
		get_catname: (tags) => {          								// get Category Name from Conf.category(Global Variable)
			let categorys = Object.keys(Conf.category);
			let key1 = categorys.find(key => tags[key] !== undefined);
			let key2 = tags[key1] == undefined ? "" : tags[key1];
			let catname = (key2 !== "") ? Conf.category[key1][key2] : "";   // known tags
			return (catname == undefined) ? "" : catname;
		},
		get_wikiname: (tags) => {          								// get Wikipedia Name from tag
			let wikiname = tags["wikipedia"] ? tags["wikipedia"].split(':')[1] : "";	// value値の":"の右側を返す
			return wikiname;
		},
		get_target: (targets) => { return filter_geojson(targets) },	// 指定したtargetのgeojsonと緯度経度を返す
		list: function (targets) {              						// DataTables向きのJsonデータリストを出力
			let pois = filter_geojson(targets);     						// targetsに指定されたpoiのみフィルター
			let datas = [];
			pois.geojson.forEach((node, idx) => {
				let tags = node.properties;
				let name = tags.name == undefined ? "-" : tags.name;
				let category = poiCont.get_catname(tags);
				datas.push({ "osmid": node.id, "name": name, "category": category, "picture": "" });
			});
			adata.forEach((line) => {
				if (line !== undefined) datas.push({ "osmid": line.id, "name": line.title, "category": line.category, "picture": line.picture_url });
			});
			datas.sort((a, b) => { return (a.between > b.between) ? 1 : -1 });
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

var Marker = (function () {				// Marker closure
	var markers = {}, SvgIcon = {};		// SVGアイコン連想配列(filename,svg text)

	return {
		init: () => {
			Marker.set_size(Conf.default.Text.size, Conf.default.Text.view);
			let jqXHRs = [], keys = [];			// SVGファイルをSvgIconへ読み込む
			Object.keys(Conf.marker_tag).forEach(key1 => {
				Object.keys(Conf.marker_tag[key1]).forEach((key2) => {
					let filename = Conf.marker_tag[key1][key2];
					if (keys.indexOf(filename) == -1) {
						keys.push(filename);
						jqXHRs.push($.get(`./image/${filename}`));
					};
				});
			});
			$.when.apply($, jqXHRs).always(function () {
				let xs = new XMLSerializer();
				for (let key in keys) SvgIcon[keys[key]] = xs.serializeToString(arguments[key][0]);
			});
		},
		images: () => {							// SvgIcon(svgを返す)
			return SvgIcon;
		},
		have: (target) => {						// Markerか確認(true: marker)
			let keys = Object.keys(Conf.target);
			let markers = keys.filter(key => Conf.target[key].marker !== undefined);
			return markers.some(key => key == target);
		},
		set: (target) => {						// Poi表示
			Marker.delete(target);
			markers[target] = [];
			let pois = poiCont.get_target(target);
			if (pois.geojson !== undefined) {
				pois.geojson.forEach(function (geojson, idx) {
					let poi = { "geojson": pois.geojson[idx], "targets": pois.targets[idx], "latlng": pois.latlng[idx], "enable": pois.enable[idx] };
					if (poi.enable) {
						make_marker({ target: target, poi: poi, langname: 'name' }).then(marker => {
							if (marker !== undefined) marker.forEach(val => markers[target].push(val));
						});
					};
				});
			};
		},
		get: (target, osmid) => {				// Poi取得
			let idx = markers[target].findIndex(val => val.mapmaker_id == osmid);
			let marker = markers[target][idx];
			return marker;
		},
		qr_add: (target, osmid, url, latlng, text) => {
			let idx = markers[target].findIndex(val => val.mapmaker_id == osmid);
			let qrcode = new QRCode({ content: url, join: true, container: "svg", width: 128, height: 128 });
			let data = qrcode.svg();
			let icon = L.divIcon({ "className": "icon", "iconSize": [512, 128], "html": `<div class="d-flex"><div class="flex-row">${data}</div><div class="p-2 bg-light"><span>${text}</span></div></div>` });
			let qr_marker = L.marker(new L.LatLng(latlng.lat, latlng.lng), { icon: icon, draggable: true });
			qr_marker.addTo(map);
			qr_marker.mapmaker_id = osmid + "-qr";
			qr_marker.mapmaker_key = target;
			qr_marker.mapmaker_svg = qrcode.svg;
			markers[target][idx] = [markers[target][idx], qr_marker];
			map.closePopup();
		},
		view: osmid => {
			_status = "view";
			listTable.select(osmid);
			let poi = poiCont.get_osmid(osmid);
			let tags = poi.geojson.properties;
			let date = moment(tags.timestamp);
			const osmidOrig = osmid;
			osmid = osmid.replace('/', "=");
			history.replaceState('', '', location.pathname + "?" + osmid + location.hash);

			$("#osmid").html(tags.id);
			$("#timestamp").html(date.format("YYYY/MM/DD hh:mm"));
			let name = tags.name == null ? "" : tags.name;
			if (tags.branch) {
				name += " " + tags.branch;
			}
			$("#name").html(name == null ? "-" : name);
			$("#category-icon").attr("src", tags.takeaway_icon);
			$("#category").html(poiCont.get_catname(tags));

			// opening_hours
			let openhour;
			if (tags["opening_hours:covid19"] != null) {
				openhour = tags["opening_hours:covid19"];
			} else {
				openhour = tags.opening_hours == null ? "-" : tags.opening_hours;
			};
			let RegexPTN = [[/\|\|/g, "<br>"], [/;/g, "<br>"]];
			Object.keys(Conf.opening_hours).forEach(key => {
				RegexPTN.push([new RegExp(key, "g"), Conf.opening_hours[key]]);
			});
			RegexPTN.forEach(val => { openhour = openhour.replace(val[0], val[1]) });
			if (tags["opening_hours:covid19"] != null) { openhour += Conf.category.suffix_covid19 }
			$("#opening_hours").html(openhour);

			// cuisine
			let cuisine = [];
			if (tags.cuisine != null) {
				cuisine = tags.cuisine.split(";").map(key => {
					return Conf.category.cuisine[key] || key;
				});
			};

			// cuisine(diet)
			let diet = Object.keys(Conf.category.diet).map(key => {
				if (tags[key] != null) {
					if (tags[key] !== "no") return Conf.category.diet[key] || key;
				}
			});
			cuisine = cuisine.concat(diet);
			cuisine = cuisine.filter(Boolean);
			cuisine = cuisine.join(', ');
			$("#cuisine").html(cuisine == "" ? "-" : cuisine);

			if (Conf.local.EnableBookmark == true) {
				let bookmarked = bookmark.isBookmarked(osmidOrig);
				const CLASS_BOOKMARK_TRUE = "btn-bookmark-true";
				const CLASS_BOOKMARK_FALSE = "btn-bookmark-false";
				$("#modal_bookmark").show();
				$("#modal_bookmark").removeClass((bookmarked) ? CLASS_BOOKMARK_FALSE : CLASS_BOOKMARK_TRUE);
				$("#modal_bookmark").addClass((!bookmarked) ? CLASS_BOOKMARK_FALSE : CLASS_BOOKMARK_TRUE);
				$('#modal_bookmark').unbind('click');
				$('#modal_bookmark').click(() => {
					console.log(name);
					bookmarked = !bookmarked;
					bookmark.setBookmarkByModal(osmidOrig, bookmarked);
					$("#modal_bookmark").removeClass((bookmarked) ? CLASS_BOOKMARK_FALSE : CLASS_BOOKMARK_TRUE);
					$("#modal_bookmark").addClass((!bookmarked) ? CLASS_BOOKMARK_FALSE : CLASS_BOOKMARK_TRUE);
				});
			}

			let outseet = YESNO.indexOf(tags.outdoor_seating) < 0 ? "" : tags.outdoor_seating;
			if (outseet !== "") {
				$("#outdoor_seating").attr("glot-model", "outdoor_seating_" + outseet);
			} else {
				$("#outdoor_seating").removeAttr("glot-model");
			};

			// takeout
			let takeaway;
			if (tags["takeaway:covid19"] != null) {
				takeaway = Conf.category.takeaway[tags["takeaway:covid19"]];
				takeaway = takeaway == undefined ? "?" : takeaway + Conf.category.suffix_covid19;
			} else {
				takeaway = tags.takeaway == null ? "-" : Conf.category.takeaway[tags.takeaway];
				takeaway = takeaway == undefined ? "?" : takeaway;
			};
			$("#takeaway").html(takeaway);

			// delivery
			let delname;
			if (tags["delivery:covid19"] != null) {
				delname = Conf.category.delivery[tags["delivery:covid19"]];
				delname = delname == undefined ? "?" : delname + Conf.category.suffix_covid19;
			} else {
				delname = tags.delivery == null ? "-" : Conf.category.delivery[tags.delivery];
				delname = delname == undefined ? "?" : delname;
			}
			$("#delivery").html(delname);

			if (tags.phone != null) {
				$("#phone").html("<a href=\"" + ("tel:" + tags.phone) + "\">" + tags.phone + "</a>");
			} else {
				$("#phone").html("-");
			};

			let fld = {};
			fld.website = tags["contact:website"] == null ? tags["website"] : tags["contact:website"];
			fld.sns_instagram = tags["contact:instagram"] == null ? tags["instagram"] : tags["contact:instagram"];
			fld.sns_twitter = tags["contact:twitter"] == null ? tags["twitter"] : tags["contact:twitter"];
			fld.sns_facebook = tags["contact:facebook"] == null ? tags["facebook"] : tags["contact:facebook"];
			Object.keys(fld).forEach(key => {
				if (fld[key] == null) {
					$("#" + key).hide();
				} else {
					$("#" + key).show();
				};
			});

			$("#description").html(tags.description == null ? "-" : tags.description.trim());

			glot.render();
			$('#PoiView_Modal').modal({ backdrop: 'static', keyboard: true });

			let hidden = e => {
				_status = "";
				history.replaceState('', '', location.pathname + location.hash);
				$('#PoiView_Modal').modal('hide');
			};
			$('#PoiView_Modal').one('hidePrevented.bs.modal', hidden);
			$('#PoiView_Modal').one('hidden.bs.modal', hidden);
		},

		change_lang: (target, osmid, lang) => {
			let idx = markers[target].findIndex(vals => {
				let val = vals.length == undefined ? vals : vals[0];
				return val.mapmaker_id == osmid;
			});
			let marker = markers[target][idx];
			if (marker.length > 1) marker = marker[0];		// markerが複数の時への対応（qr_codeなど）
			let poi = poiCont.get_osmid(marker.mapmaker_id);
			let geojson = poi.geojson;
			let name = geojson.properties[lang] == undefined ? "" : geojson.properties[lang];
			if (name == "") {
				WinCont.modal_open({
					"title": glot.get("change_lang_error_title"), "message": glot.get("change_lang_error_message"),
					"mode": "close", "callback_close": () => WinCont.modal_close()
				});
			} else {
				map.closePopup();
				marker.off('click');
				marker.removeFrom(map);
				make_marker({ target: target, poi: poi, langname: lang }).then(marker => { markers[target][idx] = marker[0] });
			};
		},

		change_icon: (target, osmid, filename) => {
			let idx = markers[target].findIndex(vals => {
				let val = vals.length == undefined ? vals : vals[0];
				return val.mapmaker_id == osmid;
			});
			let marker = markers[target][idx];
			if (marker.length > 1) marker = marker[0];		// markerが複数の時への対応（qr_codeなど）
			let poi = poiCont.get_osmid(marker.mapmaker_id);
			map.closePopup();
			marker.off('click');
			marker.removeFrom(map);
			make_marker({ target: target, poi: poi, filename: filename }).then(marker => { markers[target][idx] = marker[0] });
		},

		center: (poiid) => {								// 
			Conf.default.Circle.radius = Math.pow(2, 21 - map.getZoom());
			let circle, poi = poiCont.get_osmid(poiid);
			if (poi !== undefined) {
				map.panTo(poi.latlng, { animate: true, easeLinearity: 0.1, duration: 0.5 });
				if (poi.latlng.lat.length == undefined) {		// latlngが複数ある場合はcircleなし
					circle = L.circle(poi.latlng, Conf.default.Circle).addTo(map);
					setTimeout(() => map.removeLayer(circle), Conf.default.Circle.timer);
				};
			} else {
				poi = poiCont.get_actid(poiid);
				let latlng = { lat: poi.lat, lng: poi.lng };
				map.panTo(latlng, { animate: true, easeLinearity: 0.1, duration: 0.5 });
				circle = L.circle(latlng, Conf.default.Circle).addTo(map);
				setTimeout(() => map.removeLayer(circle), Conf.default.Circle.timer);
				console.log("event")
			}
		},

		set_size: (size, view) => {
			let icon_xy = Math.ceil(size * Conf.default.Icon.scale);
			Conf.effect.text.size = size;		// set font size 
			Conf.effect.text.view = view;
			Conf.effect.icon.x = icon_xy;		// set icon size
			Conf.effect.icon.y = icon_xy;
		},

		all_clear: () => Object.keys(markers).forEach((target) => Marker.delete(target)),	// all delete

		delete: (target, osmid) => {														// Marker delete * don't set pdata
			if (osmid == undefined || osmid == "") {	// all osmid
				if (markers[target] !== undefined) {
					markers[target].forEach(marker => delmaker(marker));
					markers[target] = [];
				};
			} else {									// delete osmid
				let idx = markers[target].findIndex(vals => {
					let val = vals.length == undefined ? vals : vals[0];
					return val.mapmaker_id == osmid;
				});
				let marker = markers[target][idx];
				delmaker(marker);
			};
			map.closePopup();

			function delmaker(marker) {	// 実際にマーカーを消す処理
				if (marker.length == undefined) { map.removeLayer(marker); return };
				marker.forEach(m => map.removeLayer(m));								// qr_code で markerが複数ある場合
			};
		}
	};

	function make_marker(params) {	// markerは複数返す時がある
		return new Promise((resolve, reject) => {
			let categorys = Object.keys(Conf.category), icon_name;
			let tags = params.poi.geojson.properties.tags == undefined ? params.poi.geojson.properties : params.poi.geojson.properties.tags;
			let name = tags[params.langname] == undefined ? tags.name : tags[params.langname];
			name = (name == "" || name == undefined) ? "" : name;
			switch (params.target) {
				case "wikipedia":
					icon_name = params.filename == undefined ? Conf.target.wikipedia.marker : params.filename;
					try {
						name = tags[Conf.target.wikipedia.tag].split(':')[1];
					} catch {
						console.log(tags[Conf.target.wikipedia.tag]);
					};
					let html = `<div class="d-flex"><img style="width: ${Conf.effect.icon.x}px; height: ${Conf.effect.icon.y}px;" src="./image/${icon_name}" icon-name="${name}">`;
					if (name !== "" && Conf.effect.text.view) html = `${html}<span class="icon" style="font-size: ${Conf.effect.text.size}px">${name}</span>`;
					let icon = L.divIcon({ "className": "", "iconSize": [200 * Conf.default.Icon.scale, Conf.effect.icon.y], "iconAnchor": [Conf.effect.icon.x / 2, Conf.effect.icon.y / 2], "html": html + "</div>" });
					let marker = L.marker(new L.LatLng(params.poi.latlng.lat, params.poi.latlng.lng), { icon: icon, draggable: false });
					marker.addTo(map).on('click', e => { popup_icon(e) });
					marker.mapmaker_id = params.poi.geojson.id;
					marker.mapmaker_key = params.target;
					marker.mapmaker_lang = tags[Conf.target.wikipedia.tag];
					marker.mapmaker_icon = icon_name;
					resolve([marker]);
					break;
				default:
					let keyn = categorys.find(key => tags[key] !== undefined);
					let keyv = (keyn !== undefined) ? Conf.marker_tag[keyn][tags[keyn]] : undefined;
					if (keyn !== undefined && keyv !== undefined) {	// in category
						icon_name = params.filename == undefined ? Conf.marker_tag[keyn][tags[keyn]] : params.filename;
						let html = `<div class="d-flex"><img style="width: ${Conf.effect.icon.x}px; height: ${Conf.effect.icon.y}px;" src="./image/${icon_name}" icon-name="${name}">`;
						let span = `<span class="icon" style="font-size: ${Conf.effect.text.size}px">${name}</span>`;
						if (name !== "" && Conf.effect.text.view) html += span;
						let span_width = name !== "" ? name.length * Conf.effect.text.size : 0;
						let icon = L.divIcon({ "className": "", "iconSize": [Conf.effect.icon.x + span_width, Conf.effect.icon.y], "iconAnchor": [Conf.effect.icon.x / 2, Conf.effect.icon.y / 2], "html": html + "</div>" });
						let marker = L.marker(new L.LatLng(params.poi.latlng.lat, params.poi.latlng.lng), { icon: icon, draggable: false });
						marker.addTo(map).on('click', e => { popup_icon(e) });
						marker.mapmaker_id = params.poi.geojson.id;
						marker.mapmaker_key = params.target;
						marker.mapmaker_lang = params.langname;
						marker.mapmaker_icon = icon_name;
						resolve([marker]);
					};
					break;
			};
		});
	};

	function popup_icon(ev) {	// PopUpを表示
		let popcont;
		let id = ev.target.mapmaker_id;
		let key = ev.target.mapmaker_key;
		let lang = ev.target.mapmaker_lang;
		let tags = poiCont.get_osmid(id).geojson.properties;
		let chg_mkr = `<button class='btn btn-sm m-2' onclick='cMapmaker.poi_marker_change("${key}","${id}")'>${glot.get("marker_change")}</button>`;
		let del_btn = `<button class='btn btn-sm m-2' onclick='cMapmaker.poi_del("${key}","${id}")'>${glot.get("marker_delete")}</button>`;
		if (key == Conf.target.wikipedia.tag) {		// Wikipedia時のPopUp
			let qr_btn = `<button class='btn btn-sm m-2' onclick='cMapmaker.qr_add("wikipedia","${id}")'>${glot.get("qrcode_make")}</button>`;
			popcont = tags[Conf.target.wikipedia.tag] + "<br>" + chg_mkr + del_btn + "<br>" + qr_btn;
		} else {									// その他
			let name = tags.name == undefined ? "" : tags.name;
			let chg_eng = `<button class='btn btn-sm m-2' onclick='Marker.change_lang("${key}","${id}","name:en")'>${glot.get("marker_to_en")}</button>`;
			let chg_jpn = `<button class='btn btn-sm m-2' onclick='Marker.change_lang("${key}","${id}","name")'>${glot.get("marker_to_ja")}</button>`;
			popcont = (name == '' ? glot.get("marker_noname") : name) + "<br>" + chg_mkr + del_btn + "<br>" + (lang == "name" ? chg_eng : chg_jpn);
		};
		L.responsivePopup({ "keepInView": true }).setContent(popcont).setLatLng(ev.latlng).openOn(map);
		ev.target.openPopup();
		return false;
	};
})();
