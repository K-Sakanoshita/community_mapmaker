// Display Status(progress&message)
class winCont {

    constructor() { this.modal_mode = false }

    static splash(mode) {
        $("#splash_image").attr("src", Conf.splash.url);
        let act = mode ? { backdrop: 'static', keyboard: false } : 'hide';
        $('#modal_splash').modal(act);
    }

    static spinner(view) {
        try {
            let display = view ? "remove" : "add";
            global_spinner.classList[display]('d-none');
            list_spinner.classList[display]('d-none');
        } catch (error) {
            console.log("no spinner");
        }
    }

    static modal_open(p) {   // open modal window(p: title,message,mode(yes no close),callback_yes,callback_no,callback_close)
        let MW = "modal_window";
        document.getElementById(`${MW}_title`).innerHTML = p.title;
        document.getElementById(`${MW}_message`).innerHTML = p.message;
        document.getElementById(`${MW}_menu`).hidden = p.menu ? false : true;
        let delEvents = function (keyn) {
            let dom = document.getElementById(`${MW}_${keyn}`);
            dom.removeEventListener("click", function () { p[`callback_${keyn}`]() });
        };
        let addButton = function (keyn) {
            let dom = document.getElementById(`${MW}_${keyn}`);
            dom.hidden = true;
            if (p.mode.indexOf(keyn) > -1) {
                dom.innerHTML = glot.get(`button_${keyn}`);
                dom.removeEventListener("click", function () { p[`callback_${keyn}`]() });
                dom.addEventListener("click", function () { p[`callback_${keyn}`]() });
                dom.hidden = false;
            };
        };
        ["yes", "no", "close"].forEach(keyn => addButton(keyn));
        winCont.modal_progress(0);
        $(`#${MW}`).modal({ backdrop: false, keyboard: true });
        winCont.modal_mode = true;
        $(`#${MW}`).on('shown.bs.modal', () => {
            ["yes", "no", "close"].forEach(keyn => delEvents(keyn));
            if (!winCont.modal_mode) $(`#${MW}`).modal('hide')
        });                 // Open中にCloseされた時の対応
        $(`#${MW}`).on('hidden.bs.modal', () => {
            ["yes", "no", "close"].forEach(keyn => delEvents(keyn));
            p[`callback_${p.callback_close ? "close" : "no"}`]();
        });    // "x" click
    }

    static modal_text(text, append) {
        let newtext = append ? $(`${MW}_message`).html() + text : text;
        $(`#modal_window_message`).html(newtext);
    }

    static modal_progress(percent) {
        percent = percent == 0 ? 0.1 : percent;
        $(`#modal_window_progress`).css('width', parseInt(percent) + "%");
    }

    static modal_close() {            // close modal window(note: change this)
        winCont.modal_mode = false;
        $(`#modal_window`).modal('hide');
        [`#modal_window_yes`, `#modal_window_no`, `#modal_window_close`].forEach(id => $(id).off('click'));
    }

    static menu_make(menulist, domid) {
        let dom = document.getElementById(domid);
        dom.innerHTML = Conf.menu_list.template;
        Object.keys(menulist).forEach(key => {
            let link, confkey = menulist[key];
            if (confkey.linkto.indexOf("html:") > -1) {
                let span = dom.querySelector("span:first-child");
                span.innerHTML = confkey.linkto.substring(5);
                link = span.cloneNode(true);
            } else {
                let alink = dom.querySelector("a:first-child");
                alink.setAttribute("href", confkey.linkto);
                alink.setAttribute("target", confkey.linkto.indexOf("javascript:") == -1 ? "_blank" : "");
                alink.querySelector("span").innerHTML = glot.get(confkey["glot-model"]);
                link = alink.cloneNode(true);
            };
            dom.appendChild(link);
            if (confkey["divider"]) dom.insertAdjacentHTML("beforeend", Conf.menu_list.divider);
        });
        dom.querySelector("a:first-child").remove();
        dom.querySelector("span:first-child").remove();
    }

    static select_add(domid, text, value) {
        let option = document.createElement("option");
        option.text = text;
        option.value = value;
        document.getElementById(domid).appendChild(option);
    }
    static select_clear(domid) {
        $('#' + domid + ' option').remove();
        $('#' + domid).append($('<option>').html("---").val("-"));
    }

    static window_resize() {
        console.log("Window: resize.");
        let mapWidth = basic.isSmartPhone() ? window.innerWidth - 50 : window.innerWidth * 0.3;
        mapWidth = mapWidth < 300 ? 300 : mapWidth;
        if (typeof baselist !== "undefined") baselist.style.width = mapWidth + "px";
        if (typeof mapid !== "undefined") mapid.style.height = window.innerHeight + "px";
    }
}
