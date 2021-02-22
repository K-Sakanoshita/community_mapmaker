// Leaflet Control
class Leaflet {
    init() {
        let def = Conf.default;
        let osm_mono = L.tileLayer.colorFilter(Conf.tile.OSM_Standard, { maxNativeZoom: 19, maxZoom: 21, attribution: Conf.tile.OSM_Copyright, filter: Mono_Filter });
        let osm_std = L.tileLayer(Conf.tile.OSM_Standard, { maxNativeZoom: 19, maxZoom: 21, attribution: Conf.tile.OSM_Copyright });
        let osm_tiler = L.mapboxGL({ accessToken: '', style: Conf.tile.Tiler_Style, attribution: Conf.tile.Tiler_Copyright });
        let t_pale = L.tileLayer(Conf.tile.GSI_Standard, { maxNativeZoom: 18, maxZoom: 21, attribution: Conf.tile.GSI_Copyright });
        let t_ort = L.tileLayer(Conf.tile.GSI_Ortho, { maxNativeZoom: 18, maxZoom: 21, attribution: Conf.tile.GSI_Copyright });
        let o_std_mini = L.tileLayer(Conf.tile.OSM_Standard, { attribution: Conf.tile.OSM_Copyright });
        map = L.map('mapid', { doubleClickZoom: false, center: def.mapcenter, zoom: def.zoom, zoomSnap: def.zoomSnap, zoomDelta: def.zoomSnap, maxZoom: def.maxZoomLevel, layers: [osm_tiler] });
        Control["minimap"] = new L.Control.MiniMap(o_std_mini, { toggleDisplay: true, width: 120, height: 120, zoomLevelOffset: -4 }).addTo(map);
        new L.Hash(map);
        let maps = {
            "OpenStreetMap Maptiler": osm_tiler,
            "OpenStreetMap Standard": osm_std,
            "OpenStreetMap Monochrome": osm_mono,
            "地理院地図 淡色": t_pale,
            "地理院地図 オルソ": t_ort
        };
        Control["maps"] = L.control.layers(maps, null, { position: 'topright' }).addTo(map);
        map.zoomControl.setPosition("topright");									// Make: Zoom control        
    };

    stop() {
        ["dragging", "touchZoom", "touchZoom"].forEach(key => map[key].disable());
        Control["maps"].remove(map);
        Control["locate"].remove(map);
        Control["minimap"].remove(map);
        map.zoomControl.remove(map);
        if (map.tap) map.tap.disable();
        document.getElementById('mapid').style.cursor = 'default';
    };

    start() {
        ["dragging", "touchZoom", "touchZoom"].forEach(key => map[key].enable());
        Control["maps"].addTo(map);
        Control["locate"].addTo(map);
        Control["minimap"].addTo(map);
        map.zoomControl.addTo(map);
        if (map.tap) map.tap.enable();
        document.getElementById('mapid').style.cursor = 'grab';
    };

    controlAdd(position, domid, html, css) {     // add leaflet control
        let dom = L.control({ "position": position, "bubblingMouseEvents": false });
        dom.onAdd = function () {
            this.ele = L.DomUtil.create('div');
            this.ele.id = domid;
            this.ele.innerHTML = html;
            this.ele.className = css;
            return this.ele;
        };
        dom.addTo(map);
    };

};
var leaflet = new Leaflet();

