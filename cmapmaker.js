/*	Main Process */
"use strict";

// Global Variable
var Conf = {}; // Config Praams
const LANG = (window.navigator.userLanguage || window.navigator.language || window.navigator.browserLanguage).substr(0, 2) == "ja" ? "ja" : "en";
const glot = new Glottologist();
let modalActs = null;
let osmBasic = null;
const basic = new Basic();
const poiStatusCont = new PoiStatusCont();
const overPassCont = new OverPassControl();
const mapLibre = new Maplibre();
const geoCont = new GeoCont();
const listTable = new ListTable();
const poiCont = new PoiCont();
const gSheet = new GoogleSpreadSheet();
let wikimedia = null;
let wikimediaPromise = null;
const getWikimedia = () => {
    if (wikimedia) return Promise.resolve(wikimedia);
    if (!wikimediaPromise) {
        wikimediaPromise = window.loadLazyScriptGroup("wikimedia")
            .then(() => {
                wikimedia = new WikimediaLib();
                return wikimedia;
            })
            .catch((error) => {
                wikimediaPromise = null;
                throw error;
            });
    }
    return wikimediaPromise;
};
var PoiStatusIndex = { VISITED: 0, FAVORITE: 1, MEMO: 2 };
var PoiStatusCsvIndex = { KEY: 0, CATEGORY: 1, NAME: 2, VISITED: 3, FAVORITE: 4, MEMO: 5 };
var PoiStatusCsvIndexOld = { KEY: 0, CATEGORY: 1, NAME: 2, VISITED: 3, MEMO: 4 };

class CMapMaker {

    constructor() {
        this.status = "initialize";         // 状態フラグ / initialize changeMode normal playback
        this.mode = "map";
        this.moveMapBusy = false;
        this.moveMapPending = false;
        this.changeKeywordWaitTime;
        this.scrollHints = 0;
        this.thumbnailRowsKey = "";
        this.thumbnailRows = [];
        this.detailLibrariesPromise = null;
        this.favoriteFilter = null;
        this.visitedFilterStatus = null;
        this.openOSMid = null;
        this.updateViewRequestId = 0;
        this.indoorLevel = null;
        this.indoorLevelControlElement = null;
        this.indoorLevelPage = "base";
        this.indoorContextKey = null;
        this.indoorBuildingId = null;
        this.indoorBuildingFeature = null;
        this.indoorBuildingIds = new Set();
        this.indoorBuildingFeatures = [];
        this.indoorBuildingLevelRanges = new Map();
        this.indoorContextFeatureIds = null;
        this.indoorUndergroundMode = false;
        this.indoorRenderMinZoom = null;
        this.indoorModeActive = false;
    }

    loadDetailLibraries() {
        if (modalActs && osmBasic && wikimedia) return Promise.resolve();
        if (!this.detailLibrariesPromise) {
            this.detailLibrariesPromise = Promise.all([
                window.loadLazyScriptGroup("detail"),
                getWikimedia()
            ]).then(() => {
                modalActs ??= new Activities();
                osmBasic ??= new OSMbasic();
            }).catch((error) => {
                this.detailLibrariesPromise = null;
                throw error;
            });
        }
        return this.detailLibrariesPromise;
    }

    init() {        // initialize
        console.log("Welcome to Community Map Maker.");
        console.log("initialize: Start.");
        const FILES = [
            "./baselist.html", "./data/config-user.jsonc", "./data/config-system.jsonc",
            "./data/config-activities.jsonc", `./data/marker.jsonc`,
            `./data/category-${LANG}.jsonc`, `./data/listtable.jsonc`,
            "./data/overpass-system.jsonc", `./data/overpass-custom.jsonc`,
            `./data/glot-custom.jsonc`, `./data/glot-system.jsonc`,
        ];
        const fetchText = async (url, maxAttempts = 3) => {
            let lastError;
            for (let attempt = 1; attempt <= maxAttempts; attempt++) {
                try {
                    const response = await fetch(url);
                    if (!response.ok) {
                        throw new Error(`HTTP ${response.status} ${response.statusText}`);
                    }
                    return await response.text();
                } catch (error) {
                    lastError = error;
                    if (attempt < maxAttempts) {
                        await new Promise(resolve => setTimeout(resolve, attempt * 250));
                    }
                }
            }
            throw new Error(`Failed to load ${url}: ${lastError?.message ?? "Unknown fetch error"}`);
        };
        const fetchUrls = FILES.map(url => fetchText(window.withAppAssetVersion(url)));
        const setUrlParams = function () {  // URLから引数を取得して返す関数
            let keyValue = {};
            let search = location.search.replace(/[?&]fbclid.*/, "").replace(/%2F/g, "/").slice(1); // facebook対策
            search = search.slice(-1) == "/" ? search.slice(0, -1) : search; // facebook対策(/が挿入される)
            let params = search.split("&"); // -= -> / and split param
            history.replaceState("", "", location.pathname + "?" + search + location.hash); // fixURL
            for (const param of params) {
                let delimiter = param.includes("=") ? "=" : "/";
                let keyv = param.split(delimiter);
                keyValue[keyv[0]] = keyv[1];
            }
            return keyValue;
        }
        const loadStatic = async function () {
            if (!Conf.static.use) return;

            console.log("cMapMaker: Static mode");
            const datas = await Promise.all(Conf.static.osmjsons.map(async (url) => {
                const response = await fetch(window.withAppAssetVersion(url));
                if (!response.ok) throw new Error(`Static data load failed: ${url} (${response.status})`);
                return response.text();
            }));

            datas.forEach(data => {
                let json = JSON5.parse(data)
                let ovanswer = overPassCont.setOsmJson(json);
                poiCont.addGeojson(ovanswer);
            })
            poiCont.setActlnglat();
            console.log("cMapMaker: Static load done.");
        }
        const setBGImage = function (imgUrl) {  // basemenuの背景画像設定
            const test = new Image();
            const versionedImgUrl = window.withAppAssetVersion(imgUrl);
            test.onload = () => document.body.style.setProperty("--bg-url", `url(${versionedImgUrl})`);
            test.onerror = () => document.body.style.setProperty("--bg-url", "none");
            test.src = versionedImgUrl;
        }

        Promise.all(fetchUrls)
            .then((texts) => {
                let basehtml = texts[0]; // Get Menu HTML
                for (let i = 1; i <= 7; i++) {
                    Conf = Object.assign(Conf, JSON5.parse(texts[i]));
                }
                Conf.osm = Object.assign(Conf.osm, JSON5.parse(texts[8]).osm);
                Conf.category_keys = Object.keys(Conf.category); // Make Conf.category_keys
                Conf.category_subkeys = Object.keys(Conf.category_sub); // Make Conf.category_subkeys
                glot.data = Object.assign(glot.data, JSON5.parse(texts[9])); // import glot data
                glot.data = Object.assign(glot.data, JSON5.parse(texts[10])); // import glot data
                let UrlParams = setUrlParams();
                if (UrlParams.edit) Conf.etc["editMode"] = true;
                if (UrlParams.static !== undefined) {
                    const staticMode = basic.parseBoolean(UrlParams.static);
                    if (staticMode !== null) Conf.static.use = staticMode;
                }

                winCont.viewSplash(true);
                listTable.init();
                poiCont.init(Conf.minimap.use);

                const activityDataPromise = gSheet.get(Conf.google.AppScript);
                mapLibre.init(Conf).then(() => { // GASの応答を待たず、地図を先に初期化する
                    // MapLibre add control
                    console.log("initialize: MapLibre OK.");
                    mapLibre.addControl("top-left", "baselist", basehtml, "mapLibre-control m-0 p-0"); // Make: base list
                    setBGImage(Conf.listTable.backgroundImage)
                    mapLibre.addControl("bottom-right", "dummy", " ", "");
                    if (Conf.etc.localSave !== "") filter_menu.classList.remove('d-none')
                    if (Conf.map.changeMap) mapLibre.addControl("bottom-right", "maplist", "<button onclick='cMapMaker.changeMap()'><i class='fas fa-layer-group fa-lg'></i></button>", "maplibregl-ctrl-group");
                    mapLibre.addControl("bottom-left", "images", "", "showcase"); // add images
                    mapLibre.addNavigation("bottom-right");
                    mapLibre.addControl("bottom-left", "globalStatus", "", "m-0");
                    globalStatus.innerHTML = '<div id="globalSpinner" class="spinner-border text-primary m-1 d-none"></div><span id="globalMessage" class="globalMessage"></span>';
                    cMapMaker.initIndoorControl(UrlParams.level);
                    winCont.playback(Conf.listTable.playback.view); // playback control view:true/false
                    winCont.download(Conf.listTable.download); // download view:true/false
                    cMapMaker.changeMode("list");
                    winCont.showMessage(Conf.tile[mapLibre.selectStyle].name);
                    const mergedMenu = [...Conf.menu.main, ...Conf.menu.mainSystem];
                    winCont.menu_make(mergedMenu, "main_menu");
                    winCont.mouseDragScroll(images, cMapMaker.eventViewThumb); // set Drag Scroll on images
                    winCont.initSidebarResize();
                    glot.render()
                    list_keyword.setAttribute("placeholder", glot.get("searchKeyword"));
                    listTitle.innerHTML = glot.get("listTitle");
                    let resizeWaitTime;
                    window.onresize = () => { // 画面サイズに合わせたコンテンツ表示切り替え
                        winCont.resizeWindow();
                        clearTimeout(resizeWaitTime);
                        resizeWaitTime = setTimeout(() => {
                            winCont.setSidebar("redraw").then(() => {
                                cMapMaker.makeImages(Conf.thumbnail.use);
                            });
                        }, 100);
                    };
                    // document.title = glot.get("site_title"); // Google検索のインデックス反映が読めないので一旦なし
                    cMapMaker.clearDatail() // 詳細モーダルの内容をクリア

                    const initialCategory = decodeURI(
                        (UrlParams.category !== "" && UrlParams.category !== undefined) ? UrlParams.category : Conf.selectItem.default
                    );
                    let resolveInitialView;
                    const initialViewReady = new Promise((resolve) => { resolveInitialView = resolve; });
                    const init_close = function () {
                        cMapMaker.updateView(initialCategory).then(() => {     // 初期データロード
                            mapLibre.addCountryFlagsImage(poiCont.getAllOSMCountryCode())
                            article.classList.remove("d-none")
                            article.style.removeProperty("display")
                            winCont.resizeWindow()
                            winCont.setSidebar(Conf.sideBar.initView).then(() => {
                                cMapMaker.addEvents()
                                setTimeout(() => { cMapMaker.eventMoveMap() }, 300) // 本来なら不要だがfirefoxだとタイミングの関係で必要
                                if (UrlParams.node || UrlParams.way || UrlParams.relation) {
                                    let keyv = Object.entries(UrlParams).find(([key, value]) => value !== undefined)
                                    let param = keyv[0] + "/" + keyv[1]
                                    let subparam = param.split(".") // split child elements(.)
                                    let osmdata = poiCont.get_osmid(subparam[0])
                                    let geojson = osmdata !== undefined ? osmdata.geojson : undefined
                                    if (osmdata !== undefined) {
                                        cMapMaker.viewDetail(subparam[0], subparam[1])
                                            .then(() => {
                                                geoCont.flashPolygon(geojson)
                                                geoCont.writePoiCircle(geojson)
                                                const detailZoom = Math.max(mapLibre.getZoom(true), Conf.map.detailZoom)
                                                mapLibre.flyTo(osmdata.lnglat, detailZoom)
                                            })
                                            .catch((e) => {
                                                console.warn("cMapMaker.init: viewDetail failed", e);
                                            });
                                    } else {
                                        console.warn("cMapMaker.init: No OSM data found for ID:", subparam[0]);
                                    }
                                }
                            })
                            resolveInitialView();
                        })
                    }

                    poiCont.setActdata([]);
                    if (Conf.poiView.poiActLoad) {
                        let osmids = poiCont.pois().acts.map((act) => { return act.osmid; });
                        osmids = osmids.filter(Boolean);
                        if (osmids.length > 0 && !Conf.static.use) {   // osmidsがある&非static時
                            basic.retry(() => overPassCont.getOsmIds(osmids), 5)
                                .then((geojson) => {
                                    if (geojson) poiCont.addGeojson(geojson)
                                    poiCont.setActlnglat()
                                })
                                .catch((error) => {
                                    console.error("cMapMaker.init: Initial Overpass load failed.", error);
                                })
                                .finally(() => {
                                    init_close();
                                });
                        } else {    // static時
                            loadStatic()
                                .catch((error) => {
                                    console.error("cMapMaker.init: Static data load failed.", error);
                                })
                                .finally(() => {
                                    poiCont.setActlnglat()
                                    init_close()
                                })
                        }
                    } else if (Conf.static.use) {       // actLoadしない&Static時
                        loadStatic()
                            .catch((error) => {
                                console.error("cMapMaker.init: Static data load failed.", error);
                            })
                            .finally(() => init_close())
                    } else {
                        init_close()
                    }
                    activityDataPromise.then(async (activities) => {
                        await initialViewReady;
                        poiCont.setActdata(activities);

                        if (Conf.poiView.poiActLoad && !Conf.static.use) {
                            const osmids = activities.map((act) => act.osmid).filter(Boolean);
                            if (osmids.length > 0) {
                                try {
                                    const geojson = await basic.retry(() => overPassCont.getOsmIds(osmids), 5);
                                    if (geojson) poiCont.addGeojson(geojson);
                                } catch (error) {
                                    console.error("cMapMaker.init: Deferred Overpass load failed.", error);
                                }
                            }
                        }

                        poiCont.setActlnglat();
                        await cMapMaker.updateView(initialCategory);
                        if (cMapMaker.openOSMid) await cMapMaker.viewDetail(cMapMaker.openOSMid);
                        if (!Conf.static.use) mapLibre.addCountryFlagsImage(poiCont.getAllOSMCountryCode());
                        console.log("initialize: Deferred activity data loaded.");
                    }).catch((error) => {
                        console.error("cMapMaker.init: Deferred activity data load failed.", error);
                    }).finally(() => {
                        winCont.viewSplash(false);
                    });
                }).catch((e) => {
                    console.error("cMapMaker.init: MapLibre init failed", e);
                    winCont?.viewSplash?.(false);
                });
            }).catch((e) => {
                console.error("cMapMaker.init: initial file load failed", e);
                winCont?.viewSplash?.(false);
            });
    }

