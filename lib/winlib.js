// Window Control(progress&message)
class WinCont {
    constructor() {
        this.splashObj;
        this.detail = false;				// viewDetail表示中はtrue
        this.sidebarSize = 0;
        this.snowAnimId = null;
        this.yesNoObj;
        this.imageObserver = null;
        this.sidebarResizeInitialized = false;
        this.sidebarWidthRatio = null;
        this.sidebarHeightRatio = null;
        this.sidebarResizeFrame = null;
    }

    playback(view) {
        let display = view ? "remove" : "add";
        list_playback_control.classList[display]("d-none");
    }

    download(view) {
        let display = view ? "remove" : "add";
        list_download.classList[display]("d-none");
    }

    viewSplash(mode) {
        if (window !== window.parent) return;
        const modalEl = document.getElementById('splashImage');
        const splashSrc = document.getElementById('splashSrc'); // 実際のIDに合わせてください
        const modal = bootstrap.Modal.getOrCreateInstance(modalEl, { backdrop: "static", keyboard: false });

        if (mode) {
            splashSrc.setAttribute("src", window.withAppAssetVersion(Conf.etc.splashUrl));
            modal.show();
            this.splashObj = modal;
        } else {
            // モーダル内にフォーカスが残っていたら、閉じる前に外へ逃がす
            if (modalEl.contains(document.activeElement)) document.activeElement.blur();
            modal.hide();
            this.splashObj = modal;
        }
    }

    spinner(view) {
        try {
            let display = view ? "remove" : "add";
            globalSpinner.classList[display]("d-none");
            image_spinner.classList[display]("d-none");
        } catch (error) {
            console.log("no spinner");
        }
    }

    scrollHint() {
        if (images.scrollWidth > images.clientWidth) {
            console.log("scrollHint: Start.");
            const rect = images.getBoundingClientRect();            // 対象要素の座標を取得
            scrollHand.style.top = `${rect.top + window.scrollY + rect.height / 2 - 8}px`;
            scrollHand.style.animation = "swing 0.8s infinite";
            scrollHand.classList.remove("d-none")
            setTimeout(() => {
                scrollHand.classList.add("d-none")
                console.log("scrollHint: End.");
            }, 2000); // フェードアウト後の待機時間を追加
        }
    }

    // open modal window(p: title,message,append,openid)
    // append: append button(Conf.menu.modalButton)
    makeDetail(p) {
        document.getElementById("btmWindow_title").innerHTML = p.title;
        document.getElementById("btmWindow_message").innerHTML = p.message;

        winCont.setProgress(0);
        let chtml = "";
        if (p.append !== undefined) {
            p.append.forEach((p) => {        // append button
                let glotName = glot.get(p.btn_glot_name)
                if (p.editMode == Conf.etc.editMode || p.editMode == undefined) {
                    chtml += `<div class="col-12 text-center"><button class="${p.btn_class}" onclick="${p.code}"><i class="${p.icon_class}"></i>`;
                    chtml += ` ${glotName == null ? "" : glotName}</button></div>`;
                }
            })
        }
        btmWindow_message.insertAdjacentHTML("beforeend", chtml);
        const detailMenu = document.getElementById("detailMenu")
        detailMenu.classList.remove("d-none")
        if (p.openid !== undefined) {
            let act = document.getElementById(p.openid.replace("/", ""));
            if (act !== null) act.scrollIntoView(); // 指定したidのactivityがあればスクロール
        }
    }

