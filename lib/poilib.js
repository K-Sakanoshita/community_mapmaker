"use strict"

// PoiData Control
class PoiCont {

    #layerMatch = {};
    #markerClickEvents = new WeakSet();
    #hoveredMarker = null;
    #markerSourceData = new WeakMap();
    #activityIndexSource = null;
    #activityIndexLength = -1;
    #activityById = new Map();
    #activitiesByOsmid = new Map();
    #stringActivityIds = true;
    #stringActivityOsmids = true;
    #staticPois = new Map();
    #missingStaticLogged = new Set();

    isStaticView() {
        return Conf.static?.use === true && !Conf.etc?.editMode;
    }

    logMissingStatic(osmid) {
        if (!osmid || this.#missingStaticLogged.has(osmid)) return;
        this.#missingStaticLogged.add(osmid);
        console.log("PoiCont: not displayed because the feature is absent from static data:", osmid);
    }

    isAvailableInMode(osmid) {
        return !this.isStaticView() || this.#staticPois.has(osmid);
    }

    constructor() {
        this.pdata = { geojson: [], targets: [] }		//poi data variable
        this.adata = []									//act data variable /  poi's lnglat & geoidx
        this.cat_cache = {}
        this.lnglats = {}
        this.geoidx = {}
        this.parent = []		// (Poiのみ)親ポリゴンを示す
        this.polygons = []		// Polygon内に含まれるか調べるためのポリゴン一覧
        this.tiles = {}			// polygonsと同じキーのタイル番号を記録
        this.polygonTileIndex = new Map() // タイル別の親ポリゴン候補
        this.countries = []     // 国のポリゴンと名称データ
        this.revision = 0       // POI/Activityデータが変化した回数
    }

    // 建物の形状より施設の用途を優先し、building は最後の候補にする。
    #prioritizeTagKeys(keys) {
        return [...keys.filter(key => key !== "building"), ...keys.filter(key => key === "building")];
    }

