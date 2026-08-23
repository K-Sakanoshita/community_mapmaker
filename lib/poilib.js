"use strict"

// PoiData Control
class PoiCont {

    #layerMatch = {};
    #hoveredMarker = null;

    constructor() {
        this.pdata = { geojson: [], targets: [] }		//poi data variable
        this.adata = []									//act data variable /  poi's lnglat & geoidx
        this.cat_cache = {}
        this.lnglats = {}
        this.geoidx = {}
        this.parent = []		// (Poiのみ)親ポリゴンを示す
        this.polygons = []		// Polygon内に含まれるか調べるためのポリゴン一覧
        this.tiles = {}			// polygonsと同じキーのタイル番号を記録
        this.countries = []     // 国のポリゴンと名称データ
    }

    init(useCountries) {
        const generateIconImageExpression = function (markerJson) {
            const expression = ["case"];
            const subtagMap = markerJson.subtag ?? {};
            const tagIconMap = markerJson.tag ?? {};

            const normalizeIcon = (icon) => {
                return icon ? icon.replace(".svg", ".png") : "";
            };

            // subtag (key=value形式) 優先評価
            for (const keyEqVal in subtagMap) {
                const [key, val] = keyEqVal.split("=");
                const subKeyMap = subtagMap[keyEqVal];
                for (const subKey in subKeyMap) {
                    const valueMap = subKeyMap[subKey];
                    for (const subVal in valueMap) {
                        const icon = normalizeIcon(valueMap[subVal]);
                        if (!icon) continue;
                        expression.push(["all", ["==", ["get", key], val], ["==", ["get", subKey], subVal]], icon);
                    }
                }
            }

            // 通常タグ評価
            // ["has", key] でまとめない。
            // 値が見つからなかった場合に次のタグへ進ませるため、
            // key=value の完全一致だけを case に積む。
            for (const key in tagIconMap) {
                const tagValues = tagIconMap[key];
                if (!tagValues || tagValues["*"]) continue;
                for (const val in tagValues) {
                    if (val === "*") continue;
                    const icon = normalizeIcon(tagValues[val]);
                    if (!icon) continue;
                    expression.push(["==", ["get", key], val], icon);
                }
            }
            // 全部見つからなかった時だけデフォルト
            expression.push(markerJson?.tag?.["*"]?.["*"] ?? "marker-stroked.png");
            return expression;
        };
        this.#layerMatch = generateIconImageExpression(Conf.marker)

        // 国コードとポリゴン情報を取得
        if (useCountries) {
            fetch('./data/countries.min.json').then((res) => {
                res.json().then((json) => { this.countries = json.features.filter(f => f.properties["ISO3166-1-Alpha-2"] !== "-99"); })
            })
        }

    }

    deleteAll() { poiCont.pdata = { geojson: [], targets: [] } }

    pois() { return { pois: poiCont.pdata, acts: poiCont.adata, lnglats: poiCont.lnglats } };

    getTargets() {      // Conf.view.poiZoomのtargetを返す(edit時はpoiEditも合成)
        let targets = Object.keys(Conf.poiView.poiZoom)
        targets = Conf.etc.editMode ? targets.concat(Object.keys(Conf.poiView.editZoom)) : targets	// 編集時はeditZoom追加
        return [...new Set(targets)];
    }

    setActdata(json) { poiCont.adata = json };		// set GoogleSpreadSheetから帰ってきたJson

    setActlnglat() {								// set Act LngLat by OSMID
        poiCont.adata.forEach((act) => {
            let osmdata = poiCont.get_osmid(act.osmid)
            if (osmdata !== undefined) { act.lnglat = osmdata.lnglat }
        })
    }

