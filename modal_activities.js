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
        let result = "";
        template.innerHTML = this.html;
        actlists.sort((a, b) => { return a.update > b.update ? -1 : 1 });   // sort by update.
        actlists.forEach((act, idx) => {
            let clone = template.querySelector("div.body").cloneNode(true);
            let head = clone.querySelector("h5");
            let body = clone.querySelector("div.card-body");
            clone.querySelector("div.collapse").id = "collapse" + idx;
            head.setAttribute("data-target", "#collapse" + idx);
            head.setAttribute("aria-expanded", idx == 0 ? "true" : "false");
            clone.querySelector("#collapse" + idx).classList[idx == 0 ? "add" : "remove"]("show");
            clone.querySelector("span").innerHTML = act.title;
            body.innerHTML = "<div class='float-right'>" + glot.get("update") + " " + basic.formatDate(new Date(act.update), ymd) + "</div>" +
                glot.get("eventdates") + basic.formatDate(new Date(act.startdatetime), ymd) + " - " + basic.formatDate(new Date(act.enddatetime), ymd) + "<br>" +
                (act.detail_url !== "" ? `<a href="${act.detail_url}">${act.detail_url}</a>` : "") + "<br><br>" +
                act.body.replace(/\r?\n/g, '<br>') + "<br>" +
                (act.picture_url !== "" ? `<img class="w100" src="${act.picture_url}"><br>` : "<br>");
            result += clone.innerHTML;
        });
        tModal.remove();
        template.remove();
        return result;
    };
}
var modal_activities = new modal_Activities();
