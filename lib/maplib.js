"use strict";
// MapLibre Control
class Maplibre {

    constructor() {
        this.map;
        this.minimap;
        this.Control = { "locate": "", "maps": "" };    // MapLibre object
        this.popup = null;
        this.styles = {};
        this.selectStyle;
        this.TriggerRepaint;
        this.webglContextLost = false;
        this.indoorElevationEventsBound = false;
        this.indoorLayerStates = new Map();
        this.indoorLevelMarker = null;
        this.indoorLevelControlObserver = null;
        this.indoorLevelControlElement = null;
    }

    init(Conf) {
        function extractFilenamesFromTag(tag) { // タグからファイル名を返す
            const result = new Set()
            for (const key in tag) {
                const valueMap = tag[key]
                for (const val in valueMap) result.add(valueMap[val])
            }
            return result
        }

        function extractFilenamesFromSubtag(subtag) {
            const result = new Set()
            for (const keyEqVal in subtag) {
                const valueMap = subtag[keyEqVal]
                for (const subkey in valueMap) {
                    const icons = valueMap[subkey]
                    for (const subval in icons) result.add(icons[subval])
                }
            }
            return result
        }

        function waitForMapLoad(map, timeout = 60000) {
            return new Promise((resolve, reject) => {
                if (map && map.isStyleLoaded && map.isStyleLoaded()) return resolve();
                const timer = setTimeout(() => {
                    cleanup();
                    reject(new Error("Map load timeout. Check Tile Name ok?"));
                }, timeout);
                const onStyle = () => { cleanup(); resolve(); };
                const onErr = (e) => { console.warn("Map error during load:", e?.error || e) };
                const cleanup = () => {
                    clearTimeout(timer);
                    map.off("style.load", onStyle);
                    map.off("error", onErr);
                };
                map.once("style.load", onStyle);
                map.on("error", onErr);
            });
        }

        return new Promise((resolve, reject) => {
            console.log("Maplibre: init start.");
            this.selectStyle = Conf.map.tileName;
            Object.keys(Conf.tile).forEach(key => this.styles[key] = window.withAppAssetVersion(Conf.tile[key].style))
            let protocol = new pmtiles.Protocol()
            maplibregl.addProtocol("pmtiles", protocol.tile)
            this.map = new maplibregl.Map({
                container: 'mapid', style: this.styles[this.selectStyle], "maxZoom": Conf.map.maxZoom, "zoom": Conf.map.initZoom,
                antialias: true, hash: true, maxBounds: Conf.map.maxBounds, center: Conf.map.viewCenter,
                pitch: Conf.map.viewPitch, maxPitch: Conf.map.maxPitch, attributionControl: false, localIdeographFontFamily: ['sans-serif']
            });

            const mapContainer = this.map.getContainer();
            const mapCanvas = this.map.getCanvas();
            mapCanvas.addEventListener("webglcontextlost", () => {
                this.webglContextLost = true;
            });
            mapCanvas.addEventListener("webglcontextrestored", () => {
                this.webglContextLost = false;
            });
            const stopEventWithoutMapStyle = (event) => {
                if (!mapContainer.contains(event.target)) return;
                if (!this.webglContextLost && this.map && this.map.style) return;
                if (event.cancelable) event.preventDefault();
                event.stopImmediatePropagation();
            };
            ["click", "dblclick", "mousedown", "mouseup", "mousemove", "contextmenu", "wheel",
                "touchstart", "touchmove", "touchend"].forEach((eventName) => {
                    document.addEventListener(eventName, stopEventWithoutMapStyle, true);
                });

            this.map.scrollZoom.setWheelZoomRate(1 / 420);
            this.map.scrollZoom.setZoomRate(1 / 420);
            this.TriggerRepaint = this.map.triggerRepaint;
            const fnames1 = new Set([...extractFilenamesFromTag(Conf.marker.tag), ...extractFilenamesFromSubtag(Conf.marker.subtag)]);
            const markerImageIds = new Set([...fnames1].map(file => file.replace(/\.svg$/i, ".png")));
            const loadingMarkerImages = new Map();

            this.map.on("styleimagemissing", (event) => {
                const imageId = event.id;
                if (!markerImageIds.has(imageId) || this.map.hasImage(imageId) || loadingMarkerImages.has(imageId)) return;

                // styleimagemissing must be handled synchronously. Keep the image ID
                // valid while the actual marker is loaded, otherwise MapLibre reports
                // the missing image before the asynchronous request completes.
                this.map.addImage(imageId, {
                    width: 1,
                    height: 1,
                    data: new Uint8Array(4)
                });

                const loading = this.map.loadImage(window.withAppAssetVersion("./" + Conf.icon.fgPath + "/" + imageId))
                    .then((image) => {
                        if (this.map.hasImage(imageId)) this.map.removeImage(imageId);
                        this.map.addImage(imageId, image.data);
                    })
                    .catch((error) => {
                        console.warn(`Marker image load failed: ${imageId}`, error);
                    })
                    .finally(() => {
                        loadingMarkerImages.delete(imageId);
                    });

                loadingMarkerImages.set(imageId, loading);
            });
            console.log(`Maplibre: new Map(${Conf.map.tileName})`);

            waitForMapLoad(mapLibre.map, 60000).then(async () => {
                setTimeout(() => {
                    mapLibre.map.setSky({ "sky-color": "#5090D0" });
                    mapLibre.map.setSky(Conf.skyStyle);
                }, 1000)
                for (let file of Conf.marker.background) {
                    let image = await this.map.loadImage(window.withAppAssetVersion("./" + Conf.icon.bgPath + "/" + file))
                    this.map.addImage(file, image.data)
                }
                console.log("Maplibre: init end.")
                resolve()
            });
        });
    };