// GeoJson Control
var GeoCont = (function () {

    return {
        // csv(「”」で囲われたカンマ区切りテキスト)をConf.markerのcolumns、tagsをもとにgeojsonへ変換
        csv2geojson: (csv, key) => {
            let tag_key = [], columns = Conf.osm[key].columns;
            let texts = csv.split(/\r\n|\r|\n/).filter(val => val !== "");
            cols = texts[0].split('","').map(col => col.replace(/^"|"$|/g, ''));
            for (let i = 0; i < cols.length; i++) {
                if (columns[cols[i]] !== undefined) tag_key[i] = columns[cols[i]];
            };
            texts.shift();
            let geojsons = texts.map((text, line) => {
                cols = text.split('","').map(col => col.replace(/^"|"$/g, ''));
                let geojson = { "type": "Feature", "geometry": { "type": "Point", "coordinates": [] }, "properties": {} };
                let tag_val = {};
                for (let i = 0; i < cols.length; i++) {
                    if (tag_key[i] !== undefined) {
                        tag_val[tag_key[i]] = tag_val[tag_key[i]] == undefined ? cols[i] : tag_val[tag_key[i]] + cols[i];
                    };
                };
                geojson.geometry.coordinates = [tag_val._lng, tag_val._lat];
                geojson.id = `${key}/${line}`;
                Object.keys(tag_val).forEach((idx) => {
                    if (idx.slice(0, 1) !== "_") geojson.properties[idx] = tag_val[idx];
                });
                Object.keys(Conf.osm[key].add_tag).forEach(tkey => {
                    geojson.properties[tkey] = Conf.osm[key].add_tag[tkey];
                });
                return geojson;
            });
            return geojsons;
        },

        // 2線の交差チェック 線分ab(x,y)とcd(x,y) true:交差 / false:非交差
        judgeIentersected: (a, b, c, d) => {
            let ta = (c[0] - d[0]) * (a[1] - c[1]) + (c[1] - d[1]) * (c[0] - a[0]);
            let tb = (c[0] - d[0]) * (b[1] - c[1]) + (c[1] - d[1]) * (c[0] - b[0]);
            let tc = (a[0] - b[0]) * (c[1] - a[1]) + (a[1] - b[1]) * (a[0] - c[0]);
            let td = (a[0] - b[0]) * (d[1] - a[1]) + (a[1] - b[1]) * (a[0] - d[0]);
            return tc * td <= 0 && ta * tb <= 0; // 端点を含む
        },

        bboxclip: (cords, strict) => { // geojsonは[経度lng,緯度lat]
            let LL = GeoCont[strict ? "get_LL" : "get_LLL"]();
            new_cords = cords.filter((cord) => {
                if (cord[0] < (LL.NW.lng)) return false;
                if (cord[0] > (LL.SE.lng)) return false;
                if (cord[1] < (LL.SE.lat)) return false;
                if (cord[1] > (LL.NW.lat)) return false;
                return true;
            });
            return new_cords;
        },

        multi2flat: (cords, type) => {     // MultiPoylgon MultiString -> Polygon(broken) String
            let flats;
            switch (type) {
                case "Point":
                    flats = cords;
                    break;
                case "LineString":
                    flats = [cords];
                    break;
                case "MultiPolygon":
                    flats = cords.flat();
                    break;
                default:
                    flats = [cords.flat()];
                    break;
            };
            return flats;
        },

        flat2single: (cords, type) => {  // flat cordsの平均値(Poiの座標計算用)
            let cord, lat = 0, lng = 0, counts = 0;
            switch (type) {
                case "Point":
                    cord = [cords[0], cords[1]];
                    break;
                case "LineString":
                    cords.forEach(latlng => {
                        counts++;
                        lat += latlng[0];
                        lng += latlng[1];
                    });
                    cord = [lat / counts, lng / counts];
                    break;
                default:    // Polygon or MultiLineString or MultiPolygon
                    cords.forEach(cords1 => {
                        let scords = type == "MultiPolygon" ? cords1[0] : cords1;
                        scords.forEach(latlng => {
                            counts++;
                            lat += latlng[0];
                            lng += latlng[1];
                        });
                    });
                    cord = [lat / counts, lng / counts];
                    break;
            };
            return cord;
        },

        // 指定した方位の衝突するcords内のidxを返す
        get_maxll: (st_cord, cords, exc_idx, orient) => {
            let LLL = GeoCont.get_LLL(), idx, ed_cord = [], found = -1;
            if (orient == "N") ed_cord = [st_cord[0], LLL.NW.lat]; // [経度lng,緯度lat]
            if (orient == "S") ed_cord = [st_cord[0], LLL.SE.lat];
            if (orient == "W") ed_cord = [LLL.NW.lng, st_cord[1]];
            if (orient == "E") ed_cord = [LLL.SE.lng, st_cord[1]];

            for (idx = 0; idx < cords.length; idx++) {  //
                if (cords[idx] !== undefined && exc_idx !== idx) {  //
                    found = cords[idx].findIndex((ck_cord, ck_id) => {
                        if (ck_id < cords[idx].length - 1) return GeoCont.judgeIentersected(st_cord, ed_cord, ck_cord, cords[idx][ck_id + 1]);
                        return false;
                    });
                };
                if (found > -1) break;
            };
            return (found > -1) ? idx : false;
        },

        get_LL: () => {			// LatLngエリアの設定 [経度lng,緯度lat]
            return { "NW": map.getBounds().getNorthWest(), "SE": map.getBounds().getSouthEast() };
        },

        get_LLL: () => {		// 拡大LatLngエリアの設定 [経度lng,緯度lat]
            let LL = GeoCont.get_LL();
            LL.NW.lng = LL.NW.lng * 0.99997;
            LL.SE.lng = LL.SE.lng * 1.00003;
            LL.SE.lat = LL.SE.lat * 0.99992;
            LL.NW.lat = LL.NW.lat * 1.00008;
            return LL;
        },

        get_maparea: (mode) => {	// OverPassクエリのエリア指定
            let LL;
            if (mode == "LLL") {
                LL = GeoCont.get_LLL();
            } else {
                LL = GeoCont.get_LL();
            };
            return `(${LL.SE.lat},${LL.NW.lng},${LL.NW.lat},${LL.SE.lng});`;
        },

        // Debug Code
        gcircle: (geojson) => { // view geojson in map
            let features = [], colors = ["#000000", "#800000", "#FF0080", "#008000", "#00FF00", "#000080", "#0000FF", "#800080", "#FF00FF", "#808000", "#FFFF00", "#008080", "#00FFFF", "#800080", "#FF00FF"];
            let timer = Conf.style.Circle.timer;
            if (!Array.isArray(geojson)) {
                if (geojson.features !== undefined) features = geojson.features;
            } else {
                features = geojson;
                if (features[0].geometry == undefined) features = { geometry: { coordinates: geojson } };
            };
            features.forEach((val, idx) => {
                let geo = val.geometry;
                let cords = geo.coordinates.length == 1 && geo.coordinates[0][0].length > 1 ? geo.coordinates[0] : geo.coordinates;
                cords.forEach((latlng) => {
                    Conf.style.Circle.radius = Math.pow(2, 21 - map.getZoom());
                    let style = Conf.style.Circle;
                    let color = idx % colors.length;
                    style.color = colors[color];
                    let circle = L.circle(L.latLng(latlng[1], latlng[0]), style).addTo(map);
                    circle.addTo(map).on('click', e => { popup_icon(e) });
                    // console.log(`feature[${idx}]: [${latlng[1]}, ${latlng[0]}`);
                    setTimeout(() => map.removeLayer(circle), timer);
                    timer += 100;
                });
            });

            function popup_icon(ev) {
                let popcont = JSON.stringify(ev.latlng);
                L.responsivePopup({ "keepInView": true }).setContent(popcont).setLatLng(ev.latlng).openOn(map);
                ev.target.openPopup();
                return false;
            };
        },

        ccircle: (cords) => {   // view cord in map
            let geojson = {
                features: [{
                    geometry: { coordinates: cords },
                    properties: {},
                    type: "Feature"
                }]
            };
            GeoCont.gcircle(geojson);
        },

        bbox_write: () => { // view maparea
            let LL = GeoCont.get_LL();
            let bcords = [[LL.NW.lat, LL.NW.lng], [LL.NW.lat, LL.SE.lng], [LL.SE.lat, LL.SE.lng], [LL.SE.lat, LL.NW.lng], [LL.NW.lat, LL.NW.lng]];
            L.polyline(bcords, { color: 'red', weight: 4 }).addTo(map);

            LL = GeoCont.get_LLL();
            bcords = [[LL.NW.lat, LL.NW.lng], [LL.NW.lat, LL.SE.lng], [LL.SE.lat, LL.SE.lng], [LL.SE.lat, LL.NW.lng], [LL.NW.lat, LL.NW.lng]];
            L.polyline(bcords, { color: 'black', weight: 4 }).addTo(map);
        }
    };
})();