    addGeojson(pois) {								// add geojson pois / pois: {geojson: [],targets: []}
        let children = []

        function setGeojson(poi) {								// addGeojsonのサブ機能
            let cidx = poiCont.geoidx[poi.geojson.id];
            if (cidx !== undefined && poiCont.pdata.geojson[cidx]?.id != poi.geojson.id) cidx = undefined;
            if (cidx === undefined) {       	                   	    // 無い時は追加
                poiCont.pdata.geojson.push(poi.geojson);
                poiCont.pdata.targets.push([...(poi.targets ?? [])]);
                cidx = poiCont.pdata.targets.length - 1;
            } else {
                poiCont.pdata.geojson[cidx] = poi.geojson;
                poiCont.pdata.targets[cidx] = [...new Set([
                    ...(poiCont.pdata.targets[cidx] ?? []),
                    ...(poi.targets ?? [])
                ])];
            };
            return cidx;
        };
        pois.geojson.forEach((node, node_idx) => {			    // 既存Poiに追加
            let poi = { "geojson": pois.geojson[node_idx], "targets": pois.targets[node_idx] }
            const cidx = setGeojson(poi)
            poiCont.geoidx[node.id] = cidx
            if (poiCont.lnglats[node.id] == undefined) {	    // 初期登録時
                let ll = geoCont.flat2single(node.geometry.coordinates, node.geometry.type)
                poiCont.lnglats[node.id] = [ll[0], ll[1]]
                poiCont.tiles[node.id] = geoCont.ll2tile({ lng: ll[0], lat: ll[1] }, 14)	// タイル番号を保存
                // 表示専用データ（indoor の建物輪郭など）は親ポリゴン検索へ流さない。
                // 全件同士の包含判定になるため、建物が多い市街地では大きな待ち時間になる。
                if (poiCont.isPoiListVisible(poi.targets)) {
                    if (node.geometry.type == "Polygon") poiCont.polygons[node.id] = node	// 後でPolygon内のPoi検索に利用
                    children[node.id] = node												// Polygonもchildrenに追加
                }
            }
        })

        let pt1 = { "type": "Feature", "properties": {}, "geometry": { "type": "Point", "coordinates": [0, 0] } }
        for (const child in children) { // childrenがポリゴンに含まれているか確認
            pt1.geometry.coordinates[1] = poiCont.lnglats[child][1]
            pt1.geometry.coordinates[0] = poiCont.lnglats[child][0]
            if (!isNaN(pt1.geometry.coordinates[0])) {
                for (const polygon of Object.values(poiCont.polygons)) {
                    let polyT = poiCont.tiles[polygon.id]
                    let chldT = poiCont.tiles[child]
                    let diff = Math.abs(polyT.tileX - chldT.tileX) + Math.abs(polyT.tileY - chldT.tileY)
                    if (child !== polygon.id && diff <= 2) { // 同一要素&遠いタイルはチェックしない
                        if (turf.booleanPointInPolygon(pt1, poiCont.polygons[polygon.id])) { // ポリゴン内に存在すれば親を設定する
                            //console.log("addGeojson: " + child + " in " + polygon.id)
                            poiCont.parent[child] = poiCont.polygons[polygon.id]
                        }
                    }
                }
            }
        }
        console.log("PoiCont: addGeojson: " + Object.keys(children).length + " Counts.")
    }

    get_parent(osmid) { return poiCont.parent[osmid]; };		// osmidを元に親geojson全体を返す

    get_osmid(osmid) {           								// osmidを元にgeojsonと緯度経度、targetを返す
        let idx = poiCont.geoidx[osmid];
        return idx == undefined ? undefined : {
            geojson: poiCont.pdata.geojson[idx], lnglat: poiCont.lnglats[osmid], targets: poiCont.pdata.targets[idx]
        }
    }

    get_actid(actid) {
        let act = poiCont.adata.filter(line => actid == line.id);
        return act == undefined ? undefined : act[0];
    }

    // id(osm,act両対応)を元に緯度経度を返す
    getLnglatbyId(id) {
        let act = poiCont.adata.filter(line => id == line.id);
        let osm = act !== undefined && act.length > 0 ? poiCont.get_osmid(act[0].osmid) : poiCont.get_osmid(id);
        return osm !== undefined ? osm.lnglat : undefined
    };

    getOsmidByCountryCode(CCode) {       // 国コードからOSMIDを返す
        let osm = poiCont.pdata.geojson.filter(line => {
            let country = line.properties.country !== undefined ? line.properties.country : ""
            let countries = country.split(";")
            return countries.indexOf(CCode) > -1
        });
        return osm.length > 0 ? osm[0].id : ""
    }

    getPolygonByCountryCode(CCode) {    // 国コードから国ポリゴンを返す
        let geojson = poiCont.countries.filter(line => CCode == line.properties["ISO3166-1-Alpha-2"]);
        return geojson.length > 0 ? geojson : ""
    }

    getPolygonByPoint(pt) {                // 与えられたPoint Geojsonが何処の国を指しているか返す
        const matches = this.countries.filter(f => turf.booleanPointInPolygon(pt, f))   // 国判定
        if (matches.length > 0) console.log(`CountryCode: ${matches[0].properties["ISO3166-1-Alpha-2"]}`)
        return matches
    }

    getAllOSMCountryCode() {    // OSMの全ての国コードを返す
        let osm = poiCont.pdata.geojson.filter(line => line.properties.country !== undefined);
        osm = osm.flatMap(line => line.properties.country.split(";"))
        return osm.length > 0 ? basic.uniq(osm) : []
    }

    // 訪問済みの国ポリゴンを返す
    getPolygonVisitedCountory() {
        let visitedcountory = [], allVisiteds = poiStatusCont.getAllVisited()
        allVisiteds.forEach(line => {
            let CCode = "", osm = poiCont.get_osmid(line[0].split(".")[1]);
            if (osm !== undefined) {    // OSMIDのデータを持っている場合
                CCode = osm.geojson.properties.country
                CCode = CCode !== undefined ? CCode : ""
            }
            if (CCode !== "") { // CCodeが見つかった場合
                let CPoly = poiCont.getPolygonByCountryCode(CCode)
                if (CPoly !== undefined && CPoly !== "") visitedcountory.push(CPoly[0])
            }
        })
        return visitedcountory
    }

    getActlistByOsmid(osmid) { return poiCont.adata.filter(a => a.osmid == osmid); };	// get activities by osmid

