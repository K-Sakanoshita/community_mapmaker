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

    make(actlists) {
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
            clone.querySelector("div.collapse").id = "collapse" + idx;
            head.setAttribute("data-target", "#collapse" + idx);
            head.setAttribute("aria-expanded", idx == 0 ? "true" : "false");
            clone.querySelector("#collapse" + idx).classList[idx == 0 ? "add" : "remove"]("show");
            clone.querySelector("span").innerHTML = act.title;
            chtml = "<div class='float-right'>" + glot.get("update") + " " + basic.formatDate(new Date(act.updatetime), ymd) + "</div>";
            switch (act.id.split('/')[0]) {
                case "memorial":
                    memorial = true;
                    chtml += "<b>" + glot.get("memorials_title") + "</b><br>" + act.title + "<br>";
                    chtml += "<b>" + glot.get("memorials_author") + "</b><br>" + act.author + "<br><br>";
                    chtml += "<b>" + glot.get("memorials_memorial") + "</b><br>" + act.body.replace(/\r?\n/g, '<br>') + "<br><br>";
                    chtml += "<b>" + glot.get("memorials_place") + "</b><br>" + act.place + "<br><br>";
                    chtml += "<b>" + glot.get("memorials_supply") + "</b><br>" + act.supply + "<br><br>";
                    chtml += "<b>" + glot.get("memorials_references") + "</b><br>" + act.references + "<br><br>";
                    chtml += "<b>" + glot.get("memorials_reception") + "</b><br>" + basic.formatDate(new Date(act.reception), ymd) + "<br><br>";
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
        return `<h5>${glot.get(memorial ? "memorials" : "activities")}</h5>` + result;  // 1件でもあれば「思い出」
    };
}
var modal_activities = new modal_Activities();