    // 「はい」「いいえ」を質問するモーダル
    // p: title,message,yesText,noText,callback,yesClass,noClass
    confirm(p = {}) {
        return new Promise((resolve) => {
            const glotText = (key, fallback) => {
                if (typeof glot !== "undefined" && typeof glot.get === "function") {
                    const text = glot.get(key);
                    return text == null ? fallback : text;
                }
                return fallback;
            };

            const modalId = "yesNoModal";
            let modalEl = document.getElementById(modalId);

            if (modalEl == null) {
                document.body.insertAdjacentHTML("beforeend", `
                <div id="${modalId}" class="modal" tabindex="-1" role="dialog" aria-labelledby="yesNoModalTitle" aria-hidden="true">
                    <div class="modal-dialog modal-dialog-centered" role="document">
                        <div class="modal-content">
                            <div class="modal-header">
                                <h5 class="modal-title" id="yesNoModalTitle"></h5>
                            </div>
                            <div class="modal-body" id="yesNoModalMessage"></div>
                            <div class="modal-footer">
                                <button type="button" class="btn btn-secondary" id="yesNoModalNo"></button>
                                <button type="button" class="btn btn-primary" id="yesNoModalYes"></button>
                            </div>
                        </div>
                    </div>
                </div>`);
                modalEl = document.getElementById(modalId);
            }

            const titleEl = document.getElementById("yesNoModalTitle");
            const messageEl = document.getElementById("yesNoModalMessage");
            const yesBtn = document.getElementById("yesNoModalYes");
            const noBtn = document.getElementById("yesNoModalNo");

            titleEl.innerHTML = p.title || glotText("confirm", "確認");
            messageEl.innerHTML = p.message || "";
            yesBtn.innerHTML = p.yesText || glotText("yes", "はい");
            noBtn.innerHTML = p.noText || glotText("no", "いいえ");
            yesBtn.className = p.yesClass || "btn btn-primary";
            noBtn.className = p.noClass || "btn btn-secondary";

            let answered = false;
            const modal = bootstrap.Modal.getOrCreateInstance(modalEl, { backdrop: "static", keyboard: false });

            const finish = (answer, hide) => {
                if (answered) return;
                answered = true;

                if (typeof p.callback === "function") { p.callback(answer); }
                resolve(answer);

                if (hide !== false) {
                    if (modalEl.contains(document.activeElement)) { document.activeElement.blur(); }
                    modal.hide();
                }
            };
            yesBtn.onclick = () => finish(true);
            noBtn.onclick = () => finish(false);

            modalEl.addEventListener("hidden.bs.modal", () => { finish(false, false); }, { once: true });

            modal.show();
            this.yesNoObj = modal;
        });
    }

    applySidebarDragSize(requestedSize, isWide) {
        const topPane = document.getElementById("top-pane");
        const btmPane = document.getElementById("bottom-pane");
        const minimap = document.getElementById("mini-map");
        const sideChg = document.getElementById("sidebarChange");
        const total = isWide ? window.innerWidth : window.innerHeight;
        const minListSize = isWide ? 320 : total * 0.15;
        const maxListSize = isWide ? Math.min(total * 0.7, total - 320) : total * 0.9;
        const listSize = Math.min(Math.max(requestedSize, minListSize), maxListSize);
        const mapSize = Math.max(0, total - listSize);

        [topPane, btmPane, mapid].forEach((element) => {
            element.getAnimations().forEach((animation) => animation.cancel());
        });
        this.sidebarSize = 2;
        cMapMaker.status = "moveing";
        if (isWide) {
            this.sidebarWidthRatio = listSize / total;
            topPane.style.width = `${mapSize}px`;
            btmPane.style.width = `${listSize}px`;
            mapid.style.width = `${mapSize}px`;
            sideChg.innerHTML = "<i class='fa-solid fa-chevron-left'></i>";
        } else {
            this.sidebarHeightRatio = listSize / total;
            topPane.style.height = `${mapSize}px`;
            btmPane.style.height = `${listSize}px`;
            mapid.style.height = `${mapSize}px`;
            minimap.style.height = `${Math.max(total / 6, Conf.minimap.height)}px`;
            sideChg.innerHTML = "<i class='fa-solid fa-chevron-up'></i>";
        }
        mapLibre.map.resize();
    }

    initSidebarResize() {
        if (this.sidebarResizeInitialized) return;

        const handle = document.getElementById("sidebarResizeHandle");
        if (!handle) return;

        let dragging = false;
        let isWide = false;
        let requestedSize = 0;

        const applyDrag = () => {
            this.sidebarResizeFrame = null;
            this.applySidebarDragSize(requestedSize, isWide);
        };

        const finishDrag = (event) => {
            if (!dragging) return;
            dragging = false;
            if (this.sidebarResizeFrame !== null) {
                cancelAnimationFrame(this.sidebarResizeFrame);
                applyDrag();
            }
            document.body.classList.remove("is-resizing-sidebar");
            document.body.style.removeProperty("cursor");
            if (handle.hasPointerCapture(event.pointerId)) handle.releasePointerCapture(event.pointerId);
            mapLibre.start();
            mapLibre.map.resize();
            cMapMaker.status = "normal";
        };

        handle.addEventListener("pointerdown", (event) => {
            if (event.button !== 0 || this.sidebarSize === 0) return;
            event.preventDefault();
            dragging = true;
            isWide = window.matchMedia('(min-width: 1080px)').matches;
            requestedSize = isWide ? window.innerWidth - event.clientX : window.innerHeight - event.clientY;
            handle.setPointerCapture(event.pointerId);
            document.body.classList.add("is-resizing-sidebar");
            document.body.style.cursor = isWide ? "col-resize" : "row-resize";
            mapLibre.stop();
        });

        handle.addEventListener("pointermove", (event) => {
            if (!dragging) return;
            event.preventDefault();
            requestedSize = isWide ? window.innerWidth - event.clientX : window.innerHeight - event.clientY;
            if (this.sidebarResizeFrame === null) this.sidebarResizeFrame = requestAnimationFrame(applyDrag);
        });

        handle.addEventListener("pointerup", finishDrag);
        handle.addEventListener("pointercancel", finishDrag);
        this.sidebarResizeInitialized = true;
    }