    // get Category Name & subname & tag
    // [catname, subcatname, maintag, subtag]
    getCatnames(tags) {
        // tags が properties / properties.tags のどちらでも動くように正規化
        const t = (tags && typeof tags === "object" && tags.tags && typeof tags.tags === "object")
            ? tags.tags
            : (tags ?? {});

        const id = t.id ?? tags?.id;                       // OSMID 想定
        const cacheKey = (id != null) ? String(id) : null;

        const cached = cacheKey ? poiCont.cat_cache?.[cacheKey] : undefined;
        if (cached !== undefined) return Array.from(cached);

        let catname = "";
        let mainkey = "";
        let mainval = "";

        const mainkeys = Conf.category_keys.filter(key => key !== "*" && t[key] !== undefined);

        // mainkeys が無い → デフォルトを返す（必ず配列で返す）
        if (mainkeys.length === 0) {
            const v = Conf.category?.["*"]?.["*"];
            const result = Array.isArray(v)
                ? Array.from(v)
                : [v ?? glot.get("undefined"), "", "*=*", ""];
            if (cacheKey) poiCont.cat_cache[cacheKey] = result;
            return Array.from(result);
        }

        // category 名を探す（見つかれば mainkey/mainval も確定）
        for (const k of mainkeys) {
            const v = t[k] ?? "*";
            const name = Conf.category?.[k]?.[v];
            if (name !== undefined && name !== "") {
                mainkey = k;
                mainval = v;
                catname = name;
                break;
            }
        }

        // 見つからなかった場合でも mainkey/mainval を確定させて "-" を作らない
        if (!mainkey) {
            mainkey = mainkeys[0];
            mainval = t[mainkey] ?? "*";
        }
        if (!catname) catname = glot.get("undefined");

        // sub category
        let subcatname = "";
        let subkeyval = "";
        const subtag = Conf.category_sub?.[mainkey];
        if (subtag) {
            for (const [subkey, subvals] of Object.entries(subtag)) {
                const v = t[subkey];
                if (v === undefined) continue;
                const sub = subvals?.[v];
                if (sub !== undefined && sub !== "") {
                    subcatname = sub;
                    subkeyval = `${subkey}=${v}`;
                    break;
                }
            }
        }

        const result = [catname, subcatname, `${mainkey}=${mainval}`, subkeyval];
        if (cacheKey) poiCont.cat_cache[cacheKey] = result;
        return Array.from(result);
    }

    get_wikiname(tags) {          													// get Wikipedia Name from tag
        let wikiname = tags["wikipedia"] ? tags["wikipedia"].split(':')[1] : "";	// value値の":"の右側を返す
        return wikiname;
    };

    getTarget(target) {											// 指定したtargetのpoisとactsを返す
        let pois = poiCont.getPois(target, true);
        let acts = [];
        switch (target) {
            case "activity":
                acts = poiCont.adata;
                break;
            default:
                acts = poiCont.adata.filter(a => { return a.category == target });
                break;
        };
        return { "pois": pois, "acts": acts };
    };

    getPois(targets, allPoi = false) {
        const res = { geojson: [], lnglat: [], targets: [] };
        const geojson = poiCont?.pdata?.geojson ?? [];
        const tgtArr = poiCont?.pdata?.targets ?? [];
        const isArray = Array.isArray(targets);
        const allowAll = allPoi || targets === "-" || targets === "*" || (isArray && targets.length === 0);
        const wantSet = allowAll ? null : new Set((isArray ? targets : [targets]).map(v => String(v)));

        geojson.forEach((feat, idx) => {
            const tgts = tgtArr[idx] ?? [];
            const hit = allowAll || tgts.some(t => wantSet.has(String(t)));            // allowAll なら無条件で通す
            if (hit) {
                res.geojson.push(feat);
                res.lnglat.push(poiCont?.lnglats?.[feat.id]);
                res.targets.push(tgts.slice()); // 参照切り
            }
        });
        return res;
    }

    isPoiListVisible(targets) {
        const activeTargets = new Set(this.getTargets());
        return (targets ?? []).some(target => {
            if (!activeTargets.has(target)) return false;
            const expression = Conf.osm?.[target]?.expression;
            return expression?.poiView !== false && expression?.listView !== false;
        });
    }

