"use strict";

var LayerCont = (function () {		// for line&area / nodeはMarker

	return {
		init: () => {
			let lamp = Layers.MAP == undefined ? "" : Layers.MAP;
			Layers = { "background": { "opacity": Conf.style.background.opacity }, "MAP": lamp };
			for (let key in Conf.style) {
				let color = typeof (Conf.style[key].color) == "undefined" ? "" : Conf.style[key].color;
				let opacity = typeof (Conf.style[key].opacity) == "undefined" ? "" : Conf.style[key].opacity;
				Layers[key] = {
					"color": color, "color_dark": color == "" ? "" : chroma(color).darken(Conf.default.ColorDarken).hex(),
					"width": typeof (Conf.style[key].width) == "undefined" ? 0 : Conf.style[key].width, "opacity": opacity
				};
			};
		},

		layer_make: (key, view) => {						// MakeData内 -> name:コントロール名 / color:SVG色 / width:SVG Line Weight / dashArray:破線
			let type = Conf.style[key].type, opacity;
			if (view !== undefined) Layers[key].opacity = view ? 1 : 0;
			let style = svg_style(key);
			if (Layers[key].svg) {							// already svg layers
				Layers[key].svg.forEach(way => {
					switch (view) {
						case undefined: opacity = { "fillOpacity": way.options.fillOpacity, "opacity": way.options.opacity }; break;
						case true: opacity = { "fillOpacity": 1, "opacity": 1 }; break;
						case false: opacity = { "fillOpacity": 0, "opacity": 0 }; break;
					};
					if (type !== "area") opacity.fillOpacity = 0; 					// LineがPolygon化された場合の対処
					way.setStyle(Object.assign(style, opacity));
					way.options = Object.assign(way.options, opacity);
				});
			} else if (Layers[key].geojson !== undefined) {		//already geojson
				let ways = [];
				opacity = { "fillOpacity": 1, "opacity": 1 };
				if (view == false) opacity = { "fillOpacity": 0, "opacity": 0 };	// false以外(trueとundefined)はopacity=1
				if (type !== "area") opacity.fillOpacity = 0; 	// LineがPolygon化された場合の対処
				style = Object.assign(style, opacity);
				Layers[key].geojson.forEach(way => {
					ways.push(L.geoJSON(way, style));			// geojsonからSVGレイヤーを作成
					ways[ways.length - 1].addTo(map).on('click', way_toggle);
					ways[ways.length - 1].mapmaker = { id: ways.length - 1, "key": key };
				});
				Layers[key].svg = ways;
			};
			console.log(`layer make: ${key}: ok`);
		},

		// Aree select(A4)
		area_select: (mode) => {
			let dom, p = WinCont.a4_getsize(mode);
			if (p.top > 0) {
				dom = document.getElementById("a4_top");
				dom.innerHTML = `<div class="area_mask" style="width: 100%; height: ${p.top}px; top: 0px; left: 0px;"></div>`;
				dom = document.getElementById("a4_bottom");
				dom.innerHTML = `<div class="area_mask" style="width: 100%; height: ${p.bottom}px; top:  ${p.height - p.bottom}px; left: 0px;"></div>`;
			} else {
				dom = document.getElementById("a4_top");
				if (dom !== null) { dom.innerHTML = `` };
				dom = document.getElementById("a4_bottom");
				if (dom !== null) { dom.innerHTML = `` };
			};
			if (p.left > 0) {
				dom = document.getElementById("a4_left");
				dom.innerHTML = `<div class="area_mask" style="width: ${p.left}px; height: 100%; top: 0px; left: 0px;"></div>`;
				dom = document.getElementById("a4_right");
				dom.innerHTML = `<div class="area_mask" style="width: ${p.right}px; height: 100%; top: 0px; left: ${p.width - p.right}px;"></div>`;
			} else {
				dom = document.getElementById("a4_left");
				if (dom !== null) { dom.innerHTML = `` };
				dom = document.getElementById("a4_right");
				if (dom !== null) { dom.innerHTML = `` };
			};
		},

		// WriteText params .svg,text,size,font,color,type,anchor
		text_write: (svg, params) => {
			let svgtext = document.createElementNS('http://www.w3.org/2000/svg', 'text');
			let textpath = document.createElementNS('http://www.w3.org/2000/svg', 'textPath');
			svgtext.setAttribute('text-anchor', params.anchor);
			svgtext.setAttribute('font-size', params.size + "px");
			svgtext.setAttribute('font-family', params.font);
			svgtext.setAttribute('fill', params.color);
			svgtext.setAttribute('dominant-baseline', 'text-before-edge');	// 理由:textPath のy座標が0起点のため
			textpath.textContent = params.text;
			textpath.setAttribute('xlink:href', "#textpath" + params.no);
			svgtext.appendChild(textpath);
			svg[0].appendChild(svgtext);

			let svgpath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
			svgpath.setAttribute('transform', `matrix(1,0,0,1,${params.x},${params.y - 2})`);
			svgpath.setAttribute('id', "textpath" + params.no);
			let height = "", safari = L.Browser.safari ? 9 : 0;
			for (let i = 0; i < 5; i++) { height += `M0,${i * 18 + safari} H360 ` };
			svgpath.setAttribute('d', height);
			svg[0].insertBefore(svgpath, svgtext);

			let rect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
			rect.setAttribute("x", params.x - 3);
			rect.setAttribute("y", params.y - 4);
			rect.setAttribute("width", params.width + 6);
			rect.setAttribute("height", params.height - 2);
			rect.setAttribute("fill", "white");
			rect.setAttribute("fill-opacity", 0.9);
			svg[0].insertBefore(rect, svgtext);
		},

		all_clear: () => {
			console.log("LayerCont: all clear... ");
			for (let key in Conf.style) if (Layers[key].svg) Layers[key].svg.forEach(svg => map.removeLayer(svg));
			LayerCont.init();
		}
	};

	function svg_style(key) {	// set svg style(no set opacity)
		let style, weight = 1, nowzoom = map.getZoom();
		if (nowzoom < 15) {
			weight = 1 / (15 - nowzoom);
		} else if (nowzoom > 15) {
			weight = (nowzoom - 15) * 0.6;
		};
		let common = {
			"stroke": true, "dashArray": Conf.style[key].dashArray, "bubblingMouseEvents": false, "lineJoin": 'round',
			"bubblingMouseEvents": false, "weight": Layers[key].width * weight
		};
		if (Conf.style[key].type == "area") {
			style = Object.assign(common, { "color": Layers[key].color_dark, "fillColor": Layers[key].color });
		} else {
			style = Object.assign(common, { "color": Layers[key].color, "fillColor": Layers[key].color_dark });
		};
		return style;
	};

	function way_toggle(ev) {					// wayをクリックしたときのイベント（表示/非表示切り替え）
		let key = ev.target.mapmaker.key;
		let options = ev.target.options;
		if (options.opacity == 0) {
			options.fillOpacity = 1;
			options.opacity = 1;
			ev.target.options.opacity = 1;
			if (Conf.style[key].type !== "area") options.fillOpacity = 0; 	// LineがPolygon化された場合の対処
		} else {
			options.fillOpacity = 0;
			options.opacity = 0;
			ev.target.options.opacity = 0;
		};
		let style = svg_style(key);
		options.color = style.color;
		options.fillColor = style.fillColor;
		options.weight = style.weight;
		ev.target.setStyle(options);
	};
})();