    enable(flag) {
        if (flag) {
            this.map.scrollWheelZoom.enable();
            this.map.dragging.enable();
        } else {
            this.map.scrollWheelZoom.disable();
            this.map.dragging.disable();
        }
    };

    start() {
        if (this.map !== undefined) {
            this.map.getCanvas().style.pointerEvents = "";
            this.map.triggerRepaint = this.TriggerRepaint;
            //this.map.triggerRepaint(); // 即時再描画
        }
        if (this.minimap !== undefined) {
            this.minimap.resize()
            this.minimap.getCanvas().style.pointerEvents = "";
            this.minimap.triggerRepaint = this.TriggerRepaint;
            this.minimap.triggerRepaint(); // 即時再描画
        }
    };

    stop() {
        if (this.map !== undefined) {
            this.map.getCanvas().style.pointerEvents = "none";
            this.map.triggerRepaint = () => { };
        }
        if (this.minimap !== undefined) {
            this.minimap.getCanvas().style.pointerEvents = "none";
            this.minimap.triggerRepaint = () => { };
        }
    };

    // Change Map Style / tilename:タイル名。空欄の時は設定された次のスタイル
    changeMap(tilename) {
        let styles = Object.keys(this.styles);
        let nextSt = (styles.indexOf(this.selectStyle) + 1) % styles.length;
        while (Conf.tile[styles[nextSt]].skip == true) {
            nextSt = (nextSt + 1) % styles.length;
        }
        this.selectStyle = !tilename ? styles[nextSt] : tilename;
        mapLibre.map.setStyle(this.styles[this.selectStyle]);
        setTimeout(() => {
            mapLibre.map.setSky({ "sky-color": "#5090D0" });
            mapLibre.map.setSky(Conf.skyStyle);
        }, 1000)
        return this.selectStyle;
    };

    on(event, callback) { this.map.on(event, callback); };

    openPopup(marker, params) {
        if (this.popup !== null) this.popup.close();
        setTimeout((() => { this.popup = L.popup(marker.getLngLat(), params).openOn(this.map); }).bind(this), 100);
    };

    flyTo(ll, zoomlv) { this.map.flyTo({ center: ll, zoom: zoomlv, speed: 2, essential: true }); };

