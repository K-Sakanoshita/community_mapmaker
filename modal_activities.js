class modal_Activities {
    // make modal html for Activities

    constructor() {
        this.busy = false;
        this.html = ""
        var xhr = new XMLHttpRequest();
        xhr.open('GET', "./modal_activities.html", true);
        xhr.onerror = function () {
            console.log("[error]modal_Activities:");
            console.log(xhr);
        };
        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 400) {
                console.log("[success]modal_Activities:");
                this.html = xhr.response;
            } else {
                console.log("[error]modal_Activities:");
                console.log(xhr);
            };
        }.bind(this);
        xhr.send();
    };

    make(actlists, openid) {
        let ymd = "YYYY/MM/DD";
        let tModal = document.createElement("div");
        let template = document.createElement("div");
        let result = "", mode = "", newmode = "", glot_key = "";
        template.innerHTML = this.html;
        actlists.sort((a, b) => { return a.updatetime > b.updatetime ? -1 : 1 });   // sort by update.
        actlists.forEach((act, idx) => {
            let clone = template.querySelector("div.body").cloneNode(true);
            let head = clone.querySelector("h5");
            let body = clone.querySelector("div.card-body");
            let chtml = "", updated = basic.formatDate(new Date(act.updatetime), ymd);
            let openflag = (act.id == openid) || (!openid && idx == 0 && Conf.detail_view.openfirst) ? true : false;
            newmode = act.id.split('/')[0];
            clone.querySelector("div.collapse").id = "collapse" + idx;
            head.setAttribute("data-target", "#collapse" + idx);
            head.setAttribute("aria-expanded", openflag ? "true" : "false");
            if (openflag && openid !== undefined) head.setAttribute("id", "modal_" + openid);
            clone.querySelector("#collapse" + idx).classList[openflag ? "add" : "remove"]("show");
            clone.querySelector("span").innerHTML = act.title;
            chtml = `<div class="float-right">${glot.get("update")} ${updated}[<a href="javascript:modal_activities.edit('${act.id}')">${glot.get("act_edit")}</a>]</div>`;
            chtml += "<strong>" + glot.get("share_link") + ":</strong> ";
            chtml += `
            <button type="button" class="btn btn-warning pl-3 pr-3 pt-0 pb-0"
             data-toggle="popover" data-content="${glot.get("modal_popover_copied")}" onclick="cMapmaker.url_share('${act.id}')">
                <i class="fas fa-clone"></i>
            </button><br><br>`;
            switch (newmode) {
                case "libc":
                    glot_key = "libc";
                    let mm = !parseInt(act.mm) ? "--" : ("00" + act.mm).substr(-2);
                    let dd = !parseInt(act.dd) ? "--" : ("00" + act.dd).substr(-2);
                    let act_ymd = `${act.yyyy}/${mm}/${dd}`;
                    clone.querySelector("span").innerHTML = act_ymd + " " + act.title;
                    chtml += `<strong>${glot.get("libc_title")}</strong><br>${act_ymd} ${act.title}<br><br>`;
                    chtml += "<strong>" + glot.get("libc_agency") + "</strong><br>" + act.agency + "<br><br>";
                    chtml += "<strong>" + glot.get("libc_authority") + "</strong><br>" + act.authority.replace(/\r?\n/g, '<br>') + "<br><br>";
                    chtml += "<strong>" + glot.get("libc_area") + "</strong><br>" + act.area + "<br><br>";
                    chtml += "<strong>" + glot.get("libc_ymd") + `</strong><br>${act_ymd}<br><br>`;
                    break;
                case "memorial":
                    glot_key = "memories";
                    chtml += "<strong>" + glot.get("memories_title") + "</strong><br>" + act.title + "<br><br>";
                    chtml += "<strong>" + glot.get("memories_author") + "</strong><br>" + act.author + "<br><br>";
                    chtml += "<strong>" + glot.get("memories_memorial") + "</strong><br>" + act.body.replace(/\r?\n/g, '<br>') + "<br><br>";
                    chtml += "<strong>" + glot.get("memories_place") + "</strong><br>" + act.place + "<br><br>";
                    chtml += "<strong>" + glot.get("memories_supply") + "</strong><br>" + act.supply + "<br><br>";
                    chtml += "<strong>" + glot.get("memories_references") + "</strong><br>" + act.references + "<br><br>";
                    chtml += "<strong>" + glot.get("memories_reception") + "</strong><br>" + basic.formatDate(new Date(act.reception), ymd) + "<br><br>";
                    break;
                case "child":
                    glot_key = "children";
                    let form = Conf.activities.child.form;
                    clone.querySelector("span").innerHTML = act.title;
                    Object.keys(form).forEach((key) => {
                        let gdata = act[form[key].gsheet];
                        switch (form[key].type) {
                            case "select":
                            case "text":
                            case "textarea":
                            case "quiz_choice":
                            case "quiz_textarea":
                                if (key !== "quiz_answer") chtml += `<strong>${glot.get(form[key].glot)}</strong><br>${gdata.replace(/\r?\n/g, '<br>')}<br><br>`;
                                break;
                            case "url":
                                if (gdata !== "http://" && gdata !== "https://" && gdata !== "") {
                                    chtml += `<string>${glot.get(form[key].glot)}</strong> <a href="${gdata}">${gdata}</a><br><br>`;
                                };
                                break;
                            case "image_url":
                                if (gdata !== "http://" && gdata !== "https://" && gdata !== "") {
                                    chtml += `<img class="w100 m-1" src="${gdata}"><br>`;
                                };
                                break;
                        };
                    });
                    break;
                default:    // event
                    glot_key = "activities";
                    chtml += act.startdatetime == "" ? "" : glot.get("eventdates") + basic.formatDate(new Date(act.startdatetime), ymd) + " - " + basic.formatDate(new Date(act.enddatetime), ymd) + "<br>"
                    chtml += (act.detail_url !== "" ? `<a href="${act.detail_url}">${act.detail_url}</a>` : "") + "<br><br>";
                    chtml += act.body.replace(/\r?\n/g, '<br>') + "<br>" + (act.picture_url !== "" ? `<img class="w100" src="${act.picture_url}"><br>` : "<br>");
                    break;
            };
            body.innerHTML = chtml;
            if (mode !== newmode) {
                mode = newmode;
                result += `<h5>${glot.get(glot_key)}</h5>` + clone.innerHTML;
            } else {
                result += clone.innerHTML;
            }
        });
        tModal.remove();
        template.remove();
        return result;
    };

    // edit activity
    edit(id) {			// p {id: undefined時はnew}
        let title = glot.get(id === void 0 ? "act_add" : "act_edit");
        let html = "", act = Conf.activities;
        let data = id === void 0 ? { osmid: cMapmaker.open_osmid } : poiCont.get_actid(id);

        html = "<div class='container'>";
        Object.keys(act.form).forEach(key => {
            let akey = "act_" + key;
            html += "<div class='row mb-1 align-items-center'>";
            let defvalue = data[act.form[key].gsheet] || "";
            switch (act.form[key].type) {
                case "select":
                    let selects = "", category = act.form[key].category;
                    for (let idx in act.form[key].category) {
                        let selected = category[idx] !== data.category ? "" : "selected";
                        selects += `<option value="${category[idx]}" ${selected}>${category[idx]}</option>`;
                    };
                    html += `<div class='col-2 p-1'>${glot.get(`${act.form[key].glot}`)}</div>`;
                    html += `<div class="col-10 p-1"><select id="${akey}" class="form-control form-control-sm">${selects}</select></div>`;
                    break;
                case "textarea":
                case "quiz_textarea":
                    html += `<div class='col-2 p-1'>${glot.get(`${act.form[key].glot}`)}</div>`;
                    html += `<div class="col-10 p-1"><textarea id="${akey}" rows="8" class="form-control form-control-sm">${defvalue}</textarea></div>`;
                    break;
                case "quiz_choice":
                case "text":
                    html += `<div class='col-2 p-1'>${glot.get(`${act.form[key].glot}`)}</div>`;
                    html += `<div class="col-10 p-1"><input type="text" id="${akey}" maxlength="80" class="form-control form-control-sm" value="${defvalue}"></div>`;
                    break;
                case "quiz_hint_url":
                case "image_url":
                case "url":
                    html += `<div class='col-2 p-1'>${glot.get(`${act.form[key].glot}`)}</div>`;
                    html += `<div class="col-10 p-1"><input type="text" id="${akey}" class="form-control form-control-sm" value="${defvalue}"></div>`;
                    break;
                case "comment":
                    html += `<div class='col-12 p-1'><h5>${glot.get(`${act.form[key].glot}`)}</h5></div>`;
                    break;
            };
            html += "</div>";
        });
        html += "<hr>";
        html += `<div class="row mb-1 align-items-center">`;
        html += `<div class="col-12 p-1"><h4>${glot.get("act_confirm")}</h4></div>`;
        html += `<div class="col-2 p-1">${glot.get("act_userid")}</div>`;
        html += `<div class="col-4 p-1"><input type="text" id="act_userid" class="form-control form-control-sm"></input></div>`;
        html += `<div class="col-2 p-1">${glot.get("act_passwd")}</div>`;
        html += `<div class="col-4 p-1"><input type="password" id="act_passwd" class="form-control form-control-sm"></input></div>`;
        html += `</div></div>`;
        html += `<input type="hidden" id="act_id" value="${id === void 0 ? "" : id}"></input>`;
        html += `<input type="hidden" id="act_osmid" value="${data.osmid}"></input>`;

        winCont.modal_progress(0);
        winCont.modal_open({
            "title": title, "message": html, "mode": "yes,no", "menu": true,
            "callback_no": () => { winCont.modal_close() }, "callback_yes": () => {
                winCont.modal_progress(0);
                let userid = document.getElementById("act_userid").value;
                let passwd = document.getElementById("act_passwd").value;
                if (!modal_activities.busy && userid !== "" && passwd !== "") {
                    winCont.modal_progress(10);
                    modal_activities.busy = true;
                    let senddata = { "id": act_id.value, "osmid": act_osmid.value };
                    Object.keys(act.form).forEach(key => {
                        if (act.form[key].gsheet !== "") senddata[act.form[key].gsheet] = document.getElementById("act_" + key).value
                    });

                    gSheet.get_salt(Conf.google.AppScript, userid).then((e) => {
                        winCont.modal_progress(40);
                        console.log("salt: " + e.salt);
                        return basic.makeSHA256(passwd + e.salt);
                    }).then((hashpw) => {
                        winCont.modal_progress(70);
                        console.log("hashpw: " + hashpw);
                        return gSheet.set(Conf.google.AppScript, senddata, "child", userid, hashpw);
                    }).then((e) => {
                        winCont.modal_progress(100);
                        if (e.status.indexOf("ok") > -1) {
                            console.log("save: ok");
                            winCont.modal_close();
                            gSheet.get(Conf.google.AppScript).then(jsonp => {
                                poiCont.set_actjson(jsonp);
                                cMapmaker.poi_view();
                                modal_activities.busy = false;
                            });
                        } else {
                            console.log("save: ng");
                            alert(glot.get("act_error"));
                            modal_activities.busy = false;
                        }
                    }).catch(() => {
                        winCont.modal_progress(0);
                        modal_activities.busy = false;
                    });
                } else if (userid == "" || passwd == "") {
                    alert(glot.get("act_error"));
                }
            }
        });
    }
}
