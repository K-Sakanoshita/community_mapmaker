// Display Status(progress&message)
class WinCont {

    constructor() {
        this.modal_mode = false;
        Object.defineProperty(this, 'MW', { value: "#modal_window" });
    }

    splash(mode) {
        $("#splash_image").attr("src", Conf.splash.url);
        let act = mode ? { backdrop: 'static', keyboard: false } : 'hide';
        $('#modal_splash').modal(act);
    }

    spinner(view) {
        try {
            let display = view ? "remove" : "add";
            global_spinner.classList[display]('d-none');
        } catch (error) {
            console.log("no spinner");
        }
    }

    modal_open(p) {   // open modal window(p: title,message,mode(yes no close),callback_yes,callback_no,callback_close)
        let MW = winCont.MW;
        $(`${MW}_title`).html(p.title);
        $(`${MW}_message`).html(p.message);
        [`${MW}_yes`, `${MW}_no`, `${MW}_close`].forEach(id => $(id).hide());
        if (p.mode.indexOf("yes") > -1) $(`${MW}_yes`).html(glot.get("button_yes")).on('click', p.callback_yes).show();
        if (p.mode.indexOf("no") > -1) $(`${MW}_no`).html(glot.get("button_no")).on('click', p.callback_no).show();
        if (p.mode.indexOf("close") > -1) $(`${MW}_close`).html(glot.get("button_close")).on('click', p.callback_close).show();
        winCont.modal_progress(0);
        $(winCont.MW).modal({ backdrop: false, keyboard: true });
        winCont.modal_mode = true;
        $(winCont.MW).on('shown.bs.modal', () => { if (!winCont.modal_mode) $(winCont.MW).modal('hide') }); // Open中にCloseされた時の対応
        $(winCont.MW).on('hidden.bs.modal', () => p.callback_close());                        // "x" click
    }

    modal_text(text, append) {
        let newtext = append ? $(`${MW}_message`).html() + text : text;
        $(`${winCont.MW}_message`).html(newtext);
    }

    modal_progress(percent) {
        percent = percent == 0 ? 0.1 : percent;
        $(`${winCont.MW}_progress`).css('width', parseInt(percent) + "%");
    }

    modal_close() {            // close modal window(note: change this)
        winCont.modal_mode = false;
        let MW = winCont.MW;
        $(`${MW}`).modal('hide');
        [`${MW}_yes`, `${MW} _no`, `${MW}_close`].forEach(id => $(id).off('click'));
    }

    menu_make(menulist, domid) {
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

    select_add(domid, text, value) {
        let option = document.createElement("option");
        option.text = text;
        option.value = value;
        document.getElementById(domid).appendChild(option);
    }
    select_clear(domid) {
        $('#' + domid + ' option').remove();
        $('#' + domid).append($('<option>').html("---").val("-"));
    }

    window_resize() {
        console.log("Window: resize.");
        let mapWidth = basic.isSmartPhone() ? window.innerWidth - 50 : window.innerWidth * 0.3;
        mapWidth = mapWidth < 300 ? 300 : mapWidth;
        if (typeof baselist !== "undefined") baselist.style.width = mapWidth + "px";
        if (typeof mapid !== "undefined") mapid.style.height = window.innerHeight + "px";
    }
}
var winCont = new WinCont();