    // サイドバーのサイズ設定(mode:空は非表示 / view:表示 / change:表示と拡大の切り替え / mini:縦の時はタイトルのみ表示。横の時は非表示 / list:リスト表示 / redraw:再表示)
    setSidebar(mode) {
        return new Promise((resolve, reject) => {
            const topPane = document.getElementById("top-pane");
            const btmPane = document.getElementById("bottom-pane");
            const sideCnt = document.getElementById("sidebarCont");
            const sideMin = document.getElementById("sidebarMinimize");
            const sideChg = document.getElementById("sidebarChange");
            const sideCls = document.getElementById("sidebarClose");
            const closeDetail = document.getElementById("closeDetail");
            const minimap = document.getElementById("mini-map");
            const isWide = window.matchMedia('(min-width: 1080px)').matches;
            let oldSize = this.sidebarSize;

            this.sidebarSize =
                mode === "redraw" ? oldSize :
                    mode === "mini" && (!Conf.sideBar.everyView || !isWide) ? 1 :
                        mode === "view" ? 2 :
                            mode === "list" ? 2 :
                                mode === "viewMax" ? 3 :
                                    mode === "change" && this.sidebarSize <= 2 ? 3 :
                                        mode === "change" && this.sidebarSize == 3 ? 2 :
                                            (mode === "" || mode == undefined) && !Conf.sideBar.everyView ? 0 : this.sidebarSize;
            sideCnt.classList.toggle("d-none", this.sidebarSize == 0);                  // サイドバー操作表示/非表示
            sideCls.classList.toggle("d-none", Conf.sideBar.everyView);                 // サイドバーを常に表示する時は非表示
            closeDetail.classList.toggle("d-none", cMapMaker.mode == "list");           // リスト表示以外の時は閉じるボタンを表示
            sideMin.classList.toggle("d-none", isWide);                                 // サイドバー操作表示/非表示
            if (oldSize == this.sidebarSize && mode !== "redraw") { resolve(); return } // サイズ変更があった場合のみレイアウト変更

            if (this.sidebarSize == 0) geoCont.clearPolygon()
            if (!isWide) {  // 縦長画面の場合
                //mapid.style.removeProperty('height');
                mapid.style.setProperty('width', '100vw', 'important');
                topPane.style.setProperty('width', '100vw', 'important');
                btmPane.style.setProperty('width', '100vw', 'important');
                article.style["flex-direction"] = "column";

                const maxHeight = window.innerHeight
                let btmHeight, topHeight
                const icon = this.sidebarSize < 3 ? "up" : "down"
                sideChg.innerHTML = `<i class='fa-solid fa-chevron-${icon}'></i>`

                let mapsize = 0;
                switch (this.sidebarSize) {
                    case 0: btmHeight = 0; break;
                    case 1: btmHeight = Math.min(maxHeight * 0.1, btmHeader.clientHeight); break;
                    case 2:
                        btmHeight = mode === "redraw" && this.sidebarHeightRatio !== null
                            ? maxHeight * this.sidebarHeightRatio : maxHeight * 0.4
                        mapsize = Math.max(maxHeight / 6, Conf.minimap.height);
                        break;
                    case 3:
                        btmHeight = maxHeight
                        mapsize = maxHeight - (btmPane.clientHeight);
                        break;
                }
                minimap.style.height = `${mapsize}px`
                topHeight = maxHeight - btmHeight;

                cMapMaker.status = "moveing"
                //mapLibre.stop()
                //console.log("top: " + topPane.offsetHeight + "px -> " + topHeight + "px")
                //console.log("btm: " + (maxHeight - topPane.offsetHeight) + "px -> " + btmHeight + "px")
                let startHeight = topPane.offsetHeight > maxHeight ? 0 : maxHeight - topPane.offsetHeight
                btmPane.animate([
                    { height: startHeight + "px" }, { height: btmHeight + "px" }
                ], { duration: 200, easing: 'ease-out', fill: 'forwards' });
                topPane.animate([
                    { height: topPane.offsetHeight + "px" }, { height: topHeight + "px" }
                ], { duration: 200, easing: 'ease-out', fill: 'forwards' }).finished.then(() => {
                    topPane.style.height = `${topHeight}px`;  // 念のため明示
                    btmPane.style.height = `${btmHeight}px`;  // 念のため明示
                    document.getElementById("mapid").style.height = `${topHeight}px`
                    //mapLibre.start()
                    mapLibre.map.resize()
                    cMapMaker.status = "normal"
                    resolve()
                })
            } else {    // 横長画面の場合
                mapid.style.height = "100vh";
                topPane.style.height = "100vh;";
                btmPane.style.setProperty('height', '100vh', 'important');
                article.style["flex-direction"] = "row";

                const icon = this.sidebarSize < 3 ? "left" : "right";
                sideChg.innerHTML = `<i class='fa-solid fa-chevron-${icon}'></i>`;

                const maxWidth = window.innerWidth;

                let btmWidth;
                switch (this.sidebarSize) {
                    case 0: btmWidth = 0; break;
                    case 1: btmWidth = 0; break;        // 非表示だけどフォーカスは合わす
                    case 2:
                        btmWidth = mode === "redraw" && this.sidebarWidthRatio !== null
                            ? maxWidth * this.sidebarWidthRatio : 480;
                        break;
                    case 3: btmWidth = maxWidth; break;
                }
                const topWidth = Math.max(0, maxWidth - btmWidth);
                minimap.style.height = (btmPane.clientHeight * 0.7) + "px";

                cMapMaker.status = "moveing";
                mapLibre.stop();

                console.log("top: " + topPane.offsetWidth + "px -> " + topWidth + "px")
                console.log("btm: " + (maxWidth - topPane.offsetWidth) + "px -> " + btmWidth + "px")
                let startWidth = topPane.offsetWidth > maxWidth ? 0 : maxWidth - topPane.offsetWidth

                mapid.animate([
                    { width: maxWidth + "px" }, { width: `${maxWidth - btmWidth}px` }
                ], { duration: 200, easing: 'ease-out', fill: 'forwards' });
                btmPane.animate([
                    { width: startWidth + "px" }, { width: btmWidth + "px" }
                ], { duration: 200, easing: 'ease-out', fill: 'forwards' });
                topPane.animate([
                    { width: topPane.offsetWidth + "px" }, { width: topWidth + "px" }
                ], { duration: 200, easing: 'ease-out', fill: 'forwards' }).finished.then(() => {
                    topPane.style.width = `${topWidth}px`;  // 念のため明示
                    btmPane.style.width = `${btmWidth}px`;  // 念のため明示
                    //mapid.style.width = `${maxWidth - btmWidth}px`;
                    mapLibre.start()
                    mapLibre.map.resize()
                    cMapMaker.status = "normal"
                    resolve()
                })

            }
        })
    }