    init(useCountries) {
        const generateIconImageExpression = (markerJson) => {
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
            for (const key of this.#prioritizeTagKeys(Object.keys(tagIconMap))) {
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

    deleteAll() {
        this.#staticPois.clear();
        this.#missingStaticLogged.clear();
        poiCont.pdata = { geojson: [], targets: [] };
        poiCont.cat_cache = {};
        poiCont.lnglats = {};
        poiCont.geoidx = {};
        poiCont.parent = [];
        poiCont.polygons = [];
        poiCont.tiles = {};
        poiCont.polygonTileIndex = new Map();
        poiCont.revision++;
    }

    pois() { return { pois: poiCont.pdata, acts: poiCont.adata, lnglats: poiCont.lnglats } };

    getTargets() {      // Conf.view.poiZoomのtargetを返す(edit時はpoiEditも合成)
        let targets = Object.keys(Conf.poiView.poiZoom)
        targets = Conf.etc.editMode ? targets.concat(Object.keys(Conf.poiView.editZoom)) : targets	// 編集時はeditZoom追加
        return [...new Set(targets)];
    }

    setActdata(json) {
        poiCont.adata = json;
        poiCont.#activityIndexSource = null;
        poiCont.revision++;
    };		// set GoogleSpreadSheetから帰ってきたJson

    #ensureActivityIndexes() {
        const activities = this.adata;
        if (this.#activityIndexSource === activities && this.#activityIndexLength === activities.length) return;
        this.#activityById = new Map();
        this.#activitiesByOsmid = new Map();
        this.#stringActivityIds = true;
        this.#stringActivityOsmids = true;
        for (const activity of activities) {
            this.#stringActivityIds &&= typeof activity.id === "string";
            this.#stringActivityOsmids &&= typeof activity.osmid === "string";
            // Preserve the first matching ID and the original order of posts.
            if (!this.#activityById.has(activity.id)) this.#activityById.set(activity.id, activity);
            if (!this.#activitiesByOsmid.has(activity.osmid)) this.#activitiesByOsmid.set(activity.osmid, []);
            this.#activitiesByOsmid.get(activity.osmid).push(activity);
        }
        this.#activityIndexSource = activities;
        this.#activityIndexLength = activities.length;
    }

    setActlnglat() {								// set Act LngLat by OSMID
        poiCont.adata.forEach((act) => {
            let osmdata = poiCont.get_osmid(act.osmid)
            if (osmdata !== undefined) { act.lnglat = osmdata.lnglat }
        })
    }

    getPoiDataLimit() {
        const configuredMax = Number(Conf.poiData?.maxFeatures);
        const maxFeatures = Number.isFinite(configuredMax) && configuredMax > 0
            ? Math.floor(configuredMax) : 12000;
        const configuredThreshold = Number(Conf.poiData?.pruneThreshold);
        const pruneThreshold = Number.isFinite(configuredThreshold) && configuredThreshold > maxFeatures
            ? Math.floor(configuredThreshold) : Math.ceil(maxFeatures * 1.25);
        return { maxFeatures, pruneThreshold };
    }

    getPinnedPoiIds() {
        const ids = new Set();
        poiCont.adata.forEach(activity => {
            if (activity?.osmid != null && activity.osmid !== "") ids.add(String(activity.osmid));
        });
        if (typeof cMapMaker !== "undefined" && cMapMaker.openOSMid) {
            ids.add(String(cMapMaker.openOSMid));
        }
        return ids;
    }

    getDistanceScore(lnglat, center) {
        const lng = Number(lnglat?.[0]);
        const lat = Number(lnglat?.[1]);
        if (!Number.isFinite(lng) || !Number.isFinite(lat)) return Number.POSITIVE_INFINITY;
        let deltaLng = lng - center.lng;
        if (deltaLng > 180) deltaLng -= 360;
        if (deltaLng < -180) deltaLng += 360;
        const scaledLng = deltaLng * Math.cos(center.lat * Math.PI / 180);
        const deltaLat = lat - center.lat;
        // 順位だけが必要なので平方根やturf.distanceは使わない。
        return scaledLng * scaledLng + deltaLat * deltaLat;
    }

    quickSelectByDistance(items, targetIndex) {
        if (targetIndex < 0 || targetIndex >= items.length) return;
        let left = 0;
        let right = items.length - 1;
        while (left < right) {
            const pivot = items[(left + right) >> 1].score;
            let lower = left;
            let upper = right;
            while (lower <= upper) {
                while (items[lower].score < pivot) lower++;
                while (items[upper].score > pivot) upper--;
                if (lower <= upper) {
                    [items[lower], items[upper]] = [items[upper], items[lower]];
                    lower++;
                    upper--;
                }
            }
            if (targetIndex <= upper) right = upper;
            else if (targetIndex >= lower) left = lower;
            else return;
        }
    }

    getPolygonTileKey(tile) {
        return tile ? `${tile.tileX}.${tile.tileY}` : "";
    }

    addPolygonToTileIndex(osmid) {
        const key = this.getPolygonTileKey(this.tiles[osmid]);
        if (!key) return;
        if (!this.polygonTileIndex.has(key)) this.polygonTileIndex.set(key, new Set());
        this.polygonTileIndex.get(key).add(String(osmid));
    }

    rebuildPolygonTileIndex() {
        this.polygonTileIndex = new Map();
        Object.keys(this.polygons).forEach(osmid => this.addPolygonToTileIndex(osmid));
    }

    getNearbyPolygonIds(tile) {
        if (!tile) return [];
        const result = [];
        for (let deltaY = -2; deltaY <= 2; deltaY++) {
            for (let deltaX = -2; deltaX <= 2; deltaX++) {
                if (Math.abs(deltaX) + Math.abs(deltaY) > 2) continue;
                const ids = this.polygonTileIndex.get(`${tile.tileX + deltaX}.${tile.tileY + deltaY}`);
                if (ids) result.push(...ids);
            }
        }
        return result;
    }

    pruneDistantData(center = mapLibre?.getCenter?.()) {
        if (Conf.static?.use && Conf.poiData?.applyToStatic !== true) return { removed: 0 };
        const { maxFeatures, pruneThreshold } = this.getPoiDataLimit();
        const count = this.pdata.geojson.length;
        if (count <= pruneThreshold || !center
            || !Number.isFinite(center.lng) || !Number.isFinite(center.lat)) return { removed: 0 };

        const pinnedIds = this.getPinnedPoiIds();
        let pinnedIndexes = [];
        const candidates = [];
        this.pdata.geojson.forEach((feature, index) => {
            const id = feature?.id ?? feature?.properties?.id;
            if (id != null && pinnedIds.has(String(id))) {
                pinnedIndexes.push(index);
                return;
            }
            candidates.push({ index, score: this.getDistanceScore(this.lnglats[id], center) });
        });

        // Activityが上限を超える場合もmaxFeaturesを守る。開いている詳細を最優先し、
        // 残りの保護対象は現在地に近いものから保持する。
        if (pinnedIndexes.length > maxFeatures) {
            const openId = typeof cMapMaker !== "undefined" && cMapMaker.openOSMid
                ? String(cMapMaker.openOSMid) : null;
            const openIndexes = openId == null ? [] : pinnedIndexes.filter(index => {
                const feature = this.pdata.geojson[index];
                return String(feature?.id ?? feature?.properties?.id) === openId;
            });
            const remainingPinned = pinnedIndexes
                .filter(index => !openIndexes.includes(index))
                .map(index => {
                    const feature = this.pdata.geojson[index];
                    const id = feature?.id ?? feature?.properties?.id;
                    return { index, score: this.getDistanceScore(this.lnglats[id], center) };
                });
            const remainingLimit = Math.max(0, maxFeatures - openIndexes.length);
            if (remainingPinned.length > remainingLimit && remainingLimit > 0) {
                this.quickSelectByDistance(remainingPinned, remainingLimit - 1);
            }
            pinnedIndexes = openIndexes.concat(
                remainingPinned.slice(0, Math.min(remainingLimit, remainingPinned.length))
                    .map(item => item.index)
            );
        }

        const candidateLimit = Math.max(0, maxFeatures - pinnedIndexes.length);
        if (candidates.length > candidateLimit && candidateLimit > 0) {
            this.quickSelectByDistance(candidates, candidateLimit - 1);
        }
        const keepIndexes = new Set(pinnedIndexes);
        for (let index = 0; index < Math.min(candidateLimit, candidates.length); index++) {
            keepIndexes.add(candidates[index].index);
        }

        const retainedIds = new Set();
        keepIndexes.forEach(index => {
            const feature = this.pdata.geojson[index];
            const id = feature?.id ?? feature?.properties?.id;
            if (id != null) retainedIds.add(String(id));
        });

        const geojson = [];
        const targets = [];
        const geoidx = {};
        const lnglats = {};
        const tiles = {};
        const polygons = [];
        const parent = [];
        const catCache = {};

        for (let oldIndex = 0; oldIndex < this.pdata.geojson.length; oldIndex++) {
            if (!keepIndexes.has(oldIndex)) continue;
            const feature = this.pdata.geojson[oldIndex];
            const id = feature?.id ?? feature?.properties?.id;
            if (id == null) continue;
            const key = String(id);
            geoidx[key] = geojson.length;
            geojson.push(feature);
            targets.push(this.pdata.targets[oldIndex] ?? []);
            if (this.lnglats[key] !== undefined) lnglats[key] = this.lnglats[key];
            if (this.tiles[key] !== undefined) tiles[key] = this.tiles[key];
            if (this.polygons[key] !== undefined) polygons[key] = this.polygons[key];
            if (this.cat_cache[key] !== undefined) catCache[key] = this.cat_cache[key];
            const parentFeature = this.parent[key];
            const parentId = parentFeature?.id ?? parentFeature?.properties?.id;
            if (parentId != null && retainedIds.has(String(parentId))) parent[key] = parentFeature;
        }

        this.pdata = { geojson, targets };
        this.geoidx = geoidx;
        this.lnglats = lnglats;
        this.tiles = tiles;
        this.polygons = polygons;
        this.parent = parent;
        this.cat_cache = catCache;
        this.rebuildPolygonTileIndex();
        if (typeof overPassCont !== "undefined") overPassCont.pruneCacheToIds?.(retainedIds);

        const removed = count - geojson.length;
        console.log(`PoiCont: pdata pruned ${count} -> ${geojson.length} (removed ${removed}).`);
        return { removed, retained: geojson.length };
    }

    addGeojson(pois, { source } = {}) {								// add geojson pois / pois: {geojson: [],targets: []}
        if (!Array.isArray(pois?.geojson) || pois.geojson.length === 0) return;
        poiCont.revision++;
        const children = new Set();

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
            if (source === "static") {
                const previous = this.#staticPois.get(node.id);
                this.#staticPois.set(node.id, {
                    geojson: node,
                    targets: [...new Set([...(previous?.targets ?? []), ...(poi.targets ?? [])])]
                });
            }
            const cidx = setGeojson(poi)
            poiCont.geoidx[node.id] = cidx
            if (poiCont.lnglats[node.id] == undefined) {	    // 初期登録時
                let ll = geoCont.flat2single(node.geometry.coordinates, node.geometry.type)
                poiCont.lnglats[node.id] = [ll[0], ll[1]]
                poiCont.tiles[node.id] = geoCont.ll2tile({ lng: ll[0], lat: ll[1] }, 14)	// タイル番号を保存
                // 表示専用のindoorデータは親ポリゴン検索へ流さない。
                // 全件同士の包含判定になるため、建物が多い市街地では大きな待ち時間になる。
                if (poiCont.isPoiListVisible(poi.targets) || poiCont.isAreaFeatureLinkTarget(poi.targets)) {
                    if (["Polygon", "MultiPolygon"].includes(node.geometry.type)) {
                        poiCont.polygons[node.id] = node;
                        poiCont.addPolygonToTileIndex(node.id);
                    }
                    children.add(String(node.id));								// Polygonもchildrenに追加
                }
            }
        })

        // 追加単位ごとに判定し、しきい値を超えた時だけまとめて整理する。
        poiCont.pruneDistantData();

        let pt1 = { "type": "Feature", "properties": {}, "geometry": { "type": "Point", "coordinates": [0, 0] } }
        for (const child of children) { // childrenがポリゴンに含まれているか確認
            if (poiCont.geoidx[child] === undefined) continue;
            pt1.geometry.coordinates[1] = poiCont.lnglats[child][1]
            pt1.geometry.coordinates[0] = poiCont.lnglats[child][0]
            if (!isNaN(pt1.geometry.coordinates[0])) {
                const childTile = poiCont.tiles[child];
                for (const polygonId of poiCont.getNearbyPolygonIds(childTile)) {
                    const polygon = poiCont.polygons[polygonId];
                    if (polygon && child !== String(polygon.id)) {
                        if (turf.booleanPointInPolygon(pt1, polygon)) { // ポリゴン内に存在すれば親を設定する
                            //console.log("addGeojson: " + child + " in " + polygon.id)
                            poiCont.parent[child] = polygon
                        }
                    }
                }
            }
        }
        console.log("PoiCont: addGeojson: " + children.size + " Counts.")
    }

    get_parent(osmid) { return poiCont.parent[osmid]; };		// osmidを元に親geojson全体を返す

    get_osmid(osmid) {           								// osmidを元にgeojsonと緯度経度、targetを返す
        if (this.isStaticView()) {
            const stored = this.#staticPois.get(osmid);
            return stored ? { ...stored, lnglat: geoCont.flat2single(
                stored.geojson.geometry.coordinates, stored.geojson.geometry.type) } : undefined;
        }
        let idx = poiCont.geoidx[osmid];
        return idx == undefined ? undefined : {
            geojson: poiCont.pdata.geojson[idx], lnglat: poiCont.lnglats[osmid], targets: poiCont.pdata.targets[idx]
        }
    }

    get_actid(actid) {
        this.#ensureActivityIndexes();
        // Legacy numeric/missing IDs retain the previous loose-equality behavior.
        return typeof actid === "string" && this.#stringActivityIds
            ? this.#activityById.get(actid)
            : this.adata.find(line => actid == line.id);
    }

    // id(osm,act両対応)を元に緯度経度を返す
    getLnglatbyId(id) {
        const act = this.get_actid(id);
        let osm = poiCont.get_osmid(act ? act.osmid : id);
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

    getActlistByOsmid(osmid) {
        this.#ensureActivityIndexes();
        return typeof osmid === "string" && this.#stringActivityOsmids
            ? [...(this.#activitiesByOsmid.get(osmid) ?? [])]
            : this.adata.filter(a => a.osmid == osmid);
    };	// get activities by osmid

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

        const mainkeys = this.#prioritizeTagKeys(Conf.category_keys).filter(key => key !== "*" && t[key] !== undefined);

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

        geojson.forEach((loadedFeature, idx) => {
            const stored = this.isStaticView() ? this.#staticPois.get(loadedFeature.id) : null;
            if (this.isStaticView() && !stored) return;
            const feat = stored?.geojson ?? loadedFeature;
            const tgts = stored?.targets ?? tgtArr[idx] ?? [];
            const hit = allowAll || tgts.some(t => wantSet.has(String(t)));            // allowAll なら無条件で通す
            if (hit) {
                res.geojson.push(feat);
                res.lnglat.push(stored ? geoCont.flat2single(feat.geometry.coordinates, feat.geometry.type)
                    : poiCont?.lnglats?.[feat.id]);
                res.targets.push(tgts.slice()); // 参照切り
            }
        });
        return res;
    }

    isPoiViewVisible(targets) {
        const activeTargets = new Set(this.getTargets());
        return (targets ?? []).some(target => {
            if (!activeTargets.has(target)) return false;
            const expression = Conf.osm?.[target]?.expression;
            return expression?.poiView !== false;
        });
    }

    isPoiListVisible(targets) {
        const activeTargets = new Set(this.getTargets());
        return (targets ?? []).some(target => {
            if (!activeTargets.has(target)) return false;
            const expression = Conf.osm?.[target]?.expression;
            return expression?.poiView !== false && expression?.listView !== false;
        });
    }

    isAreaFeatureLinkTarget(targets) {
        if (Conf.areaFeatureLinker?.use === false) return false;
        const asArray = value => Array.isArray(value) ? value : (value == null || value === "" ? [] : [value]);
        const areaTargets = new Set(asArray(Conf.areaFeatureLinker?.areaTargets).map(String));
        if (!areaTargets.size) return false;
        const targetList = (targets ?? []).map(String);
        if (targetList.some(target => areaTargets.has(target))) return true;
        const featureTargets = new Set(asArray(Conf.areaFeatureLinker?.featureTargets).map(String));
        return !featureTargets.size || targetList.some(target => featureTargets.has(target));
    }

    // ListTable向きの配列を出力 / リストの最後に カテゴリ名の元タグ と targets を追加
    makeList(targets, noInner, { searchAll = false } = {}) {
        const zoomlv = mapLibre.getZoom(true);
        let LL = mapLibre.get_LL();
        let pois = poiCont.getPois(targets, false); // poiViewがfalseなものはリストに入れない
        let datas = [], listed = {};                // targetsに指定されたpoiのみフィルター

        // activityを元にリスト作成
        if (targets.indexOf(Conf.activity.targetName) > -1 || targets.indexOf("-") > -1) {				    // targetsにActivity名があればリストに追加
            poiCont.adata.forEach((line) => {
                if (line !== undefined) {
                    let data = [], poi = poiCont.get_osmid(line.osmid);
                    if (poi !== undefined) {
                        if (!searchAll && !cMapMaker.isPoiVisibleInLevelMode(poi)) return;
                        const actTargets = [Conf.activity.targetName, ...poi.targets];
                        const inZoom = searchAll || this.#isTargetInPoiViewZoom(actTargets, zoomlv);
                        let allActs = searchAll || Conf.listTable.allActs ? true : geoCont.checkInner(poi.lnglat, LL); // 画面内でフィルタ
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
                        if (this.isStaticView()) this.logMissingStatic(line.osmid);
                    };
                };
            });
        };

        // target(tag)を元にリスト追加
        for (const [idx, node] of pois.geojson.entries()) {
            if (!searchAll && !cMapMaker.isPoiVisibleInLevelMode({ geojson: node })) continue;
            const listTargets = pois.targets[idx] ?? [];
            const listVisible = this.isPoiListVisible(listTargets);
            if (!listVisible) continue;
            let tags = node.properties, data = []
            let names = poiCont.getCatnames(tags)
            const inZoom = searchAll || this.#isTargetInPoiViewZoom(pois.targets[idx], zoomlv);
            const editingActivityList = Conf.etc?.editMode && Conf.listTable.target === "activity";
            const inView = searchAll || (noInner && !editingActivityList)
                ? true : geoCont.checkFeatureInner(node, pois.lnglat[idx], LL);
            if (inZoom && inView && listed[tags.id] !== true) {
                listed[tags.id] = true
                const fields = Conf.listTable.category === "activity"
                    ? Conf.list.columns.actFields : Conf.list.columns.poiFields;
                fields.forEach(field => {
                    const key = field === "#category" || field.startsWith("#parent") ? field : field.replace(/^#/, "");
                    if (key == "#category") {										// #は内部データを利用する意味
                        let vName = names[1] !== "" ? `${names[0]}(${names[1]})` : names[0]
                        data.push(vName);										// category追加
                    } else if (key.indexOf("#parent") > -1) {						// 親データを使う意味
                        let keys = key.substring(key.indexOf(".") + 1).split(",")	// キー取得(複数の可能性あり)
                        let pGeo = poiCont.get_parent(tags.id)
                        const parentTags = pGeo?.properties;
                        const parentValue = keys[0] == "name"
                            ? poiCont.getOSMname(parentTags, glot.lang)
                            : parentTags?.[keys[0]];
                        const poiValue = keys[1] == "name"
                            ? poiCont.getOSMname(tags, glot.lang)
                            : tags[keys[1]];
                        const ptag = parentValue || poiValue;
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
        const mainkeys = this.#prioritizeTagKeys(Conf.category_keys).filter(key => key !== "*" && t[key] !== undefined);
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
        this.#stampIds = new Set(Conf.stampMarkers?.use === true
            ? (Array.isArray(Conf.stampMarkers.osmIds) ? Conf.stampMarkers.osmIds : [])
                .map(id => this.#normalizeStampId(id)).filter(Boolean) : []);
        const legend = typeof document === "undefined" ? null : document.getElementById("stampMarkerLegend");
        if (legend) {
            legend.hidden = this.#stampIds.size === 0;
            legend.style.color = this.#stampColor();
        }
        const markerGeojson = this.#createEmptyMarkerGeojson();
        const markerParams = flist !== undefined
            ? this.#collectMarkerParamsFromList(flist, actonly)
            : this.#collectMarkerParamsFromCurrentView(actonly);

        feature3d.sync(markerParams.map(params => params.poi));
        markerParams.forEach(params => {
            if (!feature3d.hasModel(params.poi.geojson.id)) this.#addMarkerFeature(markerGeojson, params);
            const tags = this.#getPoiTags(params.poi);
            if (poiStatusCont.getValueByOSMID(tags.id)[PoiStatusIndex.FAVORITE]) {
                markerGeojson.favorite.features.push(this.#clonePoiAsPoint(params.poi, tags));
            }
        });
        this.#syncMarkerLayers(markerGeojson);
        this.#syncPhotoMarkers(markerParams);
    }

    #stampIds = new Set();

    #normalizeStampId(value) {
        const match = /^(node|way|relation)\/([1-9]\d*)$/.exec(String(value ?? "").trim());
        return match ? `${match[1]}/${match[2]}` : "";
    }

    #isStampPoi(poi) {
        // Match the full typed ID, never a numeric suffix or an activity ID.
        return this.#stampIds.has(this.#normalizeStampId(poi.geojson.id));
    }

    #stampColor() {
        const color = Conf.stampMarkers?.ringColor;
        return /^#[0-9a-f]{6}$/i.test(color ?? "") ? color : "#D65C8C";
    }

    #stampImage() {
        const color = this.#stampColor();
        const id = `stamp-badge-${color.slice(1).toLowerCase()}`;
        if (!mapLibre.map.hasImage(id)) {
            // Small rasterized rubber stamp: white handle/base on a pink disc.
            // Generate locally so it needs neither a font glyph nor a network request.
            const size = 32, data = new Uint8Array(size * size * 4);
            const rgb = [1, 3, 5].map(offset => parseInt(color.slice(offset, offset + 2), 16));
            for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
                const distance = Math.hypot(x - 15.5, y - 15.5);
                if (distance > 15.5) continue;
                const white = distance > 13.5
                    || (x >= 12 && x <= 19 && y >= 6 && y <= 12)
                    || (x >= 14 && x <= 17 && y >= 12 && y <= 18)
                    || (x >= 8 && x <= 23 && y >= 18 && y <= 22)
                    || (x >= 7 && x <= 24 && y >= 24 && y <= 25);
                data.set([...(white ? [255, 255, 255] : rgb), 255], (y * size + x) * 4);
            }
            mapLibre.map.addImage(id, { width: size, height: size, data });
        }
        return id;
    }

    #syncPhotoMarkers(markerParams) {
        const settings = Conf.icon?.photoMarkers;
        if (typeof PhotoMarkerController === "undefined") return;
        if (settings?.use !== true) {
            this.photoMarkers?.sync([], { use: false });
            return;
        }
        if (!this.photoMarkers || this.photoMarkers.map !== mapLibre.map) {
            this.photoMarkers?.destroy();
            this.photoMarkers = new PhotoMarkerController(mapLibre.map, {
                onSelect: (id, event) => this.#selectMarker({ ...event, features: [{ properties: { id } }] }),
                resolveCommons: async file => {
                    const wiki = await getWikimedia();
                    const data = await wiki.fetchJsonWithCache(wiki.makeImageInfoApiUrl(file, 96));
                    const info = wiki.extractImageInfo(data, file);
                    return info ? PhotoMarkerController.imageReference(wiki.selectImageUrl(info, 96)) : "";
                }
            });
        }
        const zoom = mapLibre.getZoom(false);
        const steps = Conf.icon.zoomSteps?.marker ?? {
            baseScale: 0.5, steps: [{ zoom: 16, scale: 0.6 }, { zoom: 17, scale: 0.7 }]
        };
        const scale = steps.steps.reduce((value, step) => zoom >= step.zoom ? step.scale : value, steps.baseScale);
        const candidates = [];
        for (const params of markerParams) {
            if (feature3d.hasModel(params.poi.geojson.id)) continue;
            const tags = this.#getPoiTags(params.poi);
            const image = PhotoMarkerController.firstImage(params.actlists, tags, Conf.activities, settings);
            if (!image) continue;
            const status = poiStatusCont.getValueByOSMID(tags.id ?? params.poi.geojson.id);
            const type = this.#getMarkerType(tags, params.actlists, status);
            candidates.push({
                id: params.poi.geojson.id, image, lnglat: params.poi.lnglat,
                thumbnail: typeof ActivityThumbnails === "undefined" ? image
                    : ActivityThumbnails.forSource(params.actlists, image),
                upperFloor: !Conf.indoor?.use && tags.level !== undefined
                    && cMapMaker.parseIndoorLevels(tags.level).some(level => Number(level) > 0),
                name: poiCont.getOSMname(tags, glot.lang),
                size: Number(settings.size) || Conf.icon[type] * 96 * scale + 4,
                favorite: Boolean(status[PoiStatusIndex.FAVORITE]),
                stamp: this.#isStampPoi(params.poi),
                stampColor: this.#stampColor(),
                stampLabel: "スタンプ設置場所",
                color: Conf.icon.markerColors[type]?.stroke
            });
        }
        this.photoMarkers.sync(candidates, settings);
    }

    // マーカー用の空GeoJSONを作成
    #createEmptyMarkerGeojson() {
        return {
            shadow: { type: "FeatureCollection", features: [] },    // 影
            favorite: { type: "FeatureCollection", features: [] },  // お気に入りの小さなハート
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

        if (!cMapMaker.isPoiVisibleInLevelMode(poi)) return null;
        if (!geoCont.checkInner(poi.lnglat, LL)) return null;

        const actlists = poiCont.getActlistByOsmid(poi.geojson.id);
        const viewflag = actonly ? (actlists.length > 0) : true;
        if (!viewflag) return null;

        const targets = actlists.length > 0
            ? [Conf.activity.targetName, ...poi.targets]
            : poi.targets;

        const visibleTargets = targets.filter(target => {
            if (!poiCont.getTargets().includes(target)) return false;
            if (target === Conf.activity.targetName) return true;
            return Conf.osm?.[target]?.expression?.poiView !== false;
        });
        if (visibleTargets.length === 0) return null;
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
            // Imported IDs can retain a prefix different from the form/app key.
            const act = poiCont.get_actid(listId);
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
        const usedOsmids = new Set();

        poiCont.adata.forEach(act => {
            if (usedOsmids.has(act.osmid)) return;
            const osm = poiCont.get_osmid(act.osmid);
            if (!osm) return;
            usedOsmids.add(act.osmid);

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
        if (this.#isStampPoi(params.poi)) {
            poiGeojson.properties.cmapmaker_stamp = true;
            poiGeojson.properties.cmapmaker_stamp_color = this.#stampColor();
            poiGeojson.properties.cmapmaker_stamp_image = this.#stampImage();
        } else {
            delete poiGeojson.properties.cmapmaker_stamp;
            delete poiGeojson.properties.cmapmaker_stamp_color;
            delete poiGeojson.properties.cmapmaker_stamp_image;
        }
        markerGeojson[markerType].features.push(poiGeojson);

        if (tags.level !== undefined && cMapMaker.parseIndoorLevels(tags.level).some(level => Number(level) > 0)) {
            markerGeojson.shadow.features.push(poiGeojson);
        }
    }

    // マーカーに表示する名称を組み立てる
    #buildMarkerName(tags, actlists, poiStatus) {
        let name = poiCont.getOSMname(tags, glot.lang);

        if (!Conf.indoor?.use && tags.level !== undefined) {
            const levels = cMapMaker.parseIndoorLevels(tags.level);
            const groundOnly = levels.length > 0 && levels.every(level => Number(level) === 0);
            const floorLabel = cMapMaker.formatIndoorLevel(tags.level);
            if (!groundOnly && floorLabel !== "") name += `\n(${floorLabel})`;
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
            name = actlists[0][Conf.activity.actTitle];
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
        // Copy only the geometry used by the marker. Cloning a large polygon
        // before discarding all its vertices wastes memory on every redraw.
        const poiGeojson = {
            ...poi.geojson,
            properties: structuredClone(poi.geojson.properties),
            geometry: {
                type: "Point",
                coordinates: [...(poi.geojson.geometry.type === "Point"
                    ? poi.geojson.geometry.coordinates : poi.lnglat)]
            }
        };

        const osmid = tags.id ?? poi.geojson.id; // OSMID を確実にセット（promoteId 用）
        poiGeojson.properties.id = poiGeojson.properties.id ?? osmid;
        poiGeojson.id = poiGeojson.id ?? osmid;

        return poiGeojson;
    }

    // マーカークリック時の処理
    getMarkerSelectionIds(event, markerId) {
        const ids = [markerId];
        const point = event.point;
        const map = mapLibre.map;
        if (point && Number.isFinite(point.x) && Number.isFinite(point.y)) {
            const layers = this.#getMarkerTypes().flatMap(type => [`marker-bg-${type}`, `marker-fg-${type}`, `marker-stamp-${type}`])
                .filter(id => map.getLayer(id));
            if (layers.length && map.queryRenderedFeatures) {
                for (const feature of map.queryRenderedFeatures([point.x, point.y], { layers })) {
                    ids.push(feature.properties?.id ?? feature.id);
                }
            }
            ids.push(...(this.photoMarkers?.getIdsAtPoint(point) ?? []));
        }
        return [...new Set(ids.filter(id => id !== undefined && id !== null && String(id) !== "")
            .map(String))].filter(id => poiCont.get_osmid(id));
    }

    #selectMarker(e) {
        if (e.originalEvent && typeof e.originalEvent === "object") {
            if (this.#markerClickEvents.has(e.originalEvent)) return;
            this.#markerClickEvents.add(e.originalEvent);
        }
        const props = e.features[0].properties;
        const poi = poiCont.get_osmid(props.id);
        if (!poi) return;
        const ids = this.getMarkerSelectionIds(e, props.id);
        if (feature3d.handleMarkerClick(e, props.id, ids, mapLibre.map)) return;

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
        this.#getMarkerTypes().forEach(marker => {
            if (markerGeojson[marker].features.some(feature => feature.properties.cmapmaker_stamp)) {
                this.#addMarkerStampBadgeLayer(marker);
            }
        });
        if (markerGeojson.favorite.features.length || mapLibre.map.getSource("marker-favorite")) {
            this.#syncMarkerSource("marker-favorite", markerGeojson.favorite);
        }
        if (markerGeojson.favorite.features.length) this.#addMarkerFavoriteBadgeLayer();
        feature3d.placeBelowMarkerLayers();
    }

    #syncMarkerSource(sourceId, geojson) {
        const source = mapLibre.map.getSource(sourceId);
        const dataKey = JSON.stringify(geojson);
        if (source !== undefined) {
            if (this.#markerSourceData.get(source) === dataKey) return;
            source.setData(geojson);
        } else {
            mapLibre.map.addSource(sourceId, {
                type: "geojson",
                data: geojson,
                promoteId: "id"
            });
        }
        // Source identity changes when a background style is replaced, so a
        // new source always receives data even if the POIs are unchanged.
        const currentSource = mapLibre.map.getSource(sourceId);
        if (currentSource) this.#markerSourceData.set(currentSource, dataKey);
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
                // The source already contains only upper-floor facilities.
                // OSM tags may be nested, and level may contain several floors.
                "icon-image": "circle_shadow.png",
                "icon-size": this.#iconZoomStep("shadow", "shadow")
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
                "circle-stroke-color": ["case", ["==", ["get", "cmapmaker_stamp"], true],
                    ["get", "cmapmaker_stamp_color"],
                    Conf.icon.markerColors.hover?.enabled === false ? color.stroke : [
                    "case",
                    ["boolean", ["feature-state", "hover"], false],
                    Conf.icon.markerColors.hover.stroke,
                    color.stroke
                ]],
                "circle-stroke-width": ["case", ["==", ["get", "cmapmaker_stamp"], true], 5, 2],
                "circle-stroke-opacity": 1
            }
        });

        mapLibre.map.on("mousemove", layerId, e => {
            mapLibre.map.getCanvas().style.cursor = "pointer";
            if (Conf.icon.markerColors.hover?.enabled !== false) {
                this.#setMarkerHover(marker, e.features?.[0]?.id);
            }
        });
        mapLibre.map.on("mouseleave", layerId, () => {
            mapLibre.map.getCanvas().style.cursor = "";
            this.#clearMarkerHover();
        });
        mapLibre.map.on("click", layerId, e => { this.#selectMarker(e); });
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
                "icon-size": this.#iconZoomStep(marker, "marker")
            }
        });

        mapLibre.map.on("click", layerId, e => { this.#selectMarker(e); });
    }

    #addMarkerStampBadgeLayer(marker) {
        const layerId = `marker-stamp-${marker}`;
        if (mapLibre.map.getLayer(layerId)) return;
        const offset = -Conf.icon[marker] * 48 * 0.75 / 0.85;
        mapLibre.map.addLayer({
            id: layerId, type: "symbol", source: `marker-${marker}`,
            filter: ["==", ["get", "cmapmaker_stamp"], true],
            layout: {
                "icon-image": ["get", "cmapmaker_stamp_image"],
                "icon-size": this.#scaledZoomStep(0.85, "marker"),
                "icon-offset": [offset, offset],
                "icon-allow-overlap": true,
                "icon-ignore-placement": true
            }
        });
        // The badge is part of the POI's hit area; reuse normal selection.
        mapLibre.map.on("click", layerId, event => this.#selectMarker(event));
        mapLibre.map.on("mousemove", layerId, () => { mapLibre.map.getCanvas().style.cursor = "pointer"; });
        mapLibre.map.on("mouseleave", layerId, () => { mapLibre.map.getCanvas().style.cursor = ""; });
    }

    #addMarkerFavoriteBadgeLayer() {
        const layerId = "marker-favorite";
        if (mapLibre.map.getLayer(layerId)) return;

        mapLibre.map.addLayer({
            id: layerId,
            type: "symbol",
            source: "marker-favorite",
            minzoom: 14,
            layout: {
                "text-field": "♥",
                "text-font": Conf.icon.textFont,
                "text-size": ["interpolate", ["linear"], ["zoom"], 14, 12, 17, 18, 20, 20],
                "text-offset": [0.95, -1.0],
                "text-allow-overlap": true,
                "text-ignore-placement": true
            },
            paint: {
                "text-color": Conf.icon.markerColors.favorite?.badgeColor ?? "#d14970",
                "text-halo-color": "#ffffff",
                "text-halo-width": 1.5
            }
        });
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
                "text-radial-offset": 2.3,
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

    #iconZoomStep(iconName, stepName) {
        return this.#scaledZoomStep(Conf.icon[iconName], stepName);
    }

    #scaledZoomStep(baseSize, stepName) {
        const legacySteps = stepName === "shadow"
            ? { baseScale: 0.9, steps: [{ zoom: 16, scale: 1.0 }, { zoom: 17, scale: 1.1 }] }
            : { baseScale: 0.5, steps: [{ zoom: 16, scale: 0.6 }, { zoom: 17, scale: 0.7 }] };
        const zoomStep = Conf.icon.zoomSteps?.[stepName] ?? legacySteps;
        return [
            "step", ["zoom"], baseSize * zoomStep.baseScale,
            ...zoomStep.steps.flatMap(step => [step.zoom, baseSize * step.scale])
        ];
    }

    #circleRadiusZoomStep(marker) {
        return this.#scaledZoomStep(Conf.icon[marker] * 48, "marker");
    }