    addEvents() {
        mapLibre.on('moveend', this.eventMoveMap.bind(cMapMaker))   		// マップ移動時の処理
        mapLibre.on('zoomend', this.eventZoomMap.bind(cMapMaker))			// ズーム終了時に表示更新
        list_category.addEventListener('change', this.eventChangeCategory.bind(cMapMaker))	// category change
        list_keyword.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault();
            cMapMaker.searchKeyword(list_keyword.value);
        });
    }

    // about Map
    about() {
        let msg = glot.get("about_message");
        msg = msg.replace(/\n/g, "<br>")  // 改行コードを<br>に変換
        msg = "<span class=`fs-5`>" + msg + "</span>"
        mapLibre.viewMiniMap(false)
        winCont.makeDetail({ "title": glot.get("about"), "message": msg, "mode": "close", "menu": false })
        cMapMaker.changeMode("map")
        winCont.setSidebar("view")
    }

    // About license
    licence() {
        let msg = glot.get("licence_message") + glot.get("more_message");
        msg = msg.replace(/\n/g, "<br>")  // 改行コードを<br>に変換
        msg = "<span class=`fs-5`>" + msg + "</span>"
        mapLibre.viewMiniMap(false)
        winCont.makeDetail({ "title": glot.get("licence_title"), "message": msg, "mode": "close", "menu": false });
        cMapMaker.changeMode("map")
        winCont.setSidebar("view")
    }

    changeMode(newmode) {	// mode change(list or map or edit)
        this.mode = newmode ? newmode : (this.mode == "map" ? "list" : "map");
        basic.openAccordion(!["map", "edit"].includes(this.mode) ? "listAccordion" : "detailArea")	// アコーディオン切り替え
        basic.closeAccordion(["map", "edit"].includes(this.mode) ? "listAccordion" : "detailArea")	// アコーディオン切り替え
        if (this.mode == "list") {
            geoCont.writePoiCircle()
            cMapMaker.clearDatail()
        }
        closeDetail.classList.toggle("d-none", this.mode == "list") // 詳細モーダルの閉じるボタンを非表示
    }

    changeMap() {	// Change Map Style(rotation)
        let styleName = mapLibre.changeMap()
        winCont.showMessage(Conf.tile[styleName].name);
        setTimeout(() => {
            this.eventMoveMap()
            let snow = styleName.indexOf("SNOW") > -1;      // SNOWの文字列があれば雪を降らす
            winCont.fallsSnow(snow)
        }, 1000)
    }

    // OverPassキャッシュモード設定
    setCacheMode(mode) {
        let UseCache = overPassCont.useCache(mode)
        globalMessage.innerHTML = glot.get(UseCache ? "UseOVCacheYes" : "UseOVCacheNo");
        setTimeout(() => { globalMessage.innerHTML = "" }, 4000)
    }

    initIndoorControl(urlLevel) {
        if (!Conf.indoor?.use) return;

        const configuredLevels = Conf.indoor.levels?.order ?? [];
        const initialLevel = String(urlLevel ?? Conf.indoor.defaultLevel ?? configuredLevels[0] ?? "0");
        this.indoorLevel = initialLevel;

        if (!Conf.indoor.control?.view) return;
        const label = Conf.indoor.control.label ?? "Floor";
        const control = document.createElement("div");
        control.id = "indoorLevelControl";
        control.className = "indoor-level-control";
        control.setAttribute("role", "group");
        control.setAttribute("aria-label", label);
        control.addEventListener("click", event => {
            const pageButton = event.target.closest("button[data-level-page]");
            if (pageButton) {
                cMapMaker.setIndoorLevelPage(pageButton.dataset.levelPage);
                return;
            }
            const button = event.target.closest("button[data-level]");
            if (!button) return;
            cMapMaker.setIndoorLevel(button.dataset.level);
        });
        this.indoorLevelControlElement = control;
    }

    getPoiZoom(target) {
        const defaultZoom = Conf.poiView?.poiZoom?.[target];
        const isMobile = basic.isSmartPhone()
            || (window.matchMedia && window.matchMedia("(max-width: 640px)").matches);
        const mobileZoom = Conf.poiView?.mobilePoiZoom?.[target];
        return isMobile && mobileZoom !== undefined ? mobileZoom : defaultZoom;
    }

    getIndoorLargeBuildingActivation() {
        const config = Conf.indoor?.largeBuildingActivation ?? {};
        const configuredMinZoom = Number(config.minZoom);
        const configuredReferenceZoom = Number(config.referenceZoom);
        const configuredCoverageRatio = Number(config.viewportCoverageRatio);
        return {
            use: config.use === true,
            minZoom: Number.isFinite(configuredMinZoom) && configuredMinZoom >= 0
                && configuredMinZoom <= 24 ? configuredMinZoom : 17,
            referenceZoom: Number.isFinite(configuredReferenceZoom) && configuredReferenceZoom >= 0
                && configuredReferenceZoom <= 24 ? configuredReferenceZoom : 18,
            viewportCoverageRatio: Number.isFinite(configuredCoverageRatio) && configuredCoverageRatio > 0
                && configuredCoverageRatio <= 10 ? configuredCoverageRatio : 1,
            groupNearbyBuildings: config.groupNearbyBuildings === true
        };
    }

    makeIndoorLevelButtons(levels, selectedLevel = this.indoorLevel, availableLevels = levels) {
        const availableLevelSet = new Set((availableLevels ?? []).map(String));
        const entries = [...new Set(levels.map(String))].map(level => ({
            level,
            osmLevel: Number(level),
            floorNumber: Number(level) + 1
        })).filter(entry => Number.isInteger(entry.osmLevel))
            .sort((a, b) => a.osmLevel - b.osmLevel);
        const makeButton = (entry, buttonLabel = null) => {
            const { level } = entry;
            const label = this.formatIndoorLevel(level);
            const available = availableLevelSet.has(level);
            const selected = available && level === String(selectedLevel);
            if (!available) {
                const unavailableLabel = `${label}（POIなし）`;
                return `<button type="button" class="indoor-level-button" data-level="${level}" disabled`
                    + ` aria-label="${unavailableLabel}" aria-disabled="true" aria-pressed="false"`
                    + ` title="${unavailableLabel}">${buttonLabel ?? label.replace(/F$/, "")}</button>`;
            }
            return `<button type="button" class="indoor-level-button${selected ? " active" : ""}"`
                + ` data-level="${level}" aria-label="${label}" aria-pressed="${selected}" title="${label}">`
                + `${buttonLabel ?? label.replace(/F$/, "")}</button>`;
        };
        const basementEntries = entries.filter(entry => entry.osmLevel < 0);
        const baseEntries = entries.filter(entry => entry.floorNumber >= 1 && entry.floorNumber <= 10);
        const highestOsmLevel = Math.max(0, ...entries.map(entry => entry.osmLevel));
        if (highestOsmLevel < 10 && basementEntries.length === 0) {
            this.indoorLevelPage = "base";
            return `<div class="indoor-level-grid indoor-level-panel" data-level-panel="base">`
                + `${baseEntries.map(entry => makeButton(entry)).join("")}</div>`;
        }

        const entryByLevel = new Map(entries.map(entry => [entry.osmLevel, entry]));
        const highestDecade = Math.floor(highestOsmLevel / 10);
        const decadePages = Array.from({ length: highestDecade }, (_, index) => String(index + 1));
        const availablePages = new Set([
            ...(basementEntries.length > 0 ? ["basement"] : []),
            ...(baseEntries.length > 0 ? ["base"] : []),
            ...decadePages
        ]);
        if (!availablePages.has(String(this.indoorLevelPage))) {
            this.indoorLevelPage = availablePages.has("base") ? "base" : availablePages.values().next().value;
        }
        const makePanel = (page, buttons) => {
            const hidden = String(this.indoorLevelPage) === page ? "" : " hidden";
            return `<div class="indoor-level-grid indoor-level-panel" data-level-panel="${page}"${hidden}>${buttons}</div>`;
        };
        const basementPanel = basementEntries.length > 0
            ? makePanel("basement", basementEntries.map(entry => makeButton(entry)).join("")) : "";
        const basePanel = baseEntries.length > 0
            ? makePanel("base", baseEntries.map(entry => makeButton(entry)).join("")) : "";
        const makePageButton = (page, label, ariaLabel) => {
            const selected = String(this.indoorLevelPage) === page;
            return `<button type="button" class="indoor-level-page-button${selected ? " active" : ""}"`
                + ` data-level-page="${page}" aria-label="${ariaLabel}" aria-pressed="${selected}">${label}</button>`;
        };
        const pageButtons = [
            ...(basementEntries.length > 0 ? [makePageButton("basement", "BF", "地下階を表示")] : []),
            ...(baseEntries.length > 0 ? [makePageButton("base", "0x", "1階から10階を表示")] : [])
        ]
            .concat(decadePages.map(decade => makePageButton(
                decade,
                `${decade}x`,
                `${Number(decade) * 10 + 1}階から${(Number(decade) + 1) * 10}階を表示`
            )))
            .join("");
        const decadePanels = decadePages.map(decade => {
            const firstLevel = Number(decade) * 10;
            const buttons = Array.from({ length: 10 }, (_, digit) => {
                const osmLevel = firstLevel + digit;
                const entry = entryByLevel.get(osmLevel);
                return entry ? makeButton(entry, digit + 1) : "";
            }).join("");
            return makePanel(decade, buttons);
        }).join("");
        return `<div class="indoor-level-layout"><div class="indoor-level-page-buttons">${pageButtons}</div>`
            + `<div class="indoor-level-panels">${basementPanel}${basePanel}${decadePanels}</div></div>`;
    }

    setIndoorLevelPage(page) {
        if (!this.indoorLevelControlElement) return;
        this.indoorLevelPage = String(page);
        this.indoorLevelControlElement.querySelectorAll("button[data-level-page]").forEach(button => {
            const selected = button.dataset.levelPage === this.indoorLevelPage;
            button.classList.toggle("active", selected);
            button.setAttribute("aria-pressed", String(selected));
        });
        this.indoorLevelControlElement.querySelectorAll("[data-level-panel]").forEach(panel => {
            panel.hidden = panel.dataset.levelPanel !== this.indoorLevelPage;
        });
        const panel = this.indoorLevelControlElement.querySelector(
            `[data-level-panel="${this.indoorLevelPage}"]`
        );
        const pageLevels = [...(panel?.querySelectorAll("button[data-level]:not(:disabled)") ?? [])]
            .map(button => button.dataset.level);
        const initialLevel = this.getIndoorPageInitialLevel(this.indoorLevelPage, pageLevels);
        if (initialLevel !== null) this.setIndoorLevel(initialLevel);
    }

    getIndoorPageInitialLevel(page, levels) {
        const numericLevels = [...new Set((levels ?? []).map(Number))]
            .filter(Number.isInteger)
            .sort((a, b) => a - b);
        if (numericLevels.length === 0) return null;
        if (String(page) === "basement") {
            const basementLevels = numericLevels.filter(level => level < 0);
            return basementLevels.length > 0 ? String(basementLevels.at(-1)) : null;
        }
        const pageNumber = String(page) === "base" ? 0 : Number(page);
        if (!Number.isInteger(pageNumber) || pageNumber < 0) return null;
        const firstLevel = pageNumber * 10;
        const pageLevel = numericLevels.find(level => level >= firstLevel && level <= firstLevel + 9);
        return pageLevel === undefined ? null : String(pageLevel);
    }

    getIndoorControlContext(features, targetLists = [], options = {}) {
        if (!mapLibre.map || !Array.isArray(features)) return null;

        const bounds = mapLibre.map.getBounds();
        const viewBounds = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()];
        const center = mapLibre.map.getCenter();
        const getBounds = feature => {
            const coordinates = feature?.geometry?.coordinates;
            if (!coordinates) return null;
            const result = [Infinity, Infinity, -Infinity, -Infinity];
            const visit = value => {
                if (Array.isArray(value) && value.length >= 2
                    && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]))) {
                    const lng = Number(value[0]), lat = Number(value[1]);
                    result[0] = Math.min(result[0], lng);
                    result[1] = Math.min(result[1], lat);
                    result[2] = Math.max(result[2], lng);
                    result[3] = Math.max(result[3], lat);
                    return;
                }
                if (Array.isArray(value)) value.forEach(visit);
            };
            visit(coordinates);
            return result.every(Number.isFinite) ? result : null;
        };
        const intersectsView = bbox => bbox && bbox[0] <= viewBounds[2] && bbox[2] >= viewBounds[0]
            && bbox[1] <= viewBounds[3] && bbox[3] >= viewBounds[1];
        const centerPoint = turf.point([center.lng, center.lat]);
        const containsCenter = ({ feature, bbox }) => {
            if (!bbox || center.lng < bbox[0] || center.lng > bbox[2]
                || center.lat < bbox[1] || center.lat > bbox[3]) return false;
            try {
                return turf.booleanPointInPolygon(centerPoint, feature);
            } catch (_error) {
                return false;
            }
        };
        const distanceFromCenter = bbox => {
            const lng = (bbox[0] + bbox[2]) / 2;
            const lat = (bbox[1] + bbox[3]) / 2;
            const lngScale = Math.cos(center.lat * Math.PI / 180);
            return Math.hypot((lng - center.lng) * lngScale, lat - center.lat);
        };
        const distanceToFeatureMeters = feature => {
            if (!feature?.geometry?.coordinates) return Infinity;
            if (["Polygon", "MultiPolygon"].includes(feature.geometry.type)) {
                try {
                    if (turf.booleanPointInPolygon(centerPoint, feature)) return 0;
                } catch (_error) {
                    // 壊れた形状は座標列からの距離計算へフォールバックする。
                }
            }

            const metersPerDegreeLat = 111320;
            const metersPerDegreeLng = metersPerDegreeLat * Math.cos(center.lat * Math.PI / 180);
            let minimum = Infinity;
            const isCoordinate = value => Array.isArray(value) && value.length >= 2
                && Number.isFinite(Number(value[0])) && Number.isFinite(Number(value[1]));
            const project = coordinate => [
                (Number(coordinate[0]) - center.lng) * metersPerDegreeLng,
                (Number(coordinate[1]) - center.lat) * metersPerDegreeLat
            ];
            const visit = value => {
                if (isCoordinate(value)) {
                    const [x, y] = project(value);
                    minimum = Math.min(minimum, Math.hypot(x, y));
                    return;
                }
                if (!Array.isArray(value)) return;
                if (value.length > 0 && value.every(isCoordinate)) {
                    const points = value.map(project);
                    points.forEach(([x, y]) => { minimum = Math.min(minimum, Math.hypot(x, y)); });
                    for (let index = 1; index < points.length; index++) {
                        const [ax, ay] = points[index - 1];
                        const [bx, by] = points[index];
                        const dx = bx - ax, dy = by - ay;
                        const lengthSquared = dx * dx + dy * dy;
                        const ratio = lengthSquared === 0 ? 0
                            : Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared));
                        minimum = Math.min(minimum, Math.hypot(ax + ratio * dx, ay + ratio * dy));
                    }
                    return;
                }
                value.forEach(visit);
            };
            visit(feature.geometry.coordinates);
            return minimum;
        };
        const bboxDistanceMeters = (left, right) => {
            const lngGap = Math.max(0, left[0] - right[2], right[0] - left[2]);
            const latGap = Math.max(0, left[1] - right[3], right[1] - left[3]);
            const metersPerDegreeLat = 111320;
            const metersPerDegreeLng = metersPerDegreeLat * Math.cos(center.lat * Math.PI / 180);
            return Math.hypot(lngGap * metersPerDegreeLng, latGap * metersPerDegreeLat);
        };
        const getGeometryLines = feature => {
            if (feature?.geometry?.type === "Polygon") return feature.geometry.coordinates ?? [];
            if (feature?.geometry?.type === "MultiPolygon") return (feature.geometry.coordinates ?? []).flat();
            return [];
        };
        const distanceBetweenFeaturesMeters = (left, right) => {
            try {
                if (turf.booleanIntersects(left, right)) return 0;
            } catch (_error) {
                // 壊れた形状は輪郭座標間の距離計算へフォールバックする。
            }
            const metersPerDegreeLat = 111320;
            const metersPerDegreeLng = metersPerDegreeLat * Math.cos(center.lat * Math.PI / 180);
            const project = coordinate => [
                (Number(coordinate[0]) - center.lng) * metersPerDegreeLng,
                (Number(coordinate[1]) - center.lat) * metersPerDegreeLat
            ];
            const pointToSegment = (point, start, end) => {
                const dx = end[0] - start[0], dy = end[1] - start[1];
                const lengthSquared = dx * dx + dy * dy;
                const ratio = lengthSquared === 0 ? 0 : Math.max(0, Math.min(1,
                    ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared));
                return Math.hypot(point[0] - (start[0] + ratio * dx),
                    point[1] - (start[1] + ratio * dy));
            };
            const leftLines = getGeometryLines(left).map(line => line.map(project));
            const rightLines = getGeometryLines(right).map(line => line.map(project));
            let minimum = Infinity;
            leftLines.forEach(leftLine => {
                rightLines.forEach(rightLine => {
                    for (let leftIndex = 1; leftIndex < leftLine.length; leftIndex++) {
                        for (let rightIndex = 1; rightIndex < rightLine.length; rightIndex++) {
                            const leftStart = leftLine[leftIndex - 1], leftEnd = leftLine[leftIndex];
                            const rightStart = rightLine[rightIndex - 1], rightEnd = rightLine[rightIndex];
                            minimum = Math.min(minimum,
                                pointToSegment(leftStart, rightStart, rightEnd),
                                pointToSegment(leftEnd, rightStart, rightEnd),
                                pointToSegment(rightStart, leftStart, leftEnd),
                                pointToSegment(rightEnd, leftStart, leftEnd));
                        }
                    }
                });
            });
            return minimum;
        };

        const buildings = features.flatMap((feature, index) => {
            if (feature?.properties?.building === undefined
                || !["Polygon", "MultiPolygon"].includes(feature?.geometry?.type)) return [];
            const bbox = getBounds(feature);
            return intersectsView(bbox) ? [{
                feature,
                bbox,
                targets: targetLists[index] ?? [],
                index
            }] : [];
        });
        const largeBuildingOnly = options.largeBuildingOnly === true;
        const largeBuildingActivation = options.largeBuildingActivation
            ?? this.getIndoorLargeBuildingActivation();
        const currentZoom = mapLibre.getZoom(false);
        const referenceScale = Math.pow(2,
            largeBuildingActivation.referenceZoom - currentZoom);
        const referenceViewWidth = (viewBounds[2] - viewBounds[0]) / referenceScale;
        const referenceViewHeight = (viewBounds[3] - viewBounds[1]) / referenceScale;
        const isLargeAtReferenceZoom = ({ bbox }) => bbox
            && ((bbox[2] - bbox[0]) >= referenceViewWidth
                * largeBuildingActivation.viewportCoverageRatio
                || (bbox[3] - bbox[1]) >= referenceViewHeight
                * largeBuildingActivation.viewportCoverageRatio);
        const centerBuildings = buildings.filter(containsCenter);
        const centerBuildingCandidates = largeBuildingOnly
            ? centerBuildings.filter(isLargeAtReferenceZoom) : centerBuildings;
        if (largeBuildingOnly && centerBuildingCandidates.length === 0) return null;

        // ズーム17の大型建物判定では、建物サイズが条件を満たしてから屋内POIを走査する。
        const visibleIndoor = features.flatMap((feature, index) => {
            if (feature?.properties?.building !== undefined) return [];
            const bbox = getBounds(feature);
            return intersectsView(bbox) ? [{
                feature,
                bbox,
                targets: targetLists[index] ?? [],
                index
            }] : [];
        });
        const buildingGroup = Conf.indoor?.buildingGroup ?? {};
        const configuredSmallArea = Number(buildingGroup.smallBuildingAreaSquareMeters);
        const smallBuildingArea = Number.isFinite(configuredSmallArea) && configuredSmallArea > 0
            ? configuredSmallArea : 1500;
        const configuredGroupRadius = Number(buildingGroup.groupRadiusMeters);
        const groupRadius = Number.isFinite(configuredGroupRadius) && configuredGroupRadius > 0
            && configuredGroupRadius <= 1000 ? configuredGroupRadius : 50;
        const requireIndoorPoi = buildingGroup.requireIndoorPoi !== false;
        const buildingFeatures = new Map();
        const buildingAreas = new Map();
        const getBuildingId = building => String(building?.feature?.properties?.id
            ?? building?.feature?.id ?? `feature-${building?.index ?? "unknown"}`);
        const getBuildingArea = building => {
            const key = getBuildingId(building);
            if (buildingAreas.has(key)) return buildingAreas.get(key);
            let area = Infinity;
            try { area = turf.area(building.feature); } catch (_error) { /* 対象外 */ }
            buildingAreas.set(key, area);
            return area;
        };
        const getBuildingFeatures = building => {
            const key = getBuildingId(building);
            if (buildingFeatures.has(key)) return buildingFeatures.get(key);
            const matched = visibleIndoor.filter(item => {
                const bbox = item.bbox;
                if (!bbox || bbox[0] > building.bbox[2] || bbox[2] < building.bbox[0]
                    || bbox[1] > building.bbox[3] || bbox[3] < building.bbox[1]) return false;
                try {
                    return turf.booleanIntersects(building.feature, item.feature);
                } catch (_error) {
                    return true;
                }
            });
            buildingFeatures.set(key, matched);
            return matched;
        };
        const hasIndoorPoi = building => !requireIndoorPoi || getBuildingFeatures(building)
            .some(({ targets }) => poiCont.isPoiListVisible(targets));
        const containingBuildings = centerBuildingCandidates.filter(hasIndoorPoi);
        let activeBuilding = null;
        let activeBuildings = [];
        let undergroundMode = false;
        let relevantIndoor = [];

        if (containingBuildings.length > 0) {
            containingBuildings.sort((a, b) => distanceFromCenter(a.bbox) - distanceFromCenter(b.bbox));
            activeBuilding = containingBuildings[0];
        }

        if (activeBuilding) {
            activeBuildings = [activeBuilding];
            if ((!largeBuildingOnly || largeBuildingActivation.groupNearbyBuildings)
                && getBuildingArea(activeBuilding) <= smallBuildingArea) {
                activeBuildings.push(...buildings.filter(building => building !== activeBuilding
                    && getBuildingArea(building) <= smallBuildingArea
                    && bboxDistanceMeters(activeBuilding.bbox, building.bbox) <= groupRadius
                    && distanceBetweenFeaturesMeters(activeBuilding.feature, building.feature) <= groupRadius
                    && hasIndoorPoi(building)));
            }
            const seenIndoor = new Set();
            relevantIndoor = activeBuildings.flatMap(getBuildingFeatures).filter(item => {
                const featureId = item.feature?.properties?.id ?? item.feature?.id;
                const key = featureId === undefined || featureId === null ? item.feature : String(featureId);
                if (seenIndoor.has(key)) return false;
                seenIndoor.add(key);
                return true;
            });
        } else {
            if (largeBuildingOnly) return null;
            const undergroundConfig = Conf.indoor?.underground ?? {};
            if (!undergroundConfig.useWithoutBuilding) return null;
            const configuredRadius = Number(undergroundConfig.activationRadiusMeters);
            const activationRadius = Number.isFinite(configuredRadius) && configuredRadius > 0
                && configuredRadius <= 1000 ? configuredRadius : 60;
            const nearbyIndoorFeatures = visibleIndoor.map(item => ({
                ...item,
                distanceMeters: distanceToFeatureMeters(item.feature)
            }));
            const nearbyUndergroundPoi = nearbyIndoorFeatures.some(({ feature, targets, distanceMeters }) =>
                poiCont.isPoiListVisible(targets) && distanceMeters <= activationRadius
                && this.getIndoorFeatureLevels(feature)
                    .some(level => Number.isInteger(Number(level)) && Number(level) < 0));
            if (!nearbyUndergroundPoi) return null;
            undergroundMode = true;
            // 地下POIは建物輪郭がない場所でモードへ入るためのアンカーにだけ使う。
            // 入った後は、同じ駅・地下街にある地上階のPOIや level 省略の通路も表示対象にする。
            relevantIndoor = nearbyIndoorFeatures.filter(item => {
                if (!item.targets.includes("indoor") || item.distanceMeters > activationRadius) return false;
                const featureLevels = this.getIndoorFeatureLevels(item.feature)
                    .map(Number).filter(Number.isInteger);
                // 建物・モール全体を表す複数階POIは、周囲の全フロアを駅モードへ持ち込むため除外する。
                if (poiCont.isPoiListVisible(item.targets)
                    && new Set(featureLevels).size > 1) return false;
                const isUnderground = featureLevels.some(level => level < 0);
                const isCorridor = item.feature?.properties?.highway === "corridor";
                if (isUnderground || isCorridor) return true;

                // 建物なしモードで、周囲の別ビル内にある地上階POIまで混ぜない。
                return !buildings.some(building => {
                    const bbox = item.bbox;
                    if (!bbox || bbox[0] > building.bbox[2] || bbox[2] < building.bbox[0]
                        || bbox[1] > building.bbox[3] || bbox[3] < building.bbox[1]) return false;
                    try {
                        return turf.booleanIntersects(building.feature, item.feature);
                    } catch (_error) {
                        return true;
                    }
                });
            });
        }
        if (relevantIndoor.length === 0) return null;

        const relevantPoi = relevantIndoor.filter(({ targets }) => poiCont.isPoiListVisible(targets));

        const poiLevelSet = new Set();
        relevantPoi.forEach(({ feature }) => {
            this.getIndoorPoiLevels(feature).forEach(level => {
                const numericLevel = Number(level);
                if (Number.isInteger(numericLevel) && numericLevel >= -100 && numericLevel <= 100) {
                    poiLevelSet.add(numericLevel);
                }
            });
        });
        const poiLevels = [...poiLevelSet].sort((a, b) => a - b);
        const buildingLevelRanges = activeBuildings.map(building => {
            const buildingPoiLevels = getBuildingFeatures(building)
                .filter(({ targets }) => poiCont.isPoiListVisible(targets))
                .flatMap(({ feature }) => this.getIndoorPoiLevels(feature).map(Number))
                .filter(level => Number.isInteger(level) && level >= -100 && level <= 100);
            const buildingLevels = Number(building.feature?.properties?.["building:levels"]);
            const heightText = String(building.feature?.properties?.height ?? "").trim();
            const heightMatch = heightText.match(/^(\d+(?:\.\d+)?)\s*m?$/i);
            const configuredFloorHeight = Number(Conf.indoor?.floorHeightMeters);
            const floorHeight = Number.isFinite(configuredFloorHeight) && configuredFloorHeight > 0
                ? configuredFloorHeight : 3.2;
            const inferredLevels = heightMatch ? Math.ceil(Number(heightMatch[1]) / floorHeight) : 0;
            const heightLevel = Number.isInteger(buildingLevels) && buildingLevels > 0
                && buildingLevels <= 101 ? buildingLevels - 1
                : (inferredLevels > 0 && inferredLevels <= 101 ? inferredLevels - 1 : 0);
            return {
                id: getBuildingId(building),
                min: buildingPoiLevels.length > 0 ? Math.min(0, ...buildingPoiLevels) : 0,
                max: buildingPoiLevels.length > 0
                    ? Math.max(heightLevel, ...buildingPoiLevels) : heightLevel
            };
        });
        let levels = [];
        if (poiLevels.length > 0) {
            const lowestLevel = poiLevels[0];
            const highestLevel = Math.max(poiLevels.at(-1),
                ...buildingLevelRanges.map(range => range.max));
            levels = Array.from(
                { length: highestLevel - lowestLevel + 1 },
                (_, index) => String(lowestLevel + index)
            );
        }
        const anchorBounds = activeBuildings.length > 0 ? activeBuildings.reduce((combined, building) => [
            Math.min(combined[0], building.bbox[0]), Math.min(combined[1], building.bbox[1]),
            Math.max(combined[2], building.bbox[2]), Math.max(combined[3], building.bbox[3])
        ], [Infinity, Infinity, -Infinity, -Infinity]) : relevantIndoor.reduce((combined, item) => [
            Math.min(combined[0], item.bbox[0]), Math.min(combined[1], item.bbox[1]),
            Math.max(combined[2], item.bbox[2]), Math.max(combined[3], item.bbox[3])
        ], [Infinity, Infinity, -Infinity, -Infinity]);
        const horizontalPadding = (viewBounds[2] - viewBounds[0]) * 0.12;
        const verticalPadding = (viewBounds[3] - viewBounds[1]) * 0.08;
        const safeTopPixels = Math.min(112, mapLibre.map.getContainer().clientHeight * 0.25);
        const safeTopLatitude = mapLibre.map.unproject([0, safeTopPixels]).lat;
        const anchor = [
            Math.min(anchorBounds[2], viewBounds[2] - horizontalPadding),
            Math.max(viewBounds[1] + verticalPadding,
                Math.min(anchorBounds[3], viewBounds[3] - verticalPadding, safeTopLatitude))
        ];
        const buildingId = activeBuilding?.feature?.properties?.id ?? activeBuilding?.feature?.id;
        const buildingIds = activeBuildings.map(getBuildingId).sort();
        const contextKey = buildingIds.length > 0 ? `buildings:${buildingIds.join(",")}` : "underground";
        return {
            anchor,
            contextKey,
            levels,
            poiLevels: poiLevels.map(String),
            buildingId: buildingId ? String(buildingId) : null,
            buildingFeature: activeBuilding?.feature ?? null,
            buildingIds,
            buildingFeatures: activeBuildings.map(building => building.feature),
            buildingLevelRanges,
            featureIds: relevantIndoor.map(({ feature }) => feature?.properties?.id ?? feature?.id)
                .filter(id => id !== undefined && id !== null).map(String),
            undergroundMode,
            largeBuildingMode: largeBuildingOnly
        };
    }

    parseIndoorLevels(levelValue) {
        if (levelValue === undefined || levelValue === null || levelValue === "") return [];
        const levels = new Set();

        String(levelValue).split(";").forEach(rawPart => {
            const part = rawPart.trim();
            if (part === "") return;
            const range = part.match(/^(-?\d+(?:\.\d+)?)\s*-\s*(-?\d+(?:\.\d+)?)$/);
            if (!range) {
                levels.add(part);
                return;
            }

            const start = Number(range[1]);
            const end = Number(range[2]);
            if (!Number.isInteger(start) || !Number.isInteger(end) || Math.abs(end - start) > 100) {
                levels.add(range[1]);
                levels.add(range[2]);
                return;
            }

            const step = start <= end ? 1 : -1;
            for (let level = start; level !== end + step; level += step) levels.add(String(level));
        });
        return [...levels];
    }

    getIndoorFeatureLevels(feature) {
        const tags = feature?.properties ?? {};
        const explicitLevels = [...new Set([
            ...this.parseIndoorLevels(tags.level),
            ...this.parseIndoorLevels(tags.repeat_on)
        ])];
        if (explicitLevels.length > 0) return explicitLevels;

        const fallbackLevels = Conf.indoor?.fallbackLevels ?? {};
        for (const [tagExpression, fallbackLevel] of Object.entries(fallbackLevels)) {
            const separator = tagExpression.indexOf("=");
            if (separator < 1) continue;
            const key = tagExpression.slice(0, separator);
            const value = tagExpression.slice(separator + 1);
            if (String(tags[key] ?? "") === value) return this.parseIndoorLevels(fallbackLevel);
        }
        return [];
    }

    getIndoorPoiLevels(feature) {
        const levels = this.getIndoorFeatureLevels(feature);
        return levels.length > 0 ? levels : ["0"];
    }

    isIndoorBuildingOutlineVisible(feature, level = this.indoorLevel) {
        if (!this.indoorModeActive) return false;
        const featureId = feature?.properties?.id ?? feature?.id;
        if (featureId === undefined || featureId === null
            || !(this.indoorBuildingIds instanceof Set)
            || !this.indoorBuildingIds.has(String(featureId))) return false;
        const numericLevel = Number(level);
        const range = this.indoorBuildingLevelRanges instanceof Map
            ? this.indoorBuildingLevelRanges.get(String(featureId)) : null;
        if (!range || !Number.isInteger(numericLevel)) return true;
        return numericLevel >= range.min && numericLevel <= range.max;
    }

    isPoiVisibleInIndoorMode(poi) {
        if (!this.indoorModeActive) return true;
        if (!poi || !Array.isArray(poi.lnglat)) return false;

        if (Array.isArray(this.indoorBuildingFeatures) && this.indoorBuildingFeatures.length > 0) {
            try {
                const point = turf.point(poi.lnglat);
                if (!this.indoorBuildingFeatures.some(feature =>
                    turf.booleanPointInPolygon(point, feature))) return false;
            } catch (_error) {
                return false;
            }
        } else {
            const featureId = poi.geojson?.properties?.id ?? poi.geojson?.id;
            if (!(this.indoorContextFeatureIds instanceof Set)
                || !this.indoorContextFeatureIds.has(String(featureId))) return false;
        }

        const levels = this.getIndoorPoiLevels(poi.geojson);
        return levels.includes(String(this.indoorLevel));
    }

    formatIndoorLevel(levelValue) {
        const levels = this.parseIndoorLevels(levelValue);
        const labels = Conf.indoor?.levels?.labels ?? {};
        return levels.map(level => {
            if (labels[level] !== undefined) return labels[level];
            const number = Number(level);
            if (!Number.isFinite(number)) return level;
            return number >= 0 ? `${number + 1}F` : `B${Math.abs(number)}F`;
        }).join(" / ");
    }

    syncIndoorLevelControl(features, targetLists = []) {
        if (!Conf.indoor?.levels?.discoverFromData) return;
        if (!this.indoorLevelControlElement) return;
        const indoorZoom = this.getPoiZoom("indoor") ?? 18;
        const currentZoom = mapLibre.getZoom(false);
        const largeBuildingActivation = this.getIndoorLargeBuildingActivation();
        const largeBuildingOnly = largeBuildingActivation.use
            && currentZoom < indoorZoom
            && currentZoom >= largeBuildingActivation.minZoom;
        if (currentZoom < indoorZoom && !largeBuildingOnly) {
            this.leaveIndoorMode();
            return;
        }

        const context = this.getIndoorControlContext(features, targetLists, {
            largeBuildingOnly,
            largeBuildingActivation
        });
        if (!context) {
            this.leaveIndoorMode();
            return;
        }
        const wasIndoorModeActive = this.indoorModeActive;
        const enteringIndoor = !wasIndoorModeActive;
        const contextChanged = this.indoorContextKey !== context.contextKey;
        this.indoorModeActive = true;
        this.indoorContextKey = context.contextKey;
        this.indoorBuildingId = context.buildingId;
        this.indoorBuildingFeature = context.buildingFeature;
        this.indoorBuildingIds = new Set(context.buildingIds ?? []);
        this.indoorBuildingFeatures = context.buildingFeatures ?? [];
        this.indoorBuildingLevelRanges = new Map((context.buildingLevelRanges ?? [])
            .map(range => [String(range.id), { min: Number(range.min), max: Number(range.max) }]));
        this.indoorContextFeatureIds = new Set(context.featureIds ?? []);
        this.indoorUndergroundMode = context.undergroundMode === true;
        this.indoorRenderMinZoom = context.largeBuildingMode
            ? largeBuildingActivation.minZoom : indoorZoom;
        if (enteringIndoor || contextChanged) {
            const mode = this.indoorUndergroundMode ? "underground"
                : (context.largeBuildingMode ? "large-building"
                    : `building-group:${this.indoorBuildingIds.size}`);
            console.log(`cMapMaker: Indoor mode (${mode}).`);
            if (enteringIndoor) {
                this.indoorLevel = String(Conf.indoor.defaultLevel ?? "0");
                this.indoorLevelPage = "base";
                this.updateIndoorLevelUrl();
            }
        }
        if (context.levels.length === 0) {
            mapLibre.hideIndoorLevelControl();
            return;
        }
        if (!context.poiLevels.includes(String(this.indoorLevel))) this.indoorLevel = context.poiLevels[0];
        this.indoorLevelControlElement.innerHTML = this.makeIndoorLevelButtons(
            context.levels,
            this.indoorLevel,
            context.poiLevels
        );
        mapLibre.setIndoorLevelControl(this.indoorLevelControlElement);
    }

    leaveIndoorMode() {
        this.indoorModeActive = false;
        this.indoorContextKey = null;
        this.indoorBuildingId = null;
        this.indoorBuildingFeature = null;
        this.indoorBuildingIds = new Set();
        this.indoorBuildingFeatures = [];
        this.indoorBuildingLevelRanges = new Map();
        this.indoorContextFeatureIds = null;
        this.indoorUndergroundMode = false;
        this.indoorRenderMinZoom = null;
        mapLibre.hideIndoorLevelControl();
    }

    setIndoorLevel(level, updateUrl = true) {
        if (!Conf.indoor?.use) return;
        this.indoorLevel = String(level);
        if (this.indoorLevelControlElement) {
            this.indoorLevelControlElement.querySelectorAll("button[data-level]").forEach(button => {
                const selected = button.dataset.level === this.indoorLevel;
                button.classList.toggle("active", selected);
                button.setAttribute("aria-pressed", String(selected));
            });
        }
        this.viewIndoor();
        this.viewPoi(listTable.getSelCategory());

        if (this.openOSMid) {
            const openPoi = poiCont.get_osmid(this.openOSMid);
            const openLevels = openPoi ? this.getIndoorPoiLevels(openPoi.geojson) : [];
            if (openPoi?.targets?.includes("indoor") && !openLevels.includes(this.indoorLevel)) {
                this.clearDatail();
            }
        }

        if (updateUrl) this.updateIndoorLevelUrl();
    }

    updateIndoorLevelUrl() {
        if (!Conf.indoor.control?.urlParameter || this.indoorLevel === null) return;
        const parameter = Conf.indoor.control.urlParameter;
        const params = location.search.slice(1).split("&")
            .filter(Boolean)
            .filter(param => decodeURIComponent(param.split("=")[0]) !== parameter);
        params.push(`${encodeURIComponent(parameter)}=${encodeURIComponent(this.indoorLevel)}`);
        history.replaceState("", "", location.pathname + "?" + params.join("&") + location.hash);
    }

    withIndoorLevel(pathAndQuery) {
        if (!Conf.indoor?.use || !Conf.indoor.control?.urlParameter || this.indoorLevel === null) return pathAndQuery;
        const separator = pathAndQuery.includes("?") ? "&" : "?";
        return `${pathAndQuery}${separator}${encodeURIComponent(Conf.indoor.control.urlParameter)}=${encodeURIComponent(this.indoorLevel)}`;
    }

    viewIndoor() {
        if (!Conf.indoor?.use || Conf.osm?.indoor?.expression?.renderer !== "indoor") return;
        const pois = poiCont.getPois("indoor", false);
        const controlPois = poiCont.getPois("-", false);
        this.syncIndoorLevelControl(controlPois.geojson, controlPois.targets);
        mapLibre.addIndoor({ "type": "FeatureCollection", "features": pois.geojson }, "indoor", this.indoorLevel);
    }

    setVisitedFilter(visitedFilterStatus) {
        console.log(`cMapMaker: setVisitedFilter: ${visitedFilterStatus}`);
        this.visitedFilterStatus = visitedFilterStatus;
        this.updateView();
    }

    toggleFavoriteFilter(checked) {
        console.log(`cMapMaker: toggleFavoriteFilter: ${checked}`);
        this.favoriteFilter = checked;
        this.updateView();
    }

    viewArea() {			// Area(敷地など)を表示させる refタグがあれば()表記
        let targets = poiCont.getTargets()  //
        console.log("viewArea: " + targets.join())
        targets.forEach((target) => {
            let osmConf = Conf.osm[target] == undefined ? { expression: { viewArea: true } } : Conf.osm[target]
            if (osmConf.expression.viewArea) {   // viewArea: trueが対象
                let pois = poiCont.getPois(target, false)
                if (osmConf.expression.renderer === "indoor") {
                    const controlPois = poiCont.getPois("-", false);
                    this.syncIndoorLevelControl(controlPois.geojson, controlPois.targets);
                    mapLibre.addIndoor({ "type": "FeatureCollection", "features": pois.geojson }, target, this.indoorLevel);
                    return;
                }
                let titleTag = "";
                if (!osmConf.expression.poiView) {  // poiViewがfalseの時(true時はpoiView側で表示するため)
                    titleTag = ["format", ["case", ["all", ["has", "ref"], ["!=", ["get", "ref"], ""]],
                        ["case", ["has", "local_ref"],
                            ["concat", "(", ["get", "ref"], "/", ["get", "local_ref"], ") ", ["coalesce", ["get", "name"], ""]],
                            ["concat", "(", ["get", "ref"], ") ", ["coalesce", ["get", "name"], ""]]
                        ], ["coalesce", ["get", "name"], ""]
                    ], {}];
                }
                mapLibre.addPolygon({ "type": "FeatureCollection", "features": pois.geojson }, target, titleTag)
            }
        })
    }

    viewPoi(targets) {		// Poiを表示させる
        let nowselect = listTable.getSelCategory()          // tags,key=valueの複数値
        nowselect = nowselect[0] == "" ? "-" : nowselect[nowselect.length - 1]
        //console.log(`viewPoi: Start(now select ${nowselect}).`)
        targets = targets[0] == "-" || targets[0] == "" ? poiCont.getTargets() : targets;		// '-' or ''はすべて表示
        targets = targets.filter(target => {                                                    // poiView=trueのみ返す
            return Conf.osm[target] !== undefined ? Conf.osm[target].expression.poiView : false;
        })
        targets = Object.keys(Conf.poiView.poiZoom).indexOf("activity") > -1 ? targets.concat("activity") : targets;
        targets = Conf.etc.editMode ? targets.concat(Object.keys(Conf.poiView.editZoom)) : targets	// 編集時はeditZoom追加
        targets = [...new Set(targets)];    // 重複削除
        //poiCont.setPoi(listTable.getFilterList(), false)

        let subcategory = poiCont.getTargets().indexOf(nowselect) > -1 || nowselect == "-" ? false : true;	// サブカテゴリ選択時はtrue
        if (subcategory) {	// targets 内に選択肢が含まれていない場合（サブカテゴリ選択時）
            poiCont.setPoi(listTable.getFilterList(), false)
        } else {			// targets 内に選択肢が含まれている場合
            let nowzoom = mapLibre.getZoom(false)
            //targets = targets.filter(target => target !== "activity");  // activiyがあれば削除 // 2025/08/20 一旦false
            targets = targets.filter(s => s !== "");
            if (nowselect === "-") {
                poiCont.setPoi(listTable.getFilterList(), false) //nowselect == Conf.google.targetName) // 2025/08/20 一旦false
            } else {
                for (let target of targets) {
                    console.log("viewPoi: " + target)
                    let poiView = Conf.google.targetName == target ? true : Conf.osm[target].expression.poiView	// activity以外はexp.poiViewを利用
                    let flag = nowzoom >= this.getPoiZoom(target) || (Conf.etc.editMode && nowzoom >= Conf.poiView.editZoom[target])
                    if ((target == nowselect) && flag && poiView) {	// 選択している種別の場合
                        poiCont.setPoi(listTable.getFilterList(), false) // target == Conf.google.targetName) // 2025/08/20 一旦false
                        break
                    }
                }
            }
        }
    }

    // 画面内のActivity画像を表示させる(view: true=表示)
    makeImages(view) {
        if (view) {
            let acts = []
            const filteredRows = listTable.getFilterList();
            const rowsKey = filteredRows.map((row) => row[0]).join("\u0000");
            if (rowsKey !== this.thumbnailRowsKey) {
                this.thumbnailRowsKey = rowsKey;
                this.thumbnailRows = basic.shuffleArray(filteredRows.slice());
            }
            const rows = this.thumbnailRows;
            rows.forEach(row => {
                let act = poiCont.get_actid(row[0])
                if (act !== undefined) {
                    let urls = []
                    let actname = act.id.split("/")[0]
                    if (Conf.activities[actname] !== undefined) {
                        let forms = Conf.activities[actname].form
                        for (const key of Object.keys(forms)) { // 複数あっても一つだけとする
                            if (forms[key].type === "image_url") { urls.push(act[key]); break }
                        }
                    } else {
                        console.warn("cMapmaker.makeImage: No Activity Name");
                    }
                    acts.push({ "src": urls, "osmid": act.osmid, "title": act.title })
                }
            })
            if (acts.length > 0) {
                images.classList.remove("d-none");
                winCont.setImages(images, acts, Conf.etc.loadingUrl, Conf.thumbnail.limits)
                requestAnimationFrame(() => {
                    const imageHeight = images.offsetHeight;
                    dummy.style.height = imageHeight + "px";	// 画像表示領域の高さをダミーに設定
                });
                if (this.scrollHints == 0) winCont.scrollHint(); this.scrollHints++;
            } else {
                winCont.disconnectImageObserver();
                images.classList.add("d-none");
            }
        } else {
            winCont.disconnectImageObserver();
            images.classList.add("d-none");
        }
    }

    // OSMとGoogle SpreadSheetからPoiを取得してリスト化
    updateOsmPoi(targets) {
        return new Promise((resolve) => {
            console.log("cMapMaker: updateOsmPoi: Start");
            winCont.spinner(true);
            var keys = (targets !== undefined && targets !== "") ? targets : poiCont.getTargets();
            let PoiLoadZoom = 99;
            for (let key of Object.keys(Conf.poiView.poiZoom)) {
                const value = this.getPoiZoom(key);
                if (key !== Conf.google.targetName) PoiLoadZoom = value < PoiLoadZoom ? value : PoiLoadZoom;
            };
            if (Conf.etc.editMode) {
                for (let [key, value] of Object.entries(Conf.poiView.editZoom)) {
                    if (key !== Conf.google.targetName) PoiLoadZoom = value < PoiLoadZoom ? value : PoiLoadZoom;
                }
            }
            if ((mapLibre.getZoom(true) < PoiLoadZoom)) {
                winCont.spinner(false);
                console.log("[success]cMapMaker: updateOsmPoi End(more zoom).");
                resolve({ "update": true });
            } else {
                overPassCont.getGeojson(keys, status_write).then(ovanswer => {
                    winCont.spinner(false);
                    if (ovanswer) {
                        poiCont.addGeojson(ovanswer)
                        poiCont.setActlnglat()
                    };
                    console.log("[success]cMapMaker: updateOsmPoi End.");
                    globalMessage.innerHTML = "";
                    resolve({ "update": true });
                }).catch(() => {
                    winCont.spinner(false);
                    console.log("[error]cMapMaker: updateOsmPoi end.");
                    globalMessage.innerHTML = "";
                    resolve({ "update": false });
                });
            }
        })

        function status_write(progress) {
            const message = document.createElement("div");
            message.innerHTML = "Loading... " + parseInt(progress / 1024) + "KByte";
            globalMessage.appendChild(message);
            while (globalMessage.children.length > 5) {
                globalMessage.removeChild(globalMessage.firstChild);
            }
        }
    }

    // OSMデータを取得して画面表示
    updateView(cat) {
        console.log("updateView Start.")
        const requestId = ++this.updateViewRequestId;
        return new Promise((resolve) => {
            this.updateOsmPoi().then((status) => {
                if (requestId !== this.updateViewRequestId) {
                    console.log("updateView: Ignore stale response.");
                    resolve({ "update": false, "stale": true });
                    return;
                }
                switch (status.update) {
                    case true:
                        let targets = listTable.getSelCategory();
                        targets = (targets[0] == '' && cat !== undefined) ? [cat] : targets;
                        listTable.makeList()
                        listTable.makeSelectList(Conf.listTable.category)
                        listTable.selectCategory(targets)
                        listTable.filterByPoiStatus(this.visitedFilterStatus, this.favoriteFilter);
                        if (window.getSelection) window.getSelection().removeAllRanges()
                        this.makeImages(Conf.thumbnail.use)
                        this.viewArea()	        // 入手したgeoJsonを追加
                        this.viewPoi(targets)	// in targets
                        resolve({ "update": true })
                        break
                    default:
                        console.log("updateView Error.")
                        resolve({ "update": false })
                        break
                }
            }).catch((error) => {
                console.warn("cMapMaker.updateView failed", error);
                resolve({ "update": false, "error": true });
            })
        })
    }

    // キーワード検索
    searchKeyword(keyword) {
        if (keyword !== null) {
            const div = document.createElement("div");             // サニタイズ処理
            div.appendChild(document.createTextNode(keyword));
            this.changeMode('list')
            setTimeout(() => { listTable.filterKeyword(div.innerHTML) }, 300)
        }
    }

    // 詳細モーダル表示
    viewDetail(osmid, openid) {	// PopUpを表示(marker,openid=actlst.id)]
        console.log("viewDatail: Start");

        return new Promise((resolve, reject) => {
            const makeFlag = (country) => {     // 旗アイコンを追加
                if (country == undefined) return ""
                let title = "", countries = country.split(";")
                countries.forEach(CCode => { title += `<img src="https://flagcdn.com/h20/${CCode.toLowerCase()}.png" class="ms-1 me-1" height="16" alt="${CCode} Flag">` })
                return title
            }

            const makeDatail = (osmid, openid) => {
                if (osmid == "" || osmid == undefined) {    // OSMIDが空の時はクリアして終了
                    cMapMaker.clearDatail()
                    geoCont.writePoiCircle()
                    resolve()
                    return
                }

                winCont.setSidebar("view").then(() => {
                    console.log("viewDatail: Get OSM Data.");
                    let osmobj = poiCont.get_osmid(osmid);
                    if (osmobj == undefined) { console.log("Error: No osmobj / ID: " + osmid); reject(); return }	// Error

                    let tags = osmobj.geojson.properties;
                    let target = osmobj.targets[0];
                    tags["*"] = "*";
                    target = target == undefined ? "*" : target;			// targetが取得出来ない実在POI対応
                    let category = poiCont.getCatnames(tags);
                    let flagsHTML = makeFlag(tags.country);
                    if (flagsHTML !== "") { // 国旗がある場合はminiMapを設定してHTML追加
                        mapLibre.addMiniMap()
                            .then(() => {
                                flags.innerHTML = flagsHTML;
                                mapLibre.showCountryByCode(tags.country);
                            })
                            .catch((e) => {
                                console.warn("cMapMaker.viewDetail: addMiniMap failed", e);
                            });
                    }

                    let title = `<img src="./${Conf.icon.fgPath}/${poiCont.getIcon(tags)}" class="ms-1 me-1" height="28">`
                    let message = "";
                    let name = poiCont.getOSMname(tags, glot.lang);
                    name = name == "" ? poiCont.getCatnames(tags)[0] : name;   // 名前がある場合は「: 名前」とする
                    title += name;

                    if (title == "") title = category[0] + category[1] !== "" ? "(" + category[1] + ")" : "";   // サブカテゴリ時は追加
                    if (title == "") title = glot.get("undefined");
                    winCont.menu_make(Conf.menu.modal, "btnMenu");
                    winCont.setProgress(0);

                    console.log("viewDatail: Make OSM Basic Info.");
                    message += osmBasic.make(tags);		// append OSM Tags(仮…テイクアウトなど判別した上で最終的には分ける)
                    if (tags.wikipedia !== undefined) {
                        message += wikimedia.makeWikipediaOverView(tags.wikipedia)
                    }

                    // append activity
                    let catname = listTable.getSelCategory() !== "-" ? `&category=${listTable.getSelCategory()}` : "";
                    let actlists = poiCont.getActlistByOsmid(osmid);
                    const detailUrl = this.withIndoorLevel(location.pathname + "?" + osmid + (!openid ? "" : "." + openid) + catname);
                    history.replaceState('', '', detailUrl + location.hash);
                    if (actlists.length > 0) {	// アクティビティ有り
                        message += modalActs.make(actlists);
                        winCont.makeDetail({ "title": title, "message": message, "append": Conf.menu.activities, "menu": true, "openid": openid });
                    } else {					// アクティビティ無し
                        winCont.makeDetail({ "title": title, "message": message, "append": Conf.menu.activities, "menu": true, "openid": openid });
                    }
                    mapLibre.viewMiniMap(tags.country)
                    cMapMaker.changeMode("map")
                    this.detail = true
                    this.openOSMid = osmid
                    const element = document.getElementById('btmHeader');
                    element.scrollTo({ top: 0, behavior: 'smooth' });
                    resolve()
                })
            }

            if (this.mode == "edit") {    // 編集モード時は閉じるか確認する
                winCont.confirm({
                    title: glot.get("confirmCloseTitle"),
                    message: glot.get("confirmCloseDetail"),
                    callback: (answer) => {
                        if (answer) {
                            cMapMaker.clearDatail()
                            this.loadDetailLibraries()
                                .then(() => makeDatail(osmid, openid))
                                .catch((error) => {
                                    console.warn("viewDetail: Failed to load detail libraries.", error);
                                    reject(error);
                                });
                        } else {
                            console.log("viewDatail: Cancel.");
                            reject()
                        }
                    }
                });
            } else {
                this.loadDetailLibraries()
                    .then(() => makeDatail(osmid, openid))
                    .catch((error) => {
                        console.warn("viewDetail: Failed to load detail libraries.", error);
                        reject(error);
                    });
            }
        })
    }

    clearDatail() {
        const visited = document.getElementById("visited")
        const favorite = document.getElementById("favorite")
        const memo = document.getElementById("visited-memo")
        const mmap = document.getElementById("mini-map")
        const menu = document.getElementById("btnMenu")
        const detailMenu = document.getElementById("detailMenu")
        if (Conf.etc.localSave !== "" && visited !== null) {    // 訪問機能が有効＆訪問済みチェックの場合
            poiStatusCont.setValueByOSMID(visited.name, visited.checked, favorite.checked, memo.value)
            cMapMaker.eventMoveMap()                            // アイコン表示を更新
        }
        mmap.classList.add("d-none")
        detailMenu.classList.add("d-none")

        const catname = listTable.getSelCategory() !== "-" ? `?category=${listTable.getSelCategory()}` : ""
        history.replaceState('', '', this.withIndoorLevel(location.pathname + catname) + location.hash)
        this.openOSMid = null
        this.detail = false
        btmWindow_title.innerHTML = ""
        btmWindow_message.innerHTML = ""
        return winCont.setSidebar()
    }

    shareURL(actid) {	// URL共有機能
        actid = actid == undefined ? "" : "." + actid;
        let url = location.origin + location.pathname + location.search + actid + location.hash;
        navigator.clipboard.writeText(url);
    }

    playback() {		// 指定したリストを連続再生()
        const view_control = (list, idx) => {
            if (list.length >= (idx + 1)) {
                listTable.select(list[idx][0]);
                poiCont.select(list[idx][0], false);
                if (this.status == "playback") {
                    setTimeout(view_control, speed_calc(), list, idx + 1);
                };
            } else {
                listTable.disabled(false);
                listTable.heightSet(listTable.height + "px");	// mode end
                this.status = "normal";							// mode stop
                icon_change("play");
            }
        }
        const icon_change = (mode) => { list_playback.className = 'fas fa-' + mode };
        const speed_calc = () => { return ((parseInt(list_speed.value) / 100) * Conf.listTable.playback.timer) + 100 };
        if (this.status !== "playback") {
            listTable.disabled(true);
            listTable.heightSet(listTable.height / 4 + "px");
            mapLibre.setZoom(Conf.listTable.playback.zoomLevel);
            this.changeMode("list");
            this.status = "playback";
            icon_change("stop");
            setTimeout(view_control, speed_calc(), listTable.getFilterList(), 0);
        } else {
            listTable.disabled(false);
            listTable.heightSet(listTable.height + "px");		// mode end
            this.status = "normal";								// mode stop
            icon_change("play");
        }
    }

    download() {
        const linkid = "temp_download";

        const originalLists = listTable.getFilterList();

        if (originalLists.length == 0) {
            globalMessage.innerHTML = glot.get("noDataDownload");
            setTimeout(() => { globalMessage.innerHTML = ""; }, 4000);
        } else {
            // 元データを壊さないように、行ごとコピーする
            const lists = originalLists.map((list) => [...list]);

            for (let list of lists) { list.push(...poiCont.getLnglatbyId(list[0])); }

            // ヘッダーもコピーして追加
            lists.unshift([...Conf.listTable.csvColumn]);
            const csv = basic.makeArray2CSV(lists);
            const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
            const blob = new Blob([bom, csv], { type: "text/csv" });
            const link = document.getElementById(linkid) ? document.getElementById(linkid) : document.createElement("a");
            link.id = linkid;
            link.href = URL.createObjectURL(blob);
            link.download = "my_data.csv";
            link.dataset.downloadurl = ["text/plain", link.download, link.href].join(":");
            document.body.appendChild(link);
            link.click();
            URL.revokeObjectURL(link.href);
        }
        return;
    }

    // EVENT: イメージを選択した時のイベント処理
    eventViewThumb(imgdom) {
        console.log("eventViewThumb: Start.");

        const osmid = imgdom.getAttribute("osmid");
        const poi = poiCont.get_osmid(osmid);
        const zoomlv = Math.max(mapLibre.getZoom(true), Conf.map.detailZoom);

        if (zoomlv === undefined) console.log("No " + Conf.map.detailZoom);
        if (poi === undefined) return;

        cMapMaker.viewDetail(osmid).then(() => {
            if (poi.geojson !== undefined) geoCont.flashPolygon(poi.geojson);
            mapLibre.flyTo(poi.lnglat, zoomlv);
            console.log("eventViewThumb: View OK.");
        }).catch((e) => {
            console.warn("cMapMaker.eventViewThumb: failed", e);
        })
    }

    // EVENT: map moveend発生時のイベント
    eventMoveMap() {
        if (cMapMaker.status !== "normal") return;
        if (cMapMaker.moveMapBusy) {
            cMapMaker.moveMapPending = true;
            console.log("eventMoveMap: Queue latest move.");
            return;
        }
        //console.log("eventMoveMap: Start. ");
        cMapMaker.moveMapBusy = true;
        cMapMaker.moveMapPending = false;

        const zoom = mapLibre.getZoom(false);
        const indoorZoom = this.getPoiZoom("indoor") ?? 18;
        if (zoom < indoorZoom) this.leaveIndoorMode();
        const zoomLevels = Object.keys(Conf.poiView.poiZoom).map(target => this.getPoiZoom(target));
        if (Conf.etc.editMode) zoomLevels.push(...Object.values(Conf.poiView.editZoom))
        const poizoom = zoomLevels.some(level => zoom >= level);

        if (!poizoom) {
            console.log("eventMoveMap: Cancel(Busy or MoreZoom).");
            this.makeImages(false);                             // イメージリストを非表示
            cMapMaker.moveMapBusy = false
            return;
        }
        //cMapMaker.updateView().then(() => cMapMaker.moveMapBusy = false)
        cMapMaker.updateView()
            .catch((e) => {
                console.warn("cMapMaker.eventMoveMap: updateView failed", e);
            })
            .finally(() => {
                cMapMaker.moveMapBusy = false;
                if (!cMapMaker.moveMapPending) return;
                cMapMaker.moveMapPending = false;
                console.log("eventMoveMap: Replay queued move.");
                setTimeout(() => cMapMaker.eventMoveMap(), 0);
            });
    }

    // EVENT: カテゴリ変更時のイベント
    eventChangeCategory() {
        list_keyword.value = "";
        let catname, selcategory = listTable.getSelCategory()
        console.log("eventChange: " + selcategory)
        const listAccordion = document.getElementById("listAccordion")
        if (listAccordion && !listAccordion.classList.contains("show")) {
            basic.openAccordion("listAccordion")
        }
        switch (Conf.selectItem.action) {
            case "ChangeMap":                               // 背景地図切り替え
                mapLibre.changeMap(list_category.value)
                break;
            case "ChangePoi":
                cMapMaker.updateView()
                break;
        }
        catname = selcategory !== "-" ? `?category=${selcategory}` : ""
        history.replaceState('', '', this.withIndoorLevel(location.pathname + catname) + location.hash)
        cMapMaker.clearDatail()
        geoCont.writePoiCircle()
        mapLibre.map.redraw()

    }

    // EVENT: View Zoom Level & Status Comment
    eventZoomMap() {
        let morezoom = 0;
        for (let key of Object.keys(Conf.poiView.poiZoom)) {
            const value = this.getPoiZoom(key);
            morezoom = value >= morezoom ? value : morezoom
        }
        if (Conf.etc.editMode) {
            for (let [key, value] of Object.entries(Conf.poiView.editZoom)) {
                morezoom = value >= morezoom ? value : morezoom
            }
        }
        let poizoom = mapLibre.getZoom(true) >= morezoom ? false : true
        let message = `${glot.get("zoomlevel")}${mapLibre.getZoom(true)} `
        if (poizoom) {
            message += `(${glot.get("morezoom")})`
            cMapMaker.changeMode("list")    // ズームレベルがpoi表示の閾値以下の時はリストを開く
            cMapMaker.clearDatail()         // 詳細画面を閉じる
        }
        globalMessage.innerHTML = message
    }
}
const cMapMaker = new CMapMaker();