    // 開いているモーダルにメッセージを追加
    addDetailMessage(addText, br) {
        btmWindow_message.innerHTML += `${br ? "<br>" : ""}${addText}`
    }

    // 進捗バーの表示(0-100)
    setProgress(percent) {
        const el = document.getElementById("panelProgress");
        if (!el) return;

        percent = Number(percent);
        if (!Number.isFinite(percent)) percent = 0;
        percent = Math.max(0, Math.min(100, percent));

        if (percent <= 0) {
            el.classList.add("d-none");
            el.style.width = "0%";
        } else {
            el.classList.remove("d-none");
            el.style.width = `${percent}%`;
        }
        return;
    }

    osm_open(param_text) {
        // open osm window
        window.open(`https://osm.org/${param_text.replace(/[?&]*/, "", "")}`, "_new");
    }

    menu_make(menulist, domid) {
        let dom = document.getElementById(domid);
        dom.innerHTML = Conf.menu_list.template;
        Object.keys(menulist).forEach((key) => {
            let link,
                confkey = menulist[key];
            if (confkey.linkto.indexOf("html:") > -1) {
                let span = dom.querySelector("span:first-child");
                span.innerHTML = confkey.linkto.substring(5);
                link = span.cloneNode(true);
            } else {
                let alink = dom.querySelector("a:first-child");
                alink.setAttribute("href", confkey.linkto);
                alink.setAttribute("target", confkey.linkto.indexOf("javascript:") == -1 ? "_new" : "");
                alink.querySelector("span").innerHTML = glot.get(confkey["glot-model"]);
                link = alink.cloneNode(true);
            }
            dom.appendChild(link);
            if (confkey["divider"]) dom.insertAdjacentHTML("beforeend", Conf.menu_list.divider);
        });
        dom.querySelector("a:first-child").remove();
        dom.querySelector("span:first-child").remove();
    }