    // return Zoom Level / round: Math.Round(true or false)
    getZoom(round) { return round ? Math.round(this.map.getZoom() * 10) / 10 : this.map.getZoom(); };

    setZoom(zoomlv) { this.map.flyTo({ center: this.map.getCenter(), zoom: zoomlv, speed: 0.5 }); };

    getCenter() { return this.map.getBounds().getCenter(); };

    setIndoorLevelControl(element) {
        if (!this.map || !element) return;
        const container = this.map.getContainer();
        if (element.parentElement !== container) container.appendChild(element);
        const updatePosition = () => {
            const baseList = document.getElementById("baselist");
            const baseListRect = baseList?.getBoundingClientRect();
            const gap = window.matchMedia?.("(max-width: 575.98px)").matches ? 6 : 10;
            element.style.top = `${Math.round(baseListRect?.bottom ?? 0) + gap}px`;
            element.style.left = `${Math.max(gap, Math.round(baseListRect?.left ?? gap))}px`;
        };
        if (this.indoorLevelControlElement !== element) {
            this.indoorLevelControlObserver?.disconnect();
            this.indoorLevelControlElement = element;
            this.indoorLevelControlObserver = new ResizeObserver(updatePosition);
            const baseList = document.getElementById("baselist");
            if (baseList) this.indoorLevelControlObserver.observe(baseList);
        }
        updatePosition();
        element.hidden = false;
    };

    hideIndoorLevelControl() {
        const element = document.getElementById("indoorLevelControl");
        if (element) element.hidden = true;
    };

    get_LL(lll) {			// LngLatエリアの設定 [経度lng,緯度lat] lll:少し大きめにする
        let ll = { "NW": this.map.getBounds().getNorthWest(), "SE": this.map.getBounds().getSouthEast() };
        if (lll) {
            ll.NW.lng = ll.NW.lng * 0.999998;
            ll.SE.lng = ll.SE.lng * 1.000002;
            ll.SE.lat = ll.SE.lat * 0.999998;
            ll.NW.lat = ll.NW.lat * 1.000002;
        }
        return ll;
    };

    getMiniLL(lll) {
        if (this.minimap == undefined) return undefined
        let ll = { "NW": this.minimap.getBounds().getNorthWest(), "SE": this.minimap.getBounds().getSouthEast() };
        if (lll) {
            ll.NW.lng = ll.NW.lng * 0.999997;
            ll.SE.lng = ll.SE.lng * 1.000003;
            ll.SE.lat = ll.SE.lat * 0.999997;
            ll.NW.lat = ll.NW.lat * 1.000003;
        }
        return ll;
    }

    addControl(position, domid, html, cname) {     // add MapLibre control
        class HTMLControl {
            onAdd(map) {
                this._map = map;
                this._container = document.createElement('div');
                this._container.id = domid;
                this._container.className = 'maplibregl-ctrl ' + cname;
                this._container.innerHTML = html;
                this._container.style = "transform: initial;";
                return this._container;
            }
            onRemove() {
                this._container.parentNode.removeChild(this._container);
                this._map = undefined;
            }
        }
        this.map.addControl(new HTMLControl(), position);
    };