    // ListTable向きの配列を出力 / リストの最後に カテゴリ名の元タグ と targets を追加
    makeList(targets, noInner) {
        const zoomlv = mapLibre.getZoom(true);
        let LL = mapLibre.get_LL();
        let pois = poiCont.getPois(targets, false); // poiViewがfalseなものはリストに入れない
        let datas = [], listed = {};                // targetsに指定されたpoiのみフィルター

        // activityを元にリスト作成
        if (targets.indexOf(Conf.google.targetName) > -1 || targets.indexOf("-") > -1) {				    // targetsにgSheet名があればリストに追加
            poiCont.adata.forEach((line) => {
                if (line !== undefined) {
                    let data = [], poi = poiCont.get_osmid(line.osmid);
                    if (poi !== undefined) {
                        const actTargets = [Conf.google.targetName, ...poi.targets];
                        const inZoom = this.#isTargetInPoiViewZoom(actTargets, zoomlv);
                        let allActs = Conf.listTable.allActs ? true : geoCont.checkInner(poi.lnglat, LL); // 画面内でフィルタ
                        if (inZoom && allActs) {
                            let names = poiCont.getCatnames(poi.geojson.properties)
                            Conf.list.columns.actFields.forEach(key => {
                                if (key.indexOf("datetime") > -1) {											// フィールド名に日時を含む場合
                                    data.push(basic.formatDate(new Date(line.updatetime), "YYYY/MM/DD"))
                                } else if (key.indexOf("#category") > -1) {
                                    data.push(names[0] + (names[1] !== "" ? `(${names[1]})` : "")) 			// category追加
                                } else if (key.indexOf("#") > -1) {											// #が付いている場合はOSMタグを取得
                                    let tagname = key.substring(key.indexOf("#") + 1)
                                    let osmtag = poi !== undefined ? poi.geojson.properties[tagname] : ""	// OSM tag名を指定した場合
                                    data.push(osmtag)
                                } else {
                                    data.push(line[key] == undefined ? "" : line[key])						// gsheet追加
                                }
                            })
                            data.push(names[2]);											// listにカテゴリ名の元タグを追加
                            data.push(poi.targets);							                // listの最後にtargetを追加
                            data.push(poiCont.getIcon(poi.geojson.properties))				// アイコンファイル名を追加
                            datas.push(data);
                        }
                        listed[poi.geojson.properties.id] = true    // 画面範囲外であってもフラグは付ける
                    } else {
                        //console.log("poiCont.makeList: No OSMID: " + line.osmid);
                    };
                };
            });
        };

        // target(tag)を元にリスト追加
        for (const [idx, node] of pois.geojson.entries()) {
            const listTargets = pois.targets[idx] ?? [];
            const listVisible = this.isPoiListVisible(listTargets);
            if (!listVisible) continue;
            let tags = node.properties, data = []
            let names = poiCont.getCatnames(tags)
            const inZoom = this.#isTargetInPoiViewZoom(pois.targets[idx], zoomlv);
            if (inZoom && (noInner ? true : geoCont.checkInner(pois.lnglat[idx], LL)) && listed[tags.id] !== true) {
                listed[tags.id] = true
                Conf.list.columns.poiFields.forEach(key => {
                    if (key == "#category") {										// #は内部データを利用する意味
                        let vName = names[1] !== "" ? `${names[0]}(${names[1]})` : names[0]
                        data.push(vName);										// category追加
                    } else if (key.indexOf("#parent") > -1) {						// 親データを使う意味
                        let keys = key.substring(key.indexOf(".") + 1).split(",")	// キー取得(複数の可能性あり)
                        let ptag, pGeo = poiCont.get_parent(tags.id)
                        ptag = pGeo ? pGeo.properties[keys[0]] : tags[keys[1]]
                        data.push(ptag == undefined ? "" : ptag)					// osmtag追加
                    } else if (key == "reservation") {                          // 予約の時
                        let reserv = "";
                        switch (tags["reservation"]) {
                            case "yes": reserv = glot.get("reservation_yes"); break;
                            //case "no": reserv = glot.get("reservation_no"); break;    // 予約不要は書かない
                            case "recommended": reserv = glot.get("reservation_recommended"); break;
                        }
                        data.push(reserv);
                    } else if (key == "name") {                                 // 名前の時
                        let name = tags.name;
                        name = name == undefined ? tags["flag:name"] : name;    // 名前がundefined時はflag:nameを取得
                        data.push(name)
                    } else {
                        data.push(tags[key] == undefined ? "" : tags[key])			// osmtag追加
                    }
                })
                data.push(names[2] + (names[3] !== "" ? `,${names[3]}` : ""))		// カテゴリ名の元タグ(サブも)を追加
                data.push(pois.targets[idx])										// listの最後にtargetを追加
                data.push(poiCont.getIcon(tags))									// アイコンファイル名を追加
                datas.push(data)
            }
        }
        datas.sort((a, b) => { return (a[0] > b[0]) ? 1 : -1 });
        return datas;
    }

    getIcon(tags) {		// get icon filename
        const t = (tags && typeof tags === "object" && tags.tags && typeof tags.tags === "object") ? tags.tags : (tags ?? {});
        const fallback = Conf.marker?.tag?.["*"]?.["*"] ?? "marker-stroked.png";
        const normalizeIcon = (icon) => { return icon ? icon.replace(".svg", ".png") : ""; };

        // 1. subtag を最優先
        const subtagMap = Conf.marker?.subtag ?? {};
        for (const keyEqVal in subtagMap) {
            const [key, val] = keyEqVal.split("=");
            if (t[key] !== val) continue;
            const subKeyMap = subtagMap[keyEqVal];
            for (const subKey in subKeyMap) {
                const subVal = t[subKey];
                if (subVal === undefined) continue;
                const icon = subKeyMap[subKey]?.[subVal];
                if (icon) return normalizeIcon(icon);
            }
        }

        // 2. 通常タグ
        // Conf.category_keys の順番で見るが、
        // その key=value にアイコンが無ければ次のタグへ進む
        const mainkeys = Conf.category_keys.filter(key => key !== "*" && t[key] !== undefined);
        for (const mainkey of mainkeys) {
            const mainval = t[mainkey];
            const icon = Conf.marker?.tag?.[mainkey]?.[mainval];
            if (icon) return normalizeIcon(icon);
        }

        // 3. 全部見つからなかった時だけfallback
        return fallback;
    }