    // メニューにカテゴリ追加 / 既に存在する時はtrueを返す
    addSelect(domid, text, value) {
        let dom = document.getElementById(domid);
        let newopt = document.createElement("option");
        var optlst = Array.prototype.slice.call(dom.options);
        let already = false;
        newopt.text = text;
        newopt.value = value;
        already = optlst.some((opt) => opt.value == value);
        if (!already) dom.appendChild(newopt);
        return already;
    }

    clearSelect(domid) {
        const select = document.getElementById(domid);
        while (select.options.length > 0) select.remove(0);     // すべてのoptionを削除
        const placeholder = document.createElement("option");   // プレースホルダー的な "---" を追加
        placeholder.textContent = glot.get("defaultSelect");
        placeholder.value = "";
        select.appendChild(placeholder);
    }

    // ウインドウサイズ変更時の処理
    resizeWindow() {
        const target = document.activeElement?.tagName;
        if (target !== "TEXTAREA" && target !== "INPUT") {
            console.log("Window: resize.");
            let mapWidth = basic.isSmartPhone() ? window.innerWidth : window.innerWidth * 0.5;  // トップメニューの横サイズ
            mapWidth = mapWidth < 350 ? 350 : mapWidth;
            if (typeof baselist !== "undefined") baselist.style.width = mapWidth + "px";
            document.getElementById("mapid").style.height = window.innerHeight + "px"
            document.getElementById("mapid").style.width = window.innerWidth + "px"
            if (mapLibre?.map) mapLibre.map.resize();
        }
    }

