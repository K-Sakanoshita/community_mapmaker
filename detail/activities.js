class Activities {
    // make modal html for Activities

    constructor() {
        this.busy = false;
        this.html = `
        <div class="body mb-2">
            <div class="bg-light-subtle.bg-gradient">
                <h5 class="border-bottom border-top border-success-subtle m-1 p-1"></h5>
                <div class="p-1"></div>
            </div>
        </div>`;
    }

    // make activity detail list
    make(actlists) {
        let ymd = "YYYY/MM/DD";
        let tModal = document.createElement("div");
        let template = document.createElement("div");
        let result = "", newmode = "", wikimq = [];
        let makehtml = function (form, act) {
            let chtml = "";
            Object.keys(form).forEach((key) => {
                if (form[key].gsheet === Conf.documentPreview?.field && Conf.documentPreview?.use === true) return;
                if (form[key].viewHidden !== true) {
                    //chtml += `<div class='row'>`;
                    let gdata = act[form[key].gsheet] == undefined ? "" : String(act[form[key].gsheet]);
                    gdata = basic.htmlspecialchars(gdata).replace(/\r?\n/g, "<br>");
                    switch (form[key].type) {
                        case "date":
                            chtml += `<div class='col-12'><p><span class="fw-bold"><small>${glot.get(form[key].glot)}</small></span> ${basic.formatDate(new Date(gdata), "YYYY/MM/DD")}</div>`;
                            break;
                        case "textarea":
                            gdata = basic.autoLink(gdata);
                            chtml += `<div class='col-12'><p><span class="fw-bold"><small>${glot.get(form[key].glot)}</small></span> <big> ${gdata.replace(/\r?\n/g, "<br>")}</big></p></div>`;
                            break;
                        case "checkbox":
                            if (gdata !== "") {
                                let values = gdata.split(","), label = "";
                                values.forEach((value) => {
                                    let idx = form[key].values.indexOf(value);
                                    if (idx > -1) {
                                        label += `<span class="fs-6 badge bg-success me-1 mb-1">${glot.get(form[key].values[idx])}</span>`;
                                    }
                                });
                                chtml += `<div class='col-12'><p><span class="fw-bold"><small>${glot.get(form[key].glot)}</small></span> ${label}</div>`;
                            }
                            break;
                        case "select":
                            if (gdata !== "") {
                                let label = `<span class="fs-6 badge bg-primary me-1 mb-1">${glot.get(gdata)}</span>`;
                                chtml += `<div class='col-12'><p><span class="fw-bold"><small>${glot.get(form[key].glot)}</small></span> ${label}</div>`;
                            }
                            break;
                        case "text":
                        case "quiz_choice":
                            if (key !== "quiz_answer" && key !== "title" && gdata !== "") {
                                gdata = basic.autoLink(gdata);
                                chtml += `<div class='col-12'><p><span class="fw-bold"><small>${glot.get(form[key].glot)}</small></span> ${gdata.replace(/\r?\n/g, "<br>")}</p></div>`;
                            }
                            break;
                        case "quiz_textarea":
                            chtml += `<div class='col-12 p-1'>${glot.get(form[key].glot)}</div><div class='col-12'>${gdata.replace(/\r?\n/g, "<br>")}</div>`;
                            break;
                        case "url":
                            if (gdata !== "http://" && gdata !== "https://" && gdata !== "") {
                                chtml += `<div class='col-12'><p><span class="fw-bold"><small>${glot.get(form[key].glot)}</small></span><a href="${gdata}">${gdata}</a></p></div>`;
                            }
                            break;
                        case "image_url":
                            if (gdata !== "http://" && gdata !== "https://" && gdata !== "") {
                                if (gdata.slice(0, 5) == "File:") {
                                    // Wikimedia Commons
                                    let id = act.id.replace("/", "") + "_" + key;
                                    wikimq.push([gdata, id]);
                                    chtml += `<div class="col-12 text-center"><img class="thumbnail" onclick="modalActs.viewImage(this)" src="${Conf.etc.loadingUrl}" id="${id}"><span id="${id}-copyright"></span></div>`;
                                } else {
                                    chtml += `<div class="col-12 text-center"><img class="thumbnail" onclick="modalActs.viewImage(this)" src="${gdata}"></div>`;
                                }
                            }
                            break;
                        case "video_url":
                            if (gdata !== "http://" && gdata !== "https://" && gdata !== "") {
                                chtml += `<div class="col-12 text-center"><video class="activity-video" src="${gdata}" preload="metadata" playsinline onclick="modalActs.viewVideo(this)" style="display:block;max-width:100%;height:auto;margin:4px auto;cursor:pointer"></video></div>`;
                            }
                            break;
                        default: // 何もしない
                            break;
                    }
                    //chtml += "</div>";
                }
            });
            return chtml;
        };
        template.innerHTML = this.html;
        actlists.sort((a, b) => {
            return a.updatetime < b.updatetime ? -1 : 1;
        }); // sort by update.
        result = modalActs.makeActivityList(actlists);
        actlists.forEach((act, idx) => {
            if (act.id !== "") {
                let clone = template.querySelector("div.body").cloneNode(true);
                let head = clone.querySelector("h5");
                let body = clone.querySelector("div.p-1");
                let updated = basic.formatDate(new Date(act.updatetime), ymd);
                newmode = act.id.split("/")[0];
                let form = Conf.activities[newmode].form;
                head.innerHTML =
                    act.title +
                    ` <button type="button" class="btn btn-sm me-1 ps-1 pe-2 pt-0 pb-0" onclick="cMapMaker.shareURL('${act.id}')">
             <i class="fa-solid fa-clone text-secondary;"></i></button>`;
                head.setAttribute("id", act.id.replace("/", ""));
                let edit = Conf.etc.editMode ? `[<a href="javascript:modalActs.edit({id:'${act.id}',form:'${newmode}'})">${glot.get("act_edit")}</a>]` : "";
                let chtml = Conf.etc.editMode ? `<div class="float-end">${glot.get("update")} ${updated}${edit}</div><br>` : "";
                chtml += makehtml(form, act);
                body.innerHTML = chtml;
                result += clone.outerHTML;
            }
        });
        result += DocumentPreview.render(actlists);
        setTimeout(() => {
            wikimq.forEach((q) => { wikimedia.getWikiMediaImage(q[0], Conf.thumbnail.modalThumbWidth, q[1]); }); // WikiMedia Image 遅延読み込み
        }, 500)
        tModal.remove();
        template.remove();
        return result;
    }

    // make activity list
    makeActivityList(actlists) {
        if (actlists.length > 1) {
            let html = "<div class='list-group mb-2'>";
            for (let act of actlists) {
                html += `<a href="#" class="list-group-item list-group-item-action" onclick="modalActs.moveTo('${act.id.replace("/", "")}')">${act.title}</a>`;
            }
            return html + "</div>";
        }
        return "";
    }

    // move linkto
    moveTo(id) {
        document.getElementById(id).scrollIntoView({ behavior: "smooth" });
    }

    // edit activity
    // params {id: undefined時はnew, form: フォーム名、空白時は一番上を自動取得}
    edit(params = {}) {
        let title = glot.get(params.id === void 0 ? "act_add" : "act_edit");
        let html = "", act = Conf.activities;
        let data = params.id === void 0 ? { osmid: cMapMaker.openOSMid } : poiCont.get_actid(params.id);
        let fname = params.form == undefined ? Object.keys(Conf.activities)[0] : params.form;

        html = "<div class='container'>";
        Object.keys(act[fname].form).forEach((key) => {
            let akey = "act_" + key;
            html += "<div class='row mb-1 align-items-center'>";
            let defvalue = data[act[fname].form[key].gsheet] || "";
            let form = act[fname].form[key];
            switch (form.type) {
                case "date":
                    html += `<div class='col-2 p-1'>${glot.get(`${form.glot}`)}</div>`;
                    let gdate = basic.formatDate(new Date(defvalue), "YYYY-MM-DD");
                    html += `<div class="col-10 p-1"><input type="date" id="${akey}" class="form-control form-control-sm" value="${gdate}"></div>`;
                    break;
                case "select":
                    html += `<div class='col-2 p-1'>${glot.get(`${form.glot}`)}</div>`;
                    let selects = "";
                    for (let idx in form.values) {
                        let selected = form.values[idx] !== defvalue ? "" : "selected";
                        selects += `<option value="${form.values[idx]}" ${selected}>${glot.get(`${form.values[idx]}`)}</option>`;
                    }
                    html += `<div class="col-10 p-1"><select id="${akey}" class="form-select">${selects}</select></div>`;
                    break;
                case "checkbox":
                    html += `<div class='col-2 p-1'>${glot.get(`${form.glot}`)}</div>`;
                    let checks = "", values = defvalue.split(",");
                    for (let idx in form.values) {
                        let checked = values.includes(form.values[idx]) ? "checked" : "";
                        checks += `<input type="checkbox" name="${akey}" value="${form.values[idx]}" ${checked}> ${glot.get(`${form.values[idx]}`)}</input><br>`;
                    }
                    html += `<div class="col-10 p-1">${checks}</div>`;
                    break;
                case "textarea":
                case "quiz_textarea":
                    html += `<div class='col-2 p-1'>${glot.get(`${form.glot}`)}</div>`;
                    html += `<div class="col-10 p-1"><textarea id="${akey}" rows="8" class="form-control form-control-sm">${defvalue}</textarea></div>`;
                    break;
                case "quiz_choice":
                case "text":
                    html += `<div class='col-2 p-1'>${glot.get(`${form.glot}`)}</div>`;
                    html += `<div class="col-10 p-1"><input type="text" id="${akey}" maxlength="80" class="form-control form-control-sm" value="${defvalue}"></div>`;
                    break;
                case "quiz_hint_url":
                case "image_url":
                case "video_url":
                case "url":
                    html += `<div class='col-2 p-1'>${glot.get(`${form.glot}`)}</div>`;
                    html += `<div class="col-10 p-1"><input type="text" id="${akey}" class="form-control form-control-sm" value="${defvalue}"></div>`;
                    break;
                case "comment":
                    html += `<div class='col-2 p-1'>${glot.get(`${form.glot}`)}</div>`;
                    html += `<div class='col-10 p-1'><h5>${glot.get(`${form.glot}`)}</h5></div>`;
                    break;
                case "attention":
                    html += `<div class='col-12 p-1'>${glot.get(`${form.glot}`)}</div>`;
                    break;
            }
            html += "</div>";
        });
        html += "<hr>";
        html += `<div class="row mb-1 align-items-center">`;
        html += `<div class="col-12 p-1"><h5>${glot.get("act_confirm")}</h5></div>`;
        html += `<div class="col-3 p-1">${glot.get("act_userid")}</div>`;
        html += `<div class="col-9 p-1"><input type="text" id="act_userid" class="form-control form-control-sm"></input></div>`;
        html += `<div class="col-3 p-1">${glot.get("act_passwd")}</div>`;
        html += `<div class="col-9 p-1"><input type="password" id="act_passwd" class="form-control form-control-sm"></input></div>`;
        html += `<div class="col-9 offset-3 p-1"><button type="button" class="participation-link" onclick="areaSearchController.open('research')" aria-haspopup="dialog" aria-controls="poiFilterModal">${glot.get("contribute_firstTime")}</button></div>`;
        html += `</div></div>`;
        html += `<input type="hidden" id="act_id" value="${params.id === void 0 ? "" : params.id}"></input>`;
        html += `<input type="hidden" id="act_osmid" value="${data.osmid}"></input>`;

        winCont.setProgress(0);
        mapLibre.viewMiniMap(false)
        const editActions = [...Conf.menu.editActivity];
        if (Conf.etc.editMode && params.id !== void 0) {
            editActions.push(...(Conf.menu.deleteActivity ?? []));
        }
        winCont.makeDetail({ title: title, message: html, menu: true, append: editActions });
        cMapMaker.changeMode("edit");
    }

    save() {
        let act = Conf.activities;
        let fname = Object.keys(Conf.activities)[0];
        const authMode = String(Conf.activity.authMode || "legacy").toLowerCase();
        winCont.setProgress(0);
        let userid = document.getElementById("act_userid").value;
        let passwd = document.getElementById("act_passwd").value;
        if (!modalActs.busy && userid !== "" && passwd !== "") {
            winCont.setProgress(10);
            modalActs.busy = true;
            const coordinates = poiCont.get_osmid(act_osmid.value)?.lnglat
                ?? poiCont.get_actid(act_id.value)?.lnglat;
            let senddata = { id: act_id.value, osmid: act_osmid.value };
            if (Array.isArray(coordinates) && coordinates.length >= 2
                && coordinates[0] != null && String(coordinates[0]).trim() !== ""
                && coordinates[1] != null && String(coordinates[1]).trim() !== ""
                && Number.isFinite(Number(coordinates[0]))
                && Number.isFinite(Number(coordinates[1]))
                && Math.abs(Number(coordinates[0])) <= 180
                && Math.abs(Number(coordinates[1])) <= 90) {
                senddata.longitude = Number(coordinates[0]);
                senddata.latitude = Number(coordinates[1]);
            }
            Object.keys(act[fname].form).forEach((key) => {
                let field = act[fname].form[key];
                if (field.gsheet !== "" && field.gsheet !== undefined) {
                    if (field.type === "checkbox") {
                        let checks = document.getElementsByName("act_" + key);
                        let checkdata = [];
                        checks.forEach((check) => { if (check.checked) checkdata.push(check.value) });
                        senddata[field.gsheet] = checkdata.join(",");
                    } else {
                        senddata[field.gsheet] = document.getElementById("act_" + key).value;
                    }
                }
            });
            const passwordPromise = authMode === "basic"
                ? Promise.resolve(passwd)
                : gSheet.get_salt(Conf.activity.url, userid).then((e) => {
                    if (!e || typeof e.salt !== "string") throw new Error("Salt response is invalid.");
                    return basic.makeSHA256(passwd + e.salt);
                });
            passwordPromise
                .then((requestPassword) => {
                    winCont.setProgress(70);
                    return gSheet.set(
                        Conf.activity.url,
                        senddata,
                        fname,
                        userid,
                        requestPassword,
                        { authMode }
                    );
                })
                .then((e) => {
                    winCont.setProgress(100);
                    if (String(e?.status || "").includes("ok")) {
                        console.log("save: ok");
                        winCont.showMessage(glot.get("act_saved"));
                        cMapMaker.clearDatail();
                        cMapMaker.reloadActivitiesForView()
                            .then(async () => {
                                await changesController.checkActivityChanges(Conf.activity, { force: true });
                                cMapMaker.showChangeTicker();
                            })
                            .catch((error) => {
                                console.error("Activity reload failed:", error);
                                alert(glot.get("act_error"));
                            })
                            .finally(() => {
                                cMapMaker.changeMode("map");
                                winCont.setProgress(0);
                                modalActs.busy = false;
                            });
                    } else {
                        console.log("save: ng");
                        alert(glot.get("act_error"));
                        winCont.setProgress(0);
                        modalActs.busy = false;
                    }
                }).catch((error) => {
                    console.error("Activity save failed:", error);
                    alert(glot.get("act_error"));
                    winCont.setProgress(0);
                    modalActs.busy = false;
                });
        } else if (userid == "" || passwd == "") {
            alert(glot.get("act_error"));
        }
    }

    async remove() {
        const activityId = String(document.getElementById("act_id")?.value ?? "").trim();
        const userid = String(document.getElementById("act_userid")?.value ?? "").trim();
        const passwd = String(document.getElementById("act_passwd")?.value ?? "");
        if (!Conf.etc.editMode || !activityId || !userid || !passwd || this.busy) {
            if (!this.busy) alert(glot.get("act_delete_auth_required"));
            return;
        }

        const confirmed = await winCont.confirm({
            title: glot.get("act_delete_confirm_title"),
            message: glot.get("act_delete_confirm_message"),
            yesText: glot.get("act_delete"),
            yesClass: "btn btn-danger"
        });
        if (!confirmed) return;

        this.busy = true;
        winCont.setProgress(30);
        try {
            const authMode = String(Conf.activity.authMode || "legacy").toLowerCase();
            const requestPassword = authMode === "basic"
                ? passwd
                : await gSheet.get_salt(Conf.activity.url, userid).then((response) => {
                    if (!response || typeof response.salt !== "string") throw new Error("invalid_salt");
                    return basic.makeSHA256(passwd + response.salt);
                });
            const response = await gSheet.remove(
                Conf.activity.url,
                activityId,
                userid,
                requestPassword,
                { authMode }
            );
            if (!String(response?.status || "").includes("ok")) {
                throw new Error(response?.code || "delete_failed");
            }

            winCont.setProgress(100);
            await cMapMaker.clearDatail();
            await cMapMaker.reloadActivitiesForView();
            cMapMaker.changeMode("map");
        } catch (error) {
            console.error("Activity delete failed:", error);
            alert(glot.get("act_delete_error"));
        } finally {
            winCont.setProgress(0);
            this.busy = false;
        }
    }

    toggleVideo(video) {
        if (video.paused || video.ended) {
            if (video.ended) video.currentTime = 0;
            video.play().catch((error) => {
                console.warn("Activity video playback failed:", error);
            });
        } else {
            video.pause();
        }
    }

    viewVideo(sourceVideo) {
        const video = document.getElementById("FullScreenVideo");
        const src = sourceVideo.currentSrc || sourceVideo.getAttribute("src");
        if (!video || !src) return;

        sourceVideo.pause();
        const startTime = sourceVideo.currentTime || 0;
        video.src = src;
        video.style.display = "block";
        document.getElementById("FullScreenVideoClose").style.display = "block";
        ImageViewer.close();
        document.getElementById("MediaBackdrop").style.display = "block";

        const playVideo = () => {
            try {
                video.currentTime = startTime;
            } catch (error) {
                console.warn("Activity video seek failed:", error);
            }
            video.play().catch((error) => {
                console.warn("Activity video playback failed:", error);
            });
        };
        if (video.readyState >= 1) {
            playVideo();
        } else {
            video.addEventListener("loadedmetadata", playVideo, { once: true });
        }
    }

    closeVideo() {
        const video = document.getElementById("FullScreenVideo");
        if (!video) return;
        video.pause();
        video.style.display = "none";
        document.getElementById("FullScreenVideoClose").style.display = "none";
        video.removeAttribute("src");
        video.load();
        document.getElementById("MediaBackdrop").style.display = "none";
    }

    closeMedia() {
        this.closeVideo();
        ImageViewer.close();
    }

    viewImage(source) {
        this.closeVideo();
        return ImageViewer.open({
            image: source.getAttribute("src_thumb") || source.currentSrc || source.src,
            title: source.alt || ""
        });
    }
}