    // OSMタグからnameを取得
    getOSMname(tags, lang) {    // tags:OSMタグ(geoJsonのproperties相当)、lang:言語(ISO 639-1)
        if (!tags) return "";
        if (tags["bridge:name"]) return tags["bridge:name"];	                 // 橋の名称
        if (tags[`name:${lang}`]) return tags[`name:${lang}`];                   // 指定言語の name タグを優先
        if (tags[`alt_name:${lang}`]) return tags[`alt_name:${lang}`];           // alt_name の言語別タグがあれば次に優先
        if (tags[`loc_name:${lang}`]) return tags[`loc_name:${lang}`];           // loc_name や official_name の言語別タグもチェック
        if (tags[`official_name:${lang}`]) return tags[`official_name:${lang}`];
        if (tags.name) return tags.name;                                         // デフォルトの name
        if (tags.alt_name) return tags.alt_name.split(";")[0];                   // alt_name（カンマ区切りになることが多い）
        if (tags.official_name) return tags.official_name;                       // official_name や loc_name
        if (tags.loc_name) return tags.loc_name.split(";")[0];                   // ローカルネーム
        return "";
    }

    // Poi表示(actonly:true時はGSheetデータが無いと非表示)
    // params{flist, actonly}
    setPoi(flist, actonly) {
        const markerGeojson = this.#createEmptyMarkerGeojson();
        const markerParams = flist !== undefined
            ? this.#collectMarkerParamsFromList(flist, actonly)
            : this.#collectMarkerParamsFromCurrentView(actonly);

        markerParams.forEach(params => this.#addMarkerFeature(markerGeojson, params));
        this.#syncMarkerLayers(markerGeojson);
    }

    // マーカー用の空GeoJSONを作成
    #createEmptyMarkerGeojson() {
        return {
            shadow: { type: "FeatureCollection", features: [] },    // 影
            attention: { type: "FeatureCollection", features: [] }, // Acts時 / 営業中
            green: { type: "FeatureCollection", features: [] },     // 予約不要時
            middle: { type: "FeatureCollection", features: [] },    // 予約推奨時
            normal: { type: "FeatureCollection", features: [] },    // Wikipedia記事など
            visited: { type: "FeatureCollection", features: [] }    // 訪問済み
        };
    }