    // 画像を表示させる
    // dom: 操作対象のDOM / acts: [{src: ImageURL,osmid: osmid}]
    setImages(dom, acts, loadingUrl, limits) {
        this.disconnectImageObserver();
        dom.innerHTML = "";
        acts = acts.slice(0, Conf.thumbnail.limits)

        const loadImage = (image) => {
            const src = image.dataset.lazySrc;
            if (!src) return;
            delete image.dataset.lazySrc;
            if (src.slice(0, 5) == "File:") {
                getWikimedia()
                    .then((client) => client.queueGetWikiMediaImage(src, Conf.thumbnail.slideThumbWidth, image))
                    .catch((error) => console.warn("Thumbnail Wikimedia load failed:", error));
            } else {
                image.src = src;
            }
        };

        if ("IntersectionObserver" in window) {
            this.imageObserver = new IntersectionObserver((entries, observer) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    observer.unobserve(entry.target);
                    loadImage(entry.target);
                });
            }, {
                root: dom,
                rootMargin: "0px 160px",
                threshold: 0.01
            });
        }

        acts.forEach((act) => {
            act.src.forEach((src) => {
                if (src !== "" && typeof src !== "undefined") {
                    let image = document.createElement("img");
                    image.loading = "lazy";
                    image.className = "slide";
                    image.setAttribute("osmid", act.osmid);
                    image.setAttribute("title", act.title);
                    image.src = window.withAppAssetVersion(loadingUrl);
                    dom.append(image);
                    image.dataset.lazySrc = src;
                    if (this.imageObserver) this.imageObserver.observe(image);
                    else loadImage(image);
                }
            });
        });
    }

    disconnectImageObserver() {
        if (!this.imageObserver) return;
        this.imageObserver.disconnect();
        this.imageObserver = null;
    }

    // 指定したDOMを横スクロール対応にする
    mouseDragScroll(element, callback) {
        let target;
        element.addEventListener("mousedown", function (evt) {
            console.log("down");
            evt.preventDefault();
            target = element;
            target.dataset.down = "true";
            target.dataset.move = "false";
            target.dataset.x = evt.clientX;
            target.dataset.scrollleft = target.scrollLeft;
            evt.stopPropagation();
        });
        document.addEventListener("mousemove", function (evt) {
            if (target != null && target.dataset.down == "true") {
                evt.preventDefault();
                let move_x = parseInt(target.dataset.x) - evt.clientX;
                if (Math.abs(move_x) > 2) {
                    target.dataset.move = "true";
                } else {
                    return;
                }
                target.scrollLeft = parseInt(target.dataset.scrollleft) + move_x;
                evt.stopPropagation();
            }
        });
        document.addEventListener("mouseup", function (evt) {
            if (target != null && target.dataset.down == "true") {
                target.dataset.down = "false";
                if (target.dataset.move !== "true") callback(evt.target);
                evt.stopPropagation();
            }
        });
    }

    // 画面中央にメッセージを表示し、2秒かけてフェードアウトする関数
    showMessage(text) {
        // 既存のメッセージ要素を削除（重複防止）
        const existing = document.querySelector(".fade-message");
        if (existing) existing.remove();

        // 新しいメッセージ要素を作成
        const msg = document.createElement("div");
        msg.className = "fade-message";
        msg.textContent = text;
        document.body.appendChild(msg);

        // 一瞬待ってからフェードアウト開始
        setTimeout(() => msg.classList.add("hide"), 1000);

        // 完全に消えたら要素を削除
        setTimeout(() => msg.remove(), 3000);
    }

    // 雪を降らせる / start: trueで開始、falseで停止
    fallsSnow(start) {
        const mapEl = document.getElementById('mapid');
        const canvas = document.getElementById('snow');

        if (!mapEl || !canvas) {
            console.warn('#mapid または #snow が見つかりません');
            return;
        }

        const ctx = canvas.getContext('2d');

        switch (start) {
            case true:
                if (winCont.snowAnimId !== null) {
                    cancelAnimationFrame(winCont.snowAnimId);
                    winCont.snowAnimId = null;
                }

                let snowWidth = 0;
                let snowHeight = 0;

                function resize() {
                    const dpr = window.devicePixelRatio || 1;
                    const rect = mapEl.getBoundingClientRect();

                    snowWidth = rect.width;
                    snowHeight = rect.height;

                    canvas.width = Math.floor(snowWidth * dpr);
                    canvas.height = Math.floor(snowHeight * dpr);

                    canvas.style.width = snowWidth + 'px';
                    canvas.style.height = snowHeight + 'px';

                    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
                }

                // 多重登録防止
                if (winCont.snowResizeHandler) {
                    window.removeEventListener('resize', winCont.snowResizeHandler);
                }

                winCont.snowResizeHandler = resize;
                window.addEventListener('resize', winCont.snowResizeHandler);

                resize();

                const FLAKE_COUNT = 200;

                const flakes = Array.from({ length: FLAKE_COUNT }, () => ({
                    x: Math.random() * snowWidth,
                    y: Math.random() * snowHeight,
                    r: 1 + Math.random() * 2.5,
                    vx: -0.4 + Math.random() * 0.8,
                    vy: 0.8 + Math.random() * 1.8,
                    a: 0.3 + Math.random() * 0.5
                }));

                function drawSnow() {
                    ctx.clearRect(0, 0, snowWidth, snowHeight);

                    for (const f of flakes) {
                        f.x += f.vx;
                        f.y += f.vy;

                        if (f.y > snowHeight + 10) {
                            f.y = -10;
                            f.x = Math.random() * snowWidth;
                        }

                        if (f.x < -10) {
                            f.x = snowWidth + 10;
                        }

                        if (f.x > snowWidth + 10) {
                            f.x = -10;
                        }

                        ctx.globalAlpha = f.a;
                        ctx.beginPath();
                        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
                        ctx.fillStyle = '#ffffff';
                        ctx.fill();
                    }

                    ctx.globalAlpha = 1;
                    winCont.snowAnimId = requestAnimationFrame(drawSnow);
                }

                drawSnow();
                break;

            case false:
                if (winCont.snowAnimId !== null) {
                    cancelAnimationFrame(winCont.snowAnimId);
                    winCont.snowAnimId = null;
                }

                if (winCont.snowResizeHandler) {
                    window.removeEventListener('resize', winCont.snowResizeHandler);
                    winCont.snowResizeHandler = null;
                }

                ctx.clearRect(0, 0, canvas.width, canvas.height);
                break;
        }
    }

}
const winCont = new WinCont();