// PoiData Control
var PoiCont = (function () {
	var PoiData = { geojson: [], targets: [], enable: [] };	// OvPassの応答(features抜き)と対象Keyの保存
	var latlngs = {}, geoidx = {};							// 緯度経度  osmid: {lat,lng} / osmidからgeojsonのindexリスト

	return {
		pois: () => { return PoiData },
		all_clear: () => { PoiData = { geojson: [], targets: [], enable: [] } },
		add: (pois) => {      // pois: {geojson: [],targets: []}
			if (pois.enable == undefined) pois.enable = [];
			pois.geojson.forEach((val1, idx1) => {	// 既存Poiに追加
				let enable = pois.enable[idx1] == undefined ? true : pois.enable[idx1];
				let poi = { "geojson": pois.geojson[idx1], "targets": pois.targets[idx1], "enable": enable };
				PoiCont.set(poi);
			});

			PoiData.geojson.forEach((node, node_idx) => {
				let ll, lat = 0, lng = 0, counts = node.geometry.coordinates[0].length;;
				ll = GeoCont.flat2single(node.geometry.coordinates, node.geometry.type);
				latlngs[node.id] = { "lat": ll[1], "lng": ll[0] };
				geoidx[node.id] = node_idx;
			});
		},
		set: (poi) => {			// addのサブ機能
			let cidx = PoiData.geojson.findIndex((val) => val.id == poi.geojson.id);
			if (cidx === -1) {                          // 無い時は追加
				PoiData.geojson.push(poi.geojson);
				cidx = PoiData.geojson.length - 1;
			};
			if (PoiData.targets[cidx] == undefined) {  	// targetが無い時は追加
				PoiData.targets[cidx] = poi.targets;
			} else {
				PoiData.targets[cidx] = Object.assign(PoiData.targets[cidx], poi.targets);
			};
			if (poi.enable !== undefined) PoiData.enable[cidx] = poi.enable;
		},
		get_target: (targets) => { return poi_filter(targets) },	// 指定したtargetのgeojsonと緯度経度を返す
		get_osmid: (osmid) => {           							// osmidを元にgeojsonと緯度経度、targetを返す
			let idx = geoidx[osmid];
			return { geojson: PoiData.geojson[idx], latlng: latlngs[osmid], targets: PoiData.targets[idx], enable: PoiData.enable[idx] };
		},
		get_catname: (tags) => {          							// get Category Name from Conf.category(Global Variable)
			let categorys = Object.keys(Conf.category);
			let key1 = categorys.find(key => tags[key] !== undefined);
			let key2 = tags[key1] == undefined ? "" : tags[key1];
			let catname = (key2 !== "") ? Conf.category[key1][key2] : "";   // known tags
			return (catname == undefined) ? "" : catname;
		},
		get_wikiname: (tags) => {          							// get Wikipedia Name from tag
			let wikiname = tags["wikipedia"] ? tags["wikipedia"].split(':')[1] : "";	// value値の":"の右側を返す
			return wikiname;
		},
		list: function (targets) {              // DataTables向きのJsonデータリストを出力
			let pois = poi_filter(targets);     // targetsに指定されたpoiのみフィルター
			let datas = [];
			pois.geojson.forEach((node, idx) => {
				let tags = node.properties;
				let name = tags.name == undefined ? "-" : tags.name;
				let category = PoiCont.get_catname(tags);
				let enable = pois.enable[idx];
				datas.push({ "osmid": node.id, "name": name, "category": category, "enable": enable });
			});
			datas.sort((a, b) => { return (a.between > b.between) ? 1 : -1 });
			return datas;
		}
	};
	function poi_filter(targets) {
		let tars = [], enas = [], lls = [];
		let geojson = PoiData.geojson.filter(function (geojson_val, geojson_idx) {
			let found = false;
			for (let target_idx in PoiData.targets[geojson_idx]) {
				if (targets.includes(PoiData.targets[geojson_idx][target_idx])) {
					tars.push(PoiData.targets[geojson_idx])
					lls.push(latlngs[geojson_val.id]);
					enas.push(PoiData.enable[geojson_idx]);
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
			let pois = PoiCont.get_target(target);
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
			DataList.select(osmid);
			let poi = PoiCont.get_osmid(osmid);
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
			$("#category").html(PoiCont.get_catname(tags));

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
			let poi = PoiCont.get_osmid(marker.mapmaker_id);
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
			let poi = PoiCont.get_osmid(marker.mapmaker_id);
			map.closePopup();
			marker.off('click');
			marker.removeFrom(map);
			make_marker({ target: target, poi: poi, filename: filename }).then(marker => { markers[target][idx] = marker[0] });
		},

		conv_svg: (svg, type) => {					// MakerをSVGに追加 理由：leafletがアイコンをIMG扱いするため
			let marker = $("div.leaflet-marker-pane").children();
			let parser = new DOMParser(), svgicon, svgtext, text, svgstl;
			for (let i = 0; i < marker.length; i++) {
				let pathname = $(marker.eq(i)[0].children).children().attr('src');
				svgstl = marker.eq(i).css("transform").slice(7, -1).split(",");
				let offset = [];
				switch (marker.eq(i).css("margin")) {
					case "":
						offset[0] = parseInt(marker.eq(i).css("margin-top"), 10);
						offset[3] = parseInt(marker.eq(i).css("margin-left"), 10);
						break;
					default:
						marker.eq(i).css("margin").split(" ").forEach((val) => offset.push(parseInt(val, 10)));	// オフセット値を取得
						break;
				};
				svgtext = $(marker.eq(i)[0].children).find("span");
				switch (pathname) {
					case undefined:					// not icon(qr etc...)
						svgicon = $(marker.eq(i)[0].children).find("svg");
						svg_append(svg, svgicon, marker.eq(i), { x: $(svgicon).width() / 2, y: $(svgicon).height() / 2 }, offset);
						text = svgtext.text();
						if (text !== undefined) {	// QRCode Text
							LayerCont.text_write(svg, {
								"text": text, "anchor": 'start', "x": Number(svgstl[4]) + offset[3] + $(svgicon).width(), "y": Number(svgstl[5]) + offset[0] + 5, "no": i,
								"width": svgtext.width(), "height": $(svgicon).height(), "size": parseInt(svgtext.css("font-size")), "color": Conf.effect.text.color, "font": "Helvetica", "type": type
							});
						};
						break;
					default:
						let filename = pathname.match(".+/(.+?)([\?#;].*)?$")[1];
						svgicon = $(marker.eq(i)[0].children).find("img");
						let svgsize = { x: svgicon.width(), y: svgicon.height() };
						svgicon = $(parser.parseFromString(SvgIcon[filename], "text/xml")).children();
						svg_append(svg, svgicon, marker.eq(i), svgsize, offset);
						text = $(marker.eq(i)[0].children).children().attr('icon-name');
						if (text !== undefined && text !== "" && Conf.effect.text.view) {					// Marker Text
							LayerCont.text_write(svg, {
								"text": text, "anchor": 'start', "x": Number(svgstl[4]) + Math.ceil(svgsize.x / 2) + 4, "y": Number(svgstl[5]) + offset[0] + 5, "no": i,
								"width": svgtext.width(), "height": svgtext.height(), "size": parseInt(svgtext.css("font-size")), "color": Conf.default.Text.color, "font": "Helvetica", "type": type
							});
						};
						break;
				};
			};

			function svg_append(svg, svgicon, marker, size, offset) {
				let svgvbox;
				if ($(svgicon).attr('viewBox') == undefined) {
					svgvbox = [0, 0, size.x, size.y];
				} else {
					svgvbox = $(svgicon).attr('viewBox').split(' ');
				};
				let scale = Math.ceil((size.x / (svgvbox[2] - svgvbox[0])) * 1000) / 1000;
				let group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
				for (let key in svgicon[0].childNodes) {
					let nodeName = svgicon[0].childNodes[key].nodeName;
					if (nodeName == "path" || nodeName == "g" || nodeName == "defs" || nodeName == "rect" || nodeName == "ellipse" || nodeName == "style") {
						group.append(svgicon[0].childNodes[key].cloneNode(true));
					};
				};
				let svgstl = marker.css("transform").slice(7, -1).split(",")						// transformのstyleから配列でXとY座標を取得(4と5)
				$(group).attr("transform", "matrix(1,0,0,1," + (Number(svgstl[4]) + offset[3]) + "," + (Number(svgstl[5]) + offset[0]) + ") scale(" + scale + ")");
				svg.append(group);
			};
		},

		set_size: (size, view) => {
			let icon_xy = Math.ceil(size * Conf.default.Icon.scale);
			Conf.effect.text.size = size;		// set font size 
			Conf.effect.text.view = view;
			Conf.effect.icon.x = icon_xy;		// set icon size
			Conf.effect.icon.y = icon_xy;
		},

		center: (osmid) => {
			Conf.default.Circle.radius = Math.pow(2, 21 - map.getZoom());
			let latlng = PoiCont.get_osmid(osmid).latlng;
			if (latlng.lat.length == undefined) {		// latlngが複数ある場合はcircleなし
				let circle = L.circle(latlng, Conf.default.Circle).addTo(map);
				setTimeout(() => map.removeLayer(circle), Conf.default.Circle.timer);
			};
		},

		all_clear: () => Object.keys(markers).forEach((target) => Marker.delete(target)),	// all delete

		delete: (target, osmid) => {														// Marker delete * don't set PoiData
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
		let tags = PoiCont.get_osmid(id).geojson.properties;
		let chg_mkr = `<button class='btn btn-sm m-2' onclick='CMapmaker.poi_marker_change("${key}","${id}")'>${glot.get("marker_change")}</button>`;
		let del_btn = `<button class='btn btn-sm m-2' onclick='CMapmaker.poi_del("${key}","${id}")'>${glot.get("marker_delete")}</button>`;
		if (key == Conf.target.wikipedia.tag) {		// Wikipedia時のPopUp
			let qr_btn = `<button class='btn btn-sm m-2' onclick='CMapmaker.qr_add("wikipedia","${id}")'>${glot.get("qrcode_make")}</button>`;
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