    #getMarkerTypes() {
        return ["attention", "green", "middle", "normal", "visited"];
    }

    #getPoiTags(poi) {
        return poi?.geojson?.properties?.tags == null
            ? (poi?.geojson?.properties ?? {})
            : poi.geojson.properties.tags;
    }

    // 表示対象かどうかを判定し、後続処理に必要な情報をまとめる
    #checkMarker(poi, actonly) {
        const zoomlv = mapLibre.getZoom(true);
        const LL = mapLibre.get_LL();

        if (!cMapMaker.isPoiVisibleInIndoorMode(poi)) return null;
        if (!geoCont.checkInner(poi.lnglat, LL)) return null;

        const actlists = poiCont.getActlistByOsmid(poi.geojson.id);
        const viewflag = actonly ? (actlists.length > 0) : true;
        if (!viewflag) return null;

        const targets = actlists.length > 0
            ? [Conf.google.targetName, ...poi.targets]
            : poi.targets;

        const visibleTargets = targets.filter(target => {
            if (!poiCont.getTargets().includes(target)) return false;
            if (target === Conf.google.targetName) return true;
            return Conf.osm?.[target]?.expression?.poiView !== false;
        });
        const inZoom = this.#isTargetInPoiViewZoom(visibleTargets, zoomlv);
        return inZoom ? { poi, actlists } : null;
    }

    // flist指定時の表示対象を集める
    #collectMarkerParamsFromList(flist, actonly) {
        console.log("poiCont: setPoi: " + flist.length + " counts");

        const markerParams = [];
        const usedOsmids = new Set();

        flist.forEach(list => {
            const listId = list[0];
            const activityKey = listId.split("/")[0];
            const inActs = Object.keys(Conf.activities).indexOf(activityKey);
            const act = inActs > -1 ? poiCont.get_actid(listId) : undefined;
            const osmid = act ? act.osmid : listId;

            if (usedOsmids.has(osmid)) return;

            const poi = poiCont.get_osmid(osmid);
            if (poi === undefined) {
                console.log("poiCont: no load osm data: " + listId);
                return;
            }

            usedOsmids.add(osmid);

            const params = this.#checkMarker(poi, actonly);
            if (params) markerParams.push(params);
        });

        return markerParams;
    }

    // 現在表示対象のPOIからマーカー候補を集める
    #collectMarkerParamsFromCurrentView(actonly) {
        const markerParams = [];

        this.#collectNormalPoiMarkerParams(actonly).forEach(params => {
            markerParams.push(params);
        });

        this.#collectActivityMarkerParams(actonly).forEach(params => {
            markerParams.unshift(params); // activity は手前表示にしたいので先頭へ
        });

        return markerParams;
    }

    // 通常POIのマーカー候補を集める
    #collectNormalPoiMarkerParams(actonly) {
        const markerParams = [];
        const allPois = poiCont.getPois("-", false); // 全データを取得(poiView=falseは除く)

        if (allPois.geojson === undefined) return markerParams;

        allPois.geojson.forEach((geojson, idx) => {
            const poi = {
                geojson,
                targets: allPois.targets[idx],
                lnglat: allPois.lnglat[idx]
            };
            const params = this.#checkMarker(poi, actonly);
            if (params && params.actlists.length === 0) {
                markerParams.push(params);
            }
        });

        return markerParams;
    }

    // Activity付きPOIのマーカー候補を集める
    #collectActivityMarkerParams(actonly) {
        const markerParams = [];

        poiCont.adata.forEach(act => {
            const osm = poiCont.get_osmid(act.osmid);
            if (!osm) return;

            const poi = {
                geojson: osm.geojson,
                targets: osm.targets,
                lnglat: osm.lnglat
            };

            const params = this.#checkMarker(poi, actonly);
            if (params && params.actlists.length > 0) {
                markerParams.push(params);
            }
        });

        return markerParams;
    }

    // POIの状態からマーカー種別と表示名を決め、FeatureCollectionへ追加
    #addMarkerFeature(markerGeojson, params) {
        const tags = this.#getPoiTags(params.poi);
        const poiStatus = poiStatusCont.getValueByOSMID(tags.id);
        const name = this.#buildMarkerName(tags, params.actlists, poiStatus);
        const markerType = this.#getMarkerType(tags, params.actlists, poiStatus);

        params.poi.geojson.properties.cmapmaker_name = name;

        const poiGeojson = this.#clonePoiAsPoint(params.poi, tags);
        markerGeojson[markerType].features.push(poiGeojson);

        if (tags.level !== undefined && cMapMaker.parseIndoorLevels(tags.level).some(level => Number(level) > 0)) {
            markerGeojson.shadow.features.push(poiGeojson);
        }
    }

    // マーカーに表示する名称を組み立てる
    #buildMarkerName(tags, actlists, poiStatus) {
        let name = poiCont.getOSMname(tags, glot.lang);

        if (!Conf.indoor?.use && tags.level !== undefined) {
            const floorLabel = cMapMaker.formatIndoorLevel(tags.level);
            if (floorLabel !== "") name += `\n(${floorLabel})`;
        }

        switch (tags.reservation) {
            case "yes":
                name += "\n(" + glot.get("reservation_yes") + ")";
                break;
            case "recommended":
                name += "\n(" + glot.get("reservation_recommended") + ")";
                break;
        }

        if (tags.opening_hours && Conf.map.openNow && basic.isOpenNow(tags.opening_hours)) {
            name += `\n(${glot.get("opening")})`;
        }

        if (poiStatus[PoiStatusIndex.MEMO] !== "" && poiStatus[PoiStatusIndex.MEMO] !== undefined) {
            name += `\n(${poiStatus[PoiStatusIndex.MEMO]})`;
        }

        const ref = tags.local_ref !== undefined
            ? tags.local_ref
            : (tags.ref !== undefined ? tags.ref : "");
        if (ref !== "") name = `(${ref}) ${name}`;

        if (name === "" && actlists.length > 0) {
            name = actlists[0][Conf.google.actTitle];
        }

        return name;
    }

    // マーカーの見た目種別を決める
    #getMarkerType(tags, actlists, poiStatus) {
        const isOpenNow = !!(tags.opening_hours && Conf.map.openNow && basic.isOpenNow(tags.opening_hours));

        if (actlists.length > 0 || isOpenNow) return "attention";
        if (tags.landuse === "retail") return "middle";
        if (tags.reservation === "recommended") return "middle";
        if (tags.wikipedia !== undefined) return "normal";
        if (poiStatus[PoiStatusIndex.VISITED]) {
            return Conf.etc.reverseIcon ? "normal" : "visited";
        }

        return Conf.etc.reverseIcon ? "visited" : "normal";
    }

    // Polygon/LineStringのPOIもマーカー用にはPointへ変換する
    #clonePoiAsPoint(poi, tags) {
        const poiGeojson = structuredClone(poi.geojson);

        if (poiGeojson.geometry.type !== "Point") {
            poiGeojson.geometry.type = "Point";
            poiGeojson.geometry.coordinates = poi.lnglat;
        }

        const osmid = tags.id ?? poi.geojson.id; // OSMID を確実にセット（promoteId 用）
        poiGeojson.properties.id = poiGeojson.properties.id ?? osmid;
        poiGeojson.id = poiGeojson.id ?? osmid;

        return poiGeojson;
    }

    // マーカークリック時の処理
    #selectMarker(e) {
        const props = e.features[0].properties;
        const poi = poiCont.get_osmid(props.id);
        if (!poi) return;

        const geojson = this.#clonePoiAsPoint(poi, poi.geojson.properties);

        if (mapLibre.map.getZoom() < Conf.map.detailZoom) {
            mapLibre.flyTo(poi.lnglat, Conf.map.detailZoom);
        }

        cMapMaker.viewDetail(props.id)
            .then(() => {
                geoCont.flashPolygon(geojson);
                geoCont.writePoiCircle(geojson);
            })
            .catch((e) => {
                console.warn("poiCont.#selectMarker: viewDetail failed or cancelled", e);
            });
    }

    // GeoJSON source と MapLibre layer を同期
    #syncMarkerLayers(markerGeojson) {
        if (!Conf.indoor?.use) {
            this.#syncMarkerSource("marker-shadow", markerGeojson.shadow);
            this.#addMarkerShadowLayer();
        }

        const markerColors = Conf.icon.markerColors;

        this.#getMarkerTypes().forEach(marker => {
            const sourceId = "marker-" + marker;
            this.#syncMarkerSource(sourceId, markerGeojson[marker]);

            this.#addMarkerBackgroundLayer(marker, markerColors[marker]);
            this.#addMarkerForegroundLayer(marker);
            this.#addMarkerTextLayer(marker);
            this.#addMarkerFlagLayer(marker);
        });
    }

    #syncMarkerSource(sourceId, geojson) {
        const source = mapLibre.map.getSource(sourceId);
        if (source !== undefined) {
            source.setData(geojson);
        } else {
            mapLibre.map.addSource(sourceId, {
                type: "geojson",
                data: geojson,
                promoteId: "id"
            });
        }
    }

    #addMarkerShadowLayer() {
        if (mapLibre.map.getLayer("marker-shadow")) return;

        mapLibre.map.addLayer({
            id: "marker-shadow",
            type: "symbol",
            source: "marker-shadow",
            layout: {
                "symbol-placement": "point",
                "symbol-sort-key": 0,
                "icon-offset": [0, 32],
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
                "icon-image": [
                    "case",
                    ["all", ["has", "level"], [">=", ["to-number", ["get", "level"]], 1]],
                    "circle_shadow.png",
                    ""
                ],
                "icon-size": this.#iconZoomStep("shadow", 0.9, 1.0, 1.1)
            }
        });
    }

    #addMarkerBackgroundLayer(marker, color) {
        const layerId = "marker-bg-" + marker;
        if (mapLibre.map.getLayer(layerId)) return;

        mapLibre.map.addLayer({
            id: layerId,
            type: "circle",
            source: "marker-" + marker,
            filter: ["==", ["geometry-type"], "Point"],
            paint: {
                "circle-radius": this.#circleRadiusZoomStep(marker),
                "circle-color": color.fill,
                "circle-opacity": 1,
                "circle-stroke-color": [
                    "case",
                    ["boolean", ["feature-state", "hover"], false],
                    Conf.icon.markerColors.hover.stroke,
                    color.stroke
                ],
                "circle-stroke-width": 2,
                "circle-stroke-opacity": 1
            }
        });

        mapLibre.map.on("mousemove", layerId, e => {
            mapLibre.map.getCanvas().style.cursor = "pointer";
            this.#setMarkerHover(marker, e.features?.[0]?.id);
        });
        mapLibre.map.on("mouseleave", layerId, () => {
            mapLibre.map.getCanvas().style.cursor = "";
            this.#clearMarkerHover();
        });
    }

    #setMarkerHover(marker, featureId) {
        if (featureId === undefined || featureId === null) return;
        if (this.#hoveredMarker?.marker === marker && this.#hoveredMarker?.id === featureId) return;

        this.#clearMarkerHover();
        mapLibre.map.setFeatureState(
            { source: "marker-" + marker, id: featureId },
            { hover: true }
        );
        this.#hoveredMarker = { marker, id: featureId };
    }

    #clearMarkerHover() {
        if (!this.#hoveredMarker) return;
        const { marker, id } = this.#hoveredMarker;
        this.#hoveredMarker = null;
        try {
            mapLibre.map.setFeatureState(
                { source: "marker-" + marker, id },
                { hover: false }
            );
        } catch (error) {
            console.debug("PoiCont: marker hover state could not be cleared.", error);
        }
    }

    #addMarkerForegroundLayer(marker) {
        const layerId = "marker-fg-" + marker;
        if (mapLibre.map.getLayer(layerId)) return;

        mapLibre.map.addLayer({
            id: layerId,
            type: "symbol",
            source: "marker-" + marker,
            layout: {
                "symbol-placement": "point",
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
                "icon-image": this.#layerMatch,
                "icon-size": this.#iconZoomStep(marker, 0.5, 0.6, 0.7)
            }
        });

        mapLibre.map.on("click", layerId, e => { this.#selectMarker(e); });
    }

    #addMarkerTextLayer(marker) {
        const layerId = "marker-text-" + marker;
        if (mapLibre.map.getLayer(layerId)) return;

        mapLibre.map.addLayer({
            id: layerId,
            type: "symbol",
            source: "marker-" + marker,
            layout: {
                "text-variable-anchor": ["top", "left"],
                "text-radial-offset": 2,
                "text-justify": "auto",
                "text-padding": 1,
                "text-field": ["step", ["zoom"], "", Conf.icon.textViewZoom, ["get", "cmapmaker_name"]],
                "text-font": Conf.icon.textFont,
                "text-size": [
                    "step", ["zoom"], Conf.icon.textSize,
                    14, Conf.icon.textSize * 0.9,
                    15, Conf.icon.textSize * 1.0,
                    16, Conf.icon.textSize * 1.1,
                    17, Conf.icon.textSize * 1.2,
                    18, Conf.icon.textSize * 1.3,
                    19, Conf.icon.textSize * 1.4
                ],
                "text-anchor": "left",
                "text-offset": [0, 0],
                "symbol-placement": "point",
                "symbol-sort-key": 1,
                "text-line-height": 1.2
            },
            paint: {
                "text-color": "#000000",
                "text-halo-color": "#ffffff",
                "text-halo-width": 2
            }
        });
    }

    #addMarkerFlagLayer(marker) {
        const layerId = "marker-flag-" + marker;
        if (mapLibre.map.getLayer(layerId)) return;

        mapLibre.map.addLayer({
            id: layerId,
            type: "symbol",
            source: "marker-" + marker,
            minzoom: 17,
            filter: ["all", ["has", "country"], ["!=", ["get", "country"], ""]],
            layout: {
                "icon-anchor": "top-left",
                "symbol-placement": "point",
                "symbol-sort-key": 0,
                "icon-offset": [-80, -50],
                "icon-allow-overlap": true,
                "icon-ignore-placement": true,
                "icon-image": ["concat", "flag-", ["get", "country"]],
                "icon-size": Conf.icon.flag
            }
        });
    }

    #iconZoomStep(iconName, zoom15Scale, zoom16Scale, zoom17Scale) {
        return [
            "step", ["zoom"], Conf.icon[iconName] * zoom15Scale,
            16, Conf.icon[iconName] * zoom16Scale,
            17, Conf.icon[iconName] * zoom17Scale
        ];
    }

    #circleRadiusZoomStep(marker) {
        return [
            "step", ["zoom"], Conf.icon[marker] * 0.5 * 48,
            16, Conf.icon[marker] * 0.6 * 48,
            17, Conf.icon[marker] * 0.7 * 48
        ];
    }

    // setPoi / makeList 共通: target が現在ズームレベルで表示対象か判定
    #isTargetInPoiViewZoom(targets, zoomlv = mapLibre.getZoom(true)) {
        const targetArr = Array.isArray(targets) ? targets : [targets];
        const visibleTargets = targetArr.filter(t => poiCont.getTargets().includes(t));

        return visibleTargets.some(t =>
            zoomlv >= cMapMaker.getPoiZoom(t) ||
            zoomlv >= Conf.poiView.editZoom?.[t]
        );
    }

    select(poiid, detail, zoomOffset = 0) {
        return new Promise((resolve, reject) => {
            const zoomlv = Math.max(mapLibre.getZoom(true), Conf.map.detailZoom) + zoomOffset;

            let poi = poiCont.get_osmid(poiid);
            let loadOsmid = poiid;

            if (poi === undefined) {
                const act = poiCont.get_actid(poiid);
                if (act !== undefined) {
                    loadOsmid = act.osmid;
                    poi = poiCont.get_osmid(act.osmid);
                }
            }

            if (poi !== undefined) {
                geoCont.flashPolygon(poi.geojson);

                if (detail) {
                    cMapMaker.viewDetail(poi.geojson.id)
                        .then(() => {
                            mapLibre.flyTo(poi.lnglat, zoomlv);
                            geoCont.flashPolygon(poi.geojson);
                            geoCont.writePoiCircle(poi.geojson);
                            resolve();
                        })
                        .catch((e) => {
                            console.warn("poiCont.select: viewDetail failed", e);
                            reject(e);
                        });
                } else {
                    mapLibre.flyTo(poi.lnglat, zoomlv);
                    resolve();
                }

                return;
            }

            // POI未ロードの場合
            if (!loadOsmid) {
                reject(new Error("poiCont.select: osmid is empty"));
                return;
            }

            winCont.spinner(true);

            overPassCont.getOsmIds([loadOsmid])
                .then((geojson) => {
                    poiCont.addGeojson(geojson);

                    const loadedPoi = poiCont.get_osmid(loadOsmid);
                    if (!loadedPoi) {
                        throw new Error("poiCont.select: loaded POI not found: " + loadOsmid);
                    }

                    mapLibre.flyTo(loadedPoi.lnglat, zoomlv);
                    geoCont.flashPolygon(loadedPoi.geojson);

                    if (detail) {
                        return cMapMaker.viewDetail(loadOsmid).then(() => loadedPoi);
                    }

                    return loadedPoi;
                })
                .then((loadedPoi) => {
                    if (detail) {
                        geoCont.writePoiCircle(loadedPoi.geojson);
                    }
                    winCont.spinner(false);
                    resolve();
                })
                .catch((e) => {
                    console.warn("poiCont.select: failed", e);
                    winCont.spinner(false);
                    reject(e);
                });
        });
    }
}
