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
        let ymd = "YYYY/MM/DD hh:mm";
        let tModal = document.createElement("div");
        let template = document.createElement("div");
        let result = "", memorial = false;
        template.innerHTML = this.html;
        actlists.sort((a, b) => { return a.updatetime > b.updatetime ? -1 : 1 });   // sort by update.
        actlists.forEach((act, idx) => {
            let clone = template.querySelector("div.body").cloneNode(true);
            let head = clone.querySelector("h5");
            let body = clone.querySelector("div.card-body");
            let chtml;
            let openflag = (act.id == openid) || (!openid && idx == 0) ? true : false;
            clone.querySelector("div.collapse").id = "collapse" + idx;
            head.setAttribute("data-target", "#collapse" + idx);
            head.setAttribute("aria-expanded", openflag ? "true" : "false");
            if (openflag && openid !== undefined) head.setAttribute("id", "modal_" + openid);
            clone.querySelector("#collapse" + idx).classList[openflag ? "add" : "remove"]("show");
            clone.querySelector("span").innerHTML = act.title;
            chtml = "<div class='float-right'>" + glot.get("update") + " " + basic.formatDate(new Date(act.updatetime), ymd) + "</div>";
            chtml += "<strong>" + glot.get("memories_link") + ":</strong> ";
            chtml += `
            <button type="button" class="btn btn-warning pl-3 pr-3 pt-0 pb-0"
             data-toggle="popover" data-content="${glot.get("modal_popover_copied")}" onclick="cMapmaker.url_share('${act.id}')">
                <i class="fas fa-clone"></i>
            </button><br><br>`;
            switch (act.id.split('/')[0]) {
                case "memorial":
                    memorial = true;
                    chtml += "<strong>" + glot.get("memories_title") + "</strong><br>" + act.title + "<br><br>";
                    chtml += "<strong>" + glot.get("memories_author") + "</strong><br>" + act.author + "<br><br>";
                    chtml += "<strong>" + glot.get("memories_memorial") + "</strong><br>" + act.body.replace(/\r?\n/g, '<br>') + "<br><br>";
                    chtml += "<strong>" + glot.get("memories_place") + "</strong><br>" + act.place + "<br><br>";
                    chtml += "<strong>" + glot.get("memories_supply") + "</strong><br>" + act.supply + "<br><br>";
                    chtml += "<strong>" + glot.get("memories_references") + "</strong><br>" + act.references + "<br><br>";
                    chtml += "<strong>" + glot.get("memories_reception") + "</strong><br>" + basic.formatDate(new Date(act.reception), ymd) + "<br><br>";
                    break;
                default:    // event
                    chtml += act.startdatetime == "" ? "" : glot.get("eventdates") + basic.formatDate(new Date(act.startdatetime), ymd) + " - " + basic.formatDate(new Date(act.enddatetime), ymd) + "<br>"
                    chtml += (act.detail_url !== "" ? `<a href="${act.detail_url}">${act.detail_url}</a>` : "") + "<br><br>";
                    chtml += act.body.replace(/\r?\n/g, '<br>') + "<br>" + (act.picture_url !== "" ? `<img class="w100" src="${act.picture_url}"><br>` : "<br>");
                    break;
            };
            body.innerHTML = chtml;
            result += clone.innerHTML;
        });
        tModal.remove();
        template.remove();
        return `<h5>${glot.get(memorial ? "memories" : "activities")}</h5>` + result;  // 1件でもあれば「思い出」
    };
}
var modal_activities = new modal_Activities();