    // setPoi / makeList 共通: target が現在ズームレベルで表示対象か判定
    #isTargetInPoiViewZoom(targets, zoomlv = mapLibre.getZoom(true)) {
        const targetArr = Array.isArray(targets) ? targets : [targets];
        const visibleTargets = targetArr.filter(t => poiCont.getTargets().includes(t));

        return visibleTargets.some(t =>
            zoomlv >= cMapMaker.getPoiZoom(t) ||
            (Conf.etc?.editMode && zoomlv >= Conf.poiView.editZoom?.[t])
        );
    }

    select(poiid, detail, zoomOffset = 0, coordinates = null, { fromChanges = false } = {}) {
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

            if (!this.isAvailableInMode(loadOsmid)) {
                this.logMissingStatic(loadOsmid);
                resolve(false);
                return;
            }

            const moveCoordinates = fromChanges ? (coordinates || poi?.lnglat) : null;
            const moved = Array.isArray(moveCoordinates) && moveCoordinates.length >= 2
                && moveCoordinates.slice(0, 2).every(Number.isFinite)
                && Math.abs(moveCoordinates[0]) <= 180 && Math.abs(moveCoordinates[1]) <= 90;
            if (moved) mapLibre.flyTo(moveCoordinates, zoomlv);

            if (poi !== undefined && !fromChanges) {
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

            overPassCont.getOsmIds([loadOsmid], coordinates, null, { fromChanges })
                .then((geojson) => {
                    poiCont.addGeojson(geojson);

                    const loadedPoi = poiCont.get_osmid(loadOsmid);
                    if (!loadedPoi) {
                        throw new Error("poiCont.select: loaded POI not found: " + loadOsmid);
                    }

                    if (!moved) mapLibre.flyTo(loadedPoi.lnglat, zoomlv);
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
