class modal_Activities {
    // make modal html for Activities

    constructor() {
        this.busy = false;
        this.html = ""
        var xhr = new XMLHttpRequest();
        xhr.open('GET', "./modal/modal_activities.html", true);
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

    make(actlists) {
        let ymd = "YYYY/MM/DD";
        let tModal = document.createElement("div");
        let template = document.createElement("div");
        let result = "", newmode = "";
        template.innerHTML = this.html;
        actlists.sort((a, b) => { return a.updatetime > b.updatetime ? -1 : 1 });   // sort by update.
        result = modal_activities.make_activity_list(actlists);
        actlists.forEach((act, idx) => {
            let clone = template.querySelector("div.body").cloneNode(true);
            let head = clone.querySelector("h5");
            let body = clone.querySelector("div.p-1");
            let updated = basic.formatDate(new Date(act.updatetime), ymd);
            newmode = act.id.split('/')[0];
            let form = Conf.activities[newmode].form;
            head.innerHTML = act.title;
            head.setAttribute("id", act.id.replace("/", ""));
            let chtml = `<div class="float-right">${glot.get("update")} ${updated}[<a href="javascript:modal_activities.edit({id:'${act.id}',form:'${newmode}'})">${glot.get("act_edit")}</a>]</div>`;
            chtml += glot.get("share_link") + `<button type="button" class="btn-sm btn-light ml-1 pl-2 pr-2 pt-0 pb-0" onclick="cMapMaker.url_share('${act.id}')">
                <i class="fas fa-clone"></i>
            </button><br><br>`;
            switch (newmode) {
                case "libc":
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
                    chtml += "<strong>" + glot.get("title") + "</strong><br>" + act.title + "<br><br>";
                    chtml += "<strong>" + glot.get("memories_author") + "</strong><br>" + act.author + "<br><br>";
                    chtml += "<strong>" + glot.get("memories_memorial") + "</strong><br>" + act.body.replace(/\r?\n/g, '<br>') + "<br><br>";
                    chtml += "<strong>" + glot.get("memories_place") + "</strong><br>" + act.place + "<br><br>";
                    chtml += "<strong>" + glot.get("memories_supply") + "</strong><br>" + act.supply + "<br><br>";
                    chtml += "<strong>" + glot.get("memories_references") + "</strong><br>" + act.references + "<br><br>";
                    chtml += "<strong>" + glot.get("memories_reception") + "</strong><br>" + basic.formatDate(new Date(act.reception), ymd) + "<br><br>";
                    break;
                default:    // event
                    head.innerHTML = act.title;

                    Object.keys(form).forEach((key) => {
                        chtml += `<div class='row'>`;
                        let gdata = act[form[key].gsheet] == undefined ? "" : String(act[form[key].gsheet]);
                        switch (form[key].type) {
                            case "date":
                                chtml += `<div class='col'>${glot.get(form[key].glot)}</div><div class='col-9'>${basic.formatDate(new Date(gdata), "YYYY/MM/DD")}</div>`;
                                break;
                            case "select":
                            case "text":
                            case "textarea":
                            case "quiz_choice":
                                if (key !== "quiz_answer" && key !== "title") chtml += `<div class='col'>${glot.get(form[key].glot)}</div><div class='col-9'>${gdata.replace(/\r?\n/g, '<br>')}</div>`;
                                break;
                            case "quiz_textarea":
                                chtml += `<div class='col'>${glot.get(form[key].glot)}</div><div class='col-9'>${gdata.replace(/\r?\n/g, '<br>')}</div>`;
                                break;
                            case "url":
                                if (gdata !== "http://" && gdata !== "https://" && gdata !== "") {
                                    chtml += `<div class='col'>${glot.get(form[key].glot)}</div><div class='col-9'><a href="${gdata}">${gdata}</a></div>`;
                                };
                                break;
                            case "image_url":
                                if (gdata !== "http://" && gdata !== "https://" && gdata !== "") {
                                    chtml += `<div class="col text-center"><img class="thumbnail" onclick="modal_activities.viewImage('${gdata}')" src="${gdata}"></div><br>`;
                                };
                                break;
                        };
                        chtml += "</div>";
                    });
                    break;
            };

            body.innerHTML = chtml;
            result += clone.outerHTML;
        });
        tModal.remove();
        template.remove();
        return result;
    };

    // make activity list
    make_activity_list(actlists) {
        let html = "<ul class='ml-0 pl-4'>";
        for (let act of actlists) {
            console.log("modal_Activities: " + act.id);
            html += `<li><span class="pointer" onclick="document.getElementById('${act.id.replace('/', '')}').scrollIntoView({behavior: 'smooth'})">${act.title}<span></li>`;
        }
        return html + "</ul>";
    }

    // edit activity
    edit(params) {			// p {id: undefined時はnew}
        let title = glot.get(params.id === void 0 ? "act_add" : "act_edit");
        let html = "", act = Conf.activities;
        let data = params.id === void 0 ? { osmid: cMapMaker.open_osmid } : poiCont.get_actid(params.id);

        html = "<div class='container'>";
        Object.keys(act[params.form].form).forEach(key => {
            let akey = "act_" + key;
            html += "<div class='row mb-1 align-items-center'>";
            let defvalue = data[act[params.form].form[key].gsheet] || "";
            let form = act[params.form].form[key];
            html += `<div class='col-2 p-1'>${glot.get(`${form.glot}`)}</div>`;
            switch (form.type) {
                case "date":
                    let gdate = basic.formatDate(new Date(defvalue), "YYYY-MM-DD");
                    html += `<div class="col-10 p-1"><input type="date" id="${akey}" class="form-control form-control-sm" value="${gdate}"></div>`;
                    break;
                case "select":
                    let selects = "", category = form.category;
                    for (let idx in form.category) {
                        let selected = category[idx] !== data.category ? "" : "selected";
                        selects += `<option value="${category[idx]}" ${selected}>${category[idx]}</option>`;
                    };
                    html += `<div class="col-10 p-1"><select id="${akey}" class="form-control form-control-sm">${selects}</select></div>`;
                    break;
                case "textarea":
                case "quiz_textarea":
                    html += `<div class="col-10 p-1"><textarea id="${akey}" rows="8" class="form-control form-control-sm">${defvalue}</textarea></div>`;
                    break;
                case "quiz_choice":
                case "text":
                    html += `<div class="col-10 p-1"><input type="text" id="${akey}" maxlength="80" class="form-control form-control-sm" value="${defvalue}"></div>`;
                    break;
                case "quiz_hint_url":
                case "image_url":
                case "url":
                    html += `<div class="col-10 p-1"><input type="text" id="${akey}" class="form-control form-control-sm" value="${defvalue}"></div>`;
                    break;
                case "comment":
                    html += `<div class='col-10 p-1'><h5>${glot.get(`${form.glot}`)}</h5></div>`;
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
        html += `<input type="hidden" id="act_id" value="${params.id === void 0 ? "" : params.id}"></input>`;
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
                    Object.keys(act[params.form].form).forEach(key => {
                        let field = act[params.form].form[key];
                        if (field.gsheet !== "") senddata[field.gsheet] = document.getElementById("act_" + key).value
                    });
                    gSheet.get_salt(Conf.google.AppScript, userid).then((e) => {
                        winCont.modal_progress(40);
                        console.log("salt: " + e.salt);
                        return basic.makeSHA256(passwd + e.salt);
                    }).then((hashpw) => {
                        winCont.modal_progress(70);
                        console.log("hashpw: " + hashpw);
                        return gSheet.set(Conf.google.AppScript, senddata, params.form, userid, hashpw);
                    }).then((e) => {
                        winCont.modal_progress(100);
                        if (e.status.indexOf("ok") > -1) {
                            console.log("save: ok");
                            winCont.modal_close();
                            gSheet.get(Conf.google.AppScript).then(jsonp => {
                                poiCont.set_actjson(jsonp);
                                let targets = (Conf.listTable.targets.indexOf("targets") > -1) ? [listTable.getSelCategory()] : ["-"];
                                cMapMaker.viewArea(targets);	// in targets
                                cMapMaker.viewPoi(targets);	// in targets
                                modal_activities.busy = false;
                            });
                        } else {
                            console.log("save: ng");
                            alert(glot.get("act_error"));
                            modal_activities.busy = false;
                        }
                        //}).catch(() => {
                        //    winCont.modal_progress(0);
                        //    modal_activities.busy = false;
                    });
                } else if (userid == "" || passwd == "") {
                    alert(glot.get("act_error"));
                }
            }
        });
    }

    viewImage(imgurl) {
        document.getElementById("full_screen_image").classList.add("isFullScreen");
        document.getElementById("full_screen_image").style["background-image"] = "url('" + imgurl + "')";
    }

    closeImage(){
        document.getElementById("full_screen_image").classList.remove("isFullScreen");
    }

}