    addNavigation(position) {                               // add location
        this.map.addControl(new maplibregl.AttributionControl({ compact: false, customAttribution: '' }), "bottom-left");
        this.map.addControl(new maplibregl.NavigationControl(), position);
        this.map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: true }), position);
    };

    addScale(position) { this.map.addControl(new maplibregl.ScaleControl(), position); };

    //
    updateVisitedCountry() {
        let visitedcountory = poiCont.getPolygonVisitedCountory()
        let viss = this.minimap.getSource("viss");
        if (viss !== undefined) viss.setData({ type: 'FeatureCollection', features: visitedcountory })
    }

    // ミニマップ表示(初期設定)
    addMiniMap() {
        return new Promise((resolve) => {
            console.log("addMiniMap: Start")
            const mmap = document.getElementById("mini-map")
            if (this.minimap === null || this.minimap === undefined) {  // 初回設定
                let planet = Conf.tile.miniMap.style
                this.minimap = new maplibregl.Map({ container: 'mini-map', style: planet, interactive: true, attributionControl: false, localIdeographFontFamily: ['sans-serif'] })
                this.minimap.on('style.load', () => {
                    let allcountry = []
                    let visitedcountory = poiCont.getPolygonVisitedCountory()
                    let countries = poiCont.getAllOSMCountryCode()      // 国コードがある施設一覧
                    if (countries.length > 0) {
                        countries.forEach((CCode) => {
                            let CPoly = poiCont.getPolygonByCountryCode(CCode)
                            if (CPoly !== undefined) allcountry.push(CPoly[0])
                        })
                    }
                    this.minimap.addSource("alls", { type: 'geojson', data: { type: 'FeatureCollection', features: allcountry } })
                    this.minimap.addSource("viss", { type: 'geojson', data: { type: 'FeatureCollection', features: visitedcountory } })
                    this.minimap.addSource("sels", { type: 'geojson', data: { type: 'FeatureCollection', features: [] } })
                    this.minimap.addLayer({ id: 'alls-fill', type: 'fill', source: 'alls', paint: { 'fill-color': '#002200', 'fill-opacity': 0.2 } })
                    this.minimap.addLayer({ id: 'viss-fill', type: 'fill', source: 'viss', paint: { 'fill-color': '#88FF88', 'fill-opacity': 0.3 } })
                    this.minimap.addLayer({ id: 'sels-fill', type: 'fill', source: 'sels', paint: { 'fill-color': '#FF8844', 'fill-opacity': 0.6 } })
                    this.minimap.setProjection({ "type": "globe" }) // globe表示には fog が必要
                    mapLibre.addMiniMapControl("top-left", "flags", "");
                    mmap.classList.remove("d-none")
                    this.minimap.setCenter(Conf.map.viewCenter)
                    this.minimap.setZoom(Conf.minimap.initZoom)
                    this.minimap.on('click', this.#miniMapClick)
                    console.log("addMiniMap: End")
                    resolve(true)
                })
            } else {
                resolve(true)
            }
        })
    }

    addMiniMapControl(position, domid, html, cname) {     // add MapLibre control for MiniMap
        class HTMLControl {
            onAdd(map) {
                this._map = map;
                this._container = document.createElement('div');
                this._container.id = domid;
                this._container.className = 'maplibregl-ctrl ' + cname;
                this._container.innerHTML = html;
                this._container.style = "transform: initial;";
                return this._container;
            }
            onRemove() {
                this._container.parentNode.removeChild(this._container);
                this._map = undefined;
            }
        }
        this.minimap.addControl(new HTMLControl(), position);
    }

    viewMiniMap(view) {
        const method = view ? "remove" : "add"
        document.getElementById("mini-map").classList[method]("d-none")
    }

    #miniMapClick(e) {
        console.log("#miniMapClick: Start")
        const pt = turf.point([e.lngLat.lng, e.lngLat.lat])
        const matches = poiCont.getPolygonByPoint(pt)  // 国判定
        if (matches.length > 0) {               // 地図移動（miniMapとmapの両方）
            let CCode = matches[0].properties["ISO3166-1-Alpha-2"];
            let OSMID = poiCont.getOsmidByCountryCode(CCode);
            if (OSMID !== "") {
                poiCont.select(OSMID, !cMapMaker.minimap, cMapMaker.minimap ? -1 : 0);
                mapLibre.#highlightCountry(matches)
                let geojson = poiCont.get_osmid(OSMID).geojson
                geoCont.writePoiCircle(geojson)
                geoCont.flashPolygon(geojson)
                console.log("#miniMapClick: End")
            }
        }
    }

    // ISO-3166 Alpha-2に基づいてminimapを移動してハイライト化
    showCountryByCode(CCode) {
        let matches = []
        console.log("showCountryByCode");
        let countries = CCode.split(";")
        this.addMiniMap().then(() => {
            this.updateVisitedCountry()
            for (let cno = 0; cno < countries.length; cno++) {
                const match = poiCont.getPolygonByCountryCode(countries[cno]);
                if (match.length == 0) { console.warn("showCountryByCode: Not found: ", countries[cno]); continue }
                matches.push(match[0])
            }
            this.#highlightCountry(matches)
        })
    }

    // 指定したGeoJsonから一番大きいポリゴンを返す
    #getLargestPolygonFromMultiPolygon(feature) {
        if (feature.geometry.type !== "MultiPolygon") return feature;
        const polygons = feature.geometry.coordinates.map(coords => turf.polygon(coords, feature.properties));
        let largest = polygons[0];
        let maxArea = turf.area(largest);
        for (let i = 1; i < polygons.length; i++) {
            const area = turf.area(polygons[i]);
            if (area > maxArea) { largest = polygons[i]; maxArea = area; }
        }
        return largest;
    }

    // 指定したgeoJsonをハイライト
    #highlightCountry(feature) {
        const highlight = function () {
            console.log("geoLib: #highlightCountry: " + feature[0].properties["ISO3166-1-Alpha-2"])
            this.minimap.getSource("sels").setData({ type: 'FeatureCollection', features: feature })
            let largestFeature = this.#getLargestPolygonFromMultiPolygon(feature[0])
            let maxArea = turf.area(largestFeature)
            for (let i = 1; i < feature.length; i++) {
                const candidate = this.#getLargestPolygonFromMultiPolygon(feature[i])
                const area = turf.area(candidate)
                if (area > maxArea) largestFeature = candidate; maxArea = area
            }
            const bbox = turf.bbox(largestFeature)
            const bboxCenter = function (bbox) {
                const [minX, minY, maxX, maxY] = bbox
                return [(minX + maxX) / 2, (minY + maxY) / 2]
            }
            const area = turf.area(largestFeature)
            const center = bboxCenter(bbox)
            const zoom = area < 5e9 ? 4.5 : area < 1e11 ? 3.5 : area < 1e12 ? 3 : 2
            this.minimap.flyTo({ center, zoom: zoom, duration: 1000, essential: true })
        }.bind(this)
        if (feature.length > 0) highlight()
    }

    // 指定した国コードリストの画像を読み込む
    async addCountryFlagsImage(countries) {
        async function loadFlagIcons() {
            const images = await Promise.all(
                countries.map(async (CCode) => {
                    let image;
                    const code = CCode.toLowerCase();
                    const urls = [
                        `https://flagcdn.com/w40/${code}.png`, // 第1候補（CDN）
                        `./flags/w40/${code}.png`              // 第2候補（ローカル）
                    ];
                    for (const url of urls) {
                        try {
                            image = await mapLibre.map.loadImage(url);
                            return { status: true, file: `flag-${CCode}`, image: image.data };
                        } catch (err) {
                            console.warn("addCountryFlagsImage: failed", url);
                        }
                    }
                    // すべて失敗した場合
                    return { status: false, file: `flag-${CCode}`, image: null };
                    /*
                    let image;
                    const url = `https://flagcdn.com/w40/${CCode.toLowerCase()}.png`;
                    try {
                        image = await mapLibre.map.loadImage(url)
                        return { status: true, file: `flag-${CCode}`, image: image.data };
                    } catch (err) {
                        console.log("addCountryFlagsImage: Error. " + CCode);
                        const nurl = `./flags/w40/${CCode.toLowerCase()}.png`;
                        image = await mapLibre.map.loadImage(nurl)
                        return { status: true, file: `flag-${CCode}`, image: image.data };
                    }
                        */
                })
            );
            for (const { status, file, image } of images) {
                if (status && image && !mapLibre.map.hasImage(file)) mapLibre.map.addImage(file, image);
            }
        }
        await loadFlagIcons();
    }

    addIndoor(data, target, selectedLevel) {
        if (!Conf.indoor?.use || !Conf.osm?.[target]) return;

        const level = String(selectedLevel ?? Conf.indoor.defaultLevel ?? "0");
        const configuredMinZoom = cMapMaker.indoorRenderMinZoom;
        const minZoom = configuredMinZoom !== null && Number.isFinite(Number(configuredMinZoom))
            ? Number(configuredMinZoom) : (cMapMaker.getPoiZoom(target) ?? 18);
        const numericLevel = Number(level);
        const configuredFloorHeight = Number(Conf.indoor.floorHeightMeters);
        const configuredFloorOffset = Number(Conf.indoor.floorOffsetMeters);
        const configuredFloorThickness = Number(Conf.indoor.floorThicknessMeters);
        const floorHeight = Number.isFinite(configuredFloorHeight) && configuredFloorHeight >= 0 ? configuredFloorHeight : 3.2;
        const floorOffset = Number.isFinite(configuredFloorOffset) ? configuredFloorOffset : 0.2;
        const floorThickness = Number.isFinite(configuredFloorThickness) && configuredFloorThickness > 0 ? configuredFloorThickness : 0.12;
        const elevation = Math.max(0, floorOffset + (Number.isFinite(numericLevel) ? numericLevel * floorHeight : 0));
        const topElevation = elevation + floorThickness;
        const features = (data?.features ?? []).filter(feature => {
            const isBuildingOutline = feature?.properties?.building !== undefined
                && ["Polygon", "MultiPolygon"].includes(feature?.geometry?.type);
            if (isBuildingOutline) {
                return cMapMaker.isIndoorBuildingOutlineVisible(feature, level);
            }
            const featureId = feature?.properties?.id ?? feature?.id;
            if (cMapMaker.indoorContextFeatureIds instanceof Set
                && !cMapMaker.indoorContextFeatureIds.has(String(featureId))) return false;
            return cMapMaker.getIndoorFeatureLevels(feature).includes(level);
        });
        const floorData = { type: "FeatureCollection", features };
        const sourceId = `${target}-floor`;
        const source = this.map.getSource(sourceId);
        if (source) {
            source.setData(floorData);
            const layerIds = this.indoorLayerStates.get(target)?.layerIds;
            if (layerIds) {
                this.indoorLayerStates.set(target, { layerIds, elevation });
                this.map.setPaintProperty(layerIds.fill, "fill-extrusion-base", elevation);
                this.map.setPaintProperty(layerIds.fill, "fill-extrusion-height", topElevation);
                Object.values(layerIds).forEach(layerId => {
                    if (this.map.getLayer(layerId)) this.map.setLayerZoomRange(layerId, minZoom, 24);
                });
                this.updateIndoorOverlayElevation();
            }
            return;
        }

        const styles = Conf.osm[target].expression.styles ?? {};
        const room = styles.room ?? {};
        const area = styles.area ?? {};
        const corridor = styles.corridor ?? {};
        const wall = styles.wall ?? {};
        const building = styles.building ?? {};
        const door = styles.door ?? {};
        const layerIds = {
            fill: `${target}-floor-fills`,
            outline: `${target}-building-outline`,
            line: `${target}-floor-lines`,
            point: `${target}-floor-points`,
            text: `${target}-floor-text`
        };
        this.indoorLayerStates.set(target, { layerIds, elevation });

        this.map.addSource(sourceId, { type: "geojson", data: floorData, promoteId: "id" });
        this.map.addLayer({
            id: layerIds.fill,
            type: "fill-extrusion",
            source: sourceId,
            minzoom: minZoom,
            filter: ["all",
                ["==", ["geometry-type"], "Polygon"],
                ["any",
                    ["in", ["get", "indoor"], ["literal", ["room", "area", "corridor"]]],
                    ["==", ["get", "highway"], "corridor"]
                ]
            ],
            paint: {
                "fill-extrusion-color": ["case",
                    ["==", ["get", "highway"], "corridor"], corridor.fill ?? "#f8f8f8",
                    ["match", ["get", "indoor"],
                        "corridor", corridor.fill ?? "#f8f8f8",
                        "area", area.fill ?? "#e8f3e8",
                        room.fill ?? "#f4e7cf"
                    ]
                ],
                "fill-extrusion-opacity": 0.86,
                "fill-extrusion-base": elevation,
                "fill-extrusion-height": topElevation,
                "fill-extrusion-vertical-gradient": false
            }
        });
        this.map.addLayer({
            id: layerIds.outline,
            type: "line",
            source: sourceId,
            minzoom: minZoom,
            filter: ["has", "building"],
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
                "line-color": building.stroke ?? "#303842",
                "line-width": building["stroke-width"] ?? 4,
                "line-opacity": 0.98,
                "line-translate-anchor": "viewport"
            }
        });
        this.map.addLayer({
            id: layerIds.line,
            type: "line",
            source: sourceId,
            minzoom: minZoom,
            filter: ["!", ["has", "building"]],
            layout: { "line-cap": "round", "line-join": "round" },
            paint: {
                "line-color": ["case",
                    ["==", ["get", "highway"], "corridor"], corridor["highway-stroke"] ?? "#2563a8",
                    ["match", ["get", "indoor"],
                        "wall", wall.stroke ?? "#4b5563",
                        "corridor", corridor.stroke ?? "#9aa0a6",
                        "area", area.stroke ?? "#789478",
                        room.stroke ?? "#8b7965"
                    ]
                ],
                "line-width": ["case",
                    ["==", ["get", "highway"], "corridor"], corridor["highway-stroke-width"] ?? 3,
                    ["match", ["get", "indoor"],
                        "wall", wall["stroke-width"] ?? 2.5,
                        1
                    ]
                ],
                "line-opacity": 0.95,
                "line-translate-anchor": "viewport"
            }
        });
        this.map.addLayer({
            id: layerIds.point,
            type: "circle",
            source: sourceId,
            minzoom: minZoom,
            filter: ["==", ["geometry-type"], "Point"],
            paint: {
                "circle-radius": door.radius ?? 3.5,
                "circle-color": door.color ?? "#2563a8",
                "circle-stroke-color": "#ffffff",
                "circle-stroke-width": 1,
                "circle-translate-anchor": "viewport"
            }
        });
        this.map.addLayer({
            id: layerIds.text,
            type: "symbol",
            source: sourceId,
            minzoom: minZoom,
            // PointのPOI名はマーカーレイヤー側で表示するため、ここでは重ねて描画しない。
            // 通路・部屋など線／面の名称は従来どおり屋内レイヤーで表示する。
            filter: ["all",
                ["!=", ["geometry-type"], "Point"],
                ["any", ["has", "name"], ["has", "ref"]]
            ],
            layout: {
                "text-field": ["coalesce", ["get", "name"], ["get", "ref"], ""],
                "text-font": Conf.map.textFont,
                "text-size": Conf.map.textSize,
                "text-anchor": "center",
                "text-padding": 2,
                "text-allow-overlap": false
            },
            paint: {
                "text-color": "#1f2937",
                "text-halo-color": "#ffffff",
                "text-halo-width": 1.5,
                "text-translate-anchor": "viewport"
            }
        });

        this.updateIndoorOverlayElevation();
        if (!this.indoorElevationEventsBound) {
            this.map.on("move", () => this.updateIndoorOverlayElevation());
            this.indoorElevationEventsBound = true;
        }

    }

    updateIndoorOverlayElevation() {
        if (!this.map || this.indoorLayerStates.size === 0) return;
        const center = this.map.getCenter();
        const latitudeRadians = center.lat * Math.PI / 180;
        const worldSize = 512 * Math.pow(2, this.map.getZoom());
        const metersPerPixel = 40075016.68557849 * Math.cos(latitudeRadians) / worldSize;
        const pitchRadians = this.map.getPitch() * Math.PI / 180;

        this.indoorLayerStates.forEach(({ layerIds, elevation }) => {
            if (!Number.isFinite(metersPerPixel) || metersPerPixel <= 0) return;
            const translate = [0, -(elevation / metersPerPixel) * Math.sin(pitchRadians)];
            if (this.map.getLayer(layerIds.outline)) this.map.setPaintProperty(layerIds.outline, "line-translate", translate);
            if (this.map.getLayer(layerIds.line)) this.map.setPaintProperty(layerIds.line, "line-translate", translate);
            if (this.map.getLayer(layerIds.point)) this.map.setPaintProperty(layerIds.point, "circle-translate", translate);
            if (this.map.getLayer(layerIds.text)) this.map.setPaintProperty(layerIds.text, "text-translate", translate);
        });
    }

    addPolygon(data, target, titleTag) {
        //console.log("geolib: addPolygon: " + target)
        let source = this.map.getSource(target)
        if (source !== undefined) {
            source.setData(data);       // 2回目以降の呼び出しはデータ設定のみ
        } else if (Conf.osm[target] !== undefined) {
            let exp = Conf.osm[target].expression;
            let zoom = cMapMaker.getPoiZoom(target)
            this.map.addSource(target, { "type": "geojson", "data": data });
            this.map.addLayer({
                'id': target + "-lines", 'type': 'line', 'source': target,
                'layout': { 'line-cap': 'round', 'line-join': 'round' },
                'paint': { 'line-color': exp.stroke, 'line-width': exp["stroke-width"], 'line-opacity': exp["fill-opacity"] }
            });
            if (zoom !== undefined) this.map.setLayerZoomRange(target + '-lines', zoom, 23);

            if (Conf.map.textSize > 0) {        // fontsizeが0より上の場合
                mapLibre.map.addLayer({
                    id: target + "-text", type: 'symbol', source: target,
                    layout: {
                        "text-field": titleTag,             // 指定されたルールに沿う
                        "text-font": Conf.map.textFont,     // 使用可能なフォント（spriteに依存）
                        "text-size": Conf.map.textSize,
                        "text-anchor": "center",            // テキストの位置（上、中央、下など）
                        'symbol-placement': 'point', 'symbol-sort-key': 1,
                        'text-allow-overlap': true, 'text-ignore-placement': true,
                        'text-offset': [0, 1]
                    },
                    paint: { "text-color": "#000000", "text-halo-color": "#ffffff", "text-halo-width": 2 }
                })
                if (zoom !== undefined) this.map.setLayerZoomRange(target + '-text', zoom, 23)
            }

            let icon = Conf.osm[target].expression.imageIcon
            let size = Conf.osm[target].expression.imageSize
            if (icon !== undefined) {
                mapLibre.map.addLayer({
                    id: target + "-icon", type: 'symbol', source: target, minzoom: 12,
                    layout: {
                        'icon-anchor': 'top-left',
                        'symbol-placement': 'point', 'symbol-sort-key': 0, "icon-offset": [-80, -50],
                        'icon-allow-overlap': true, 'icon-ignore-placement': true,
                        'icon-image': icon, 'icon-size': size == undefined ? 1 : size,
                    }
                })
            }

            this.map.addLayer({
                'id': target + "-fills", 'type': 'fill', 'source': target, 'filter': ['==', '$type', 'Polygon'],
                'paint': { 'fill-color': exp.stroke, 'fill-opacity': exp["fill-opacity"] }
            });
            if (zoom !== undefined) this.map.setLayerZoomRange(target + '-fills', zoom, 23)
            if (!exp.poiView) {         // アイコン非表示のポイントはCircle表示
                this.map.addLayer({
                    id: target + '-points', type: 'circle', source: target,
                    filter: ['==', '$type', 'Point'], // ★ポイントだけ抽出
                    minzoom: 12,
                    paint: {
                        'circle-radius': [
                            'interpolate', ['linear'], ['zoom'],
                            12, exp["stroke-width"] / 2,
                            16, exp["stroke-width"],
                            20, exp["stroke-width"] * 2
                        ],
                        'circle-color': exp.stroke,
                        'circle-opacity': exp["fill-opacity"]
                    }
                });
                if (zoom !== undefined) this.map.setLayerZoomRange(target + '-points', zoom, 23);
            }
        }
    }
}
