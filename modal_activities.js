class modal_Activities {
    // make modal html for Activities

    constructor() {
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
            let chtml;
            let openflag = (act.id == openid) || (!openid && idx == 0 && Conf.detail_view.openfirst) ? true : false;
            newmode = act.id.split('/')[0];
            clone.querySelector("div.collapse").id = "collapse" + idx;
            head.setAttribute("data-target", "#collapse" + idx);
            head.setAttribute("aria-expanded", openflag ? "true" : "false");
            if (openflag && openid !== undefined) head.setAttribute("id", "modal_" + openid);
            clone.querySelector("#collapse" + idx).classList[openflag ? "add" : "remove"]("show");
            clone.querySelector("span").innerHTML = act.title;
            chtml = "<div class='float-right'>" + glot.get("update") + " " + basic.formatDate(new Date(act.updatetime), ymd) + " [" + glot.get("act_edit") + "]</div>";
            chtml += "<strong>" + glot.get("memories_link") + ":</strong> ";
            chtml += `
            <button type="button" class="btn btn-warning pl-3 pr-3 pt-0 pb-0"
             data-toggle="popover" data-content="${glot.get("modal_popover_copied")}" onclick="cMapmaker.url_share('${act.id}')">
                <i class="fas fa-clone"></i>
            </button><br><br>`;
            switch (newmode) {
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
                    clone.querySelector("span").innerHTML = act.title + (act.rubi !== "" ? "(" + act.rubi + ")" : "");
                    chtml += "<strong>" + glot.get("act_category") + "</strong><br>" + act.category + "<br><br>";
                    chtml += "<strong>" + act.title + (act.rubi !== "" ? "(" + act.rubi + ")" : "") + "</strong><br>";
                    chtml += act.body.replace(/\r?\n/g, '<br>');
                    ["detail_url", "official_url"].forEach((val => {
                        if (act[val] !== "http://" && act[val] == "https://" && act[val] == "") {
                            chtml += "<string>" + glot.get(`act${act[val]}`) + "</strong> " + `<a href="${act[val]}">${act[val]}</a>` + "<br><br>";
                        }
                    }));
                    for (let i = 1; i <= 3; i++) {
                        let url = act[`picture_url${i}`];
                        if (url == "http://" && url == "https://" && url == "") {
                            chtml += (act[url] !== "" ? `<img class="w100" src="${act[url]}"><br>` : "<br>");
                        }
                    };
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
}
var modal_activities = new modal_Activities();
