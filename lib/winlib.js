// Window Control(progress&message)
class WinCont {

    constructor() {
        this.modal_mode = false;
    }

    playback(view) {
        let display = view ? "remove" : "add";
        list_playback_control.classList[display]('d-none');
    }

    download(view) {
        let display = view ? "remove" : "add";
        list_download.classList[display]('d-none');
    }

    splash(mode) {
        if (window == window.parent) {
            document.getElementById("splash_image").setAttribute("src", Conf.etc.splashUrl);
            let act = mode ? { backdrop: 'static', keyboard: false } : 'hide';
            $('#modal_splash').modal(act);
        }
    }

    spinner(view) {
        try {
            let display = view ? "remove" : "add";
            global_spinner.classList[display]('d-none');
            list_spinner.classList[display]('d-none');
        } catch (error) {
            console.log("no spinner");
        }
    }

    // open modal window(p: title,message,mode(yes no close),callback_yes,callback_no,callback_close,append,openid)
    // append: append button(Conf.menu.modalButton)
    modal_open(p) {
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
        $(`#${MW}`).modal({ backdrop: true, keyboard: true });
        winCont.modal_mode = true;
        $(`#${MW}`).off('shown.bs.modal');
        $(`#${MW}`).on('shown.bs.modal', () => {
            ["yes", "no", "close"].forEach(keyn => delEvents(keyn));
            if (!winCont.modal_mode) $(`#${MW}`).modal('hide');
            if (p.openid !== undefined) {
                let act = document.getElementById(p.openid.replace("/", ""));
                if (act !== null) act.scrollIntoView();        // 指定したidのactivityがあればスクロール
            };
        });                 // Open中にCloseされた時の対応
        $(`#${MW}`).off('hidden.bs.modal');
        $(`#${MW}`).on('hidden.bs.modal', () => {
            ["yes", "no", "close"].forEach(keyn => delEvents(keyn));
            p[`callback_${p.callback_close ? "close" : "no"}`]();
        });    // "x" click
        let chtml = "";
        if (p.append !== undefined) {      // append button
            p.append.forEach(p => {
                chtml += `<button class="${p.btn_class}" onclick="${p.code}"><i class="${p.icon_class}"></i>`;
                chtml += ` <span>${glot.get(p.btn_glot_name)}</span></button>`;
            });
        };
        modal_footer.innerHTML = chtml;
    }

    modal_text(text, append) {
        let newtext = append ? $(`${MW}_message`).html() + text : text;
        //$(`#modal_window_message`).html(newtext);
        document.getElementById("modal_window_message").innerHTML = newtext;
    }

    modal_progress(percent) {
        percent = percent == 0 ? 0.1 : percent;
        $(`#modal_window_progress`).css('width', parseInt(percent) + "%");
    }

    modal_close() {              // close modal window(note: change this)
        winCont.modal_mode = false;
        $(`#modal_window`).modal('hide');
        [`#modal_window_yes`, `#modal_window_no`, `#modal_window_close`].forEach(id => $(id).off('click'));
    }

    osm_open(param_text) {        // open osm window
        window.open(`https://osm.org/${param_text.replace(/[?&]*/, '', "")}`, '_blank');
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

    // メニューにカテゴリ追加 / 既に存在する時はtrueを返す
    select_add(domid, text, value) {
        let dom = document.getElementById(domid);
        let newopt = document.createElement("option");
        var optlst = Array.prototype.slice.call(dom.options);
        let already = false;
        newopt.text = text;
        newopt.value = value;
        already = optlst.some(opt => opt.value == value);
        if (!already) dom.appendChild(newopt);
        return already;
    }

    select_clear(domid) {
        $('#' + domid + ' option').remove();
        $('#' + domid).append($('<option>').html("---").val("-"));
    }

    window_resize() {
        console.log("Window: resize.");
        let mapWidth = basic.isSmartPhone() ? window.innerWidth : window.innerWidth * 0.3;
        mapWidth = mapWidth < 350 ? 350 : mapWidth;
        if (typeof baselist !== "undefined") baselist.style.width = mapWidth + "px";
        if (typeof mapid !== "undefined") mapid.style.height = window.innerHeight + "px";
    }

    // 画像を表示させる
    // dom: 操作対象のDOM / acts: [{src: ImageURL,osmid: osmid}]
    setImages(dom, acts) {
        dom.innerHTML = "";
        acts.forEach((act) => {
            act.src.forEach(src => {
                if (src !== "") {
                    let image = document.createElement("img");
                    image.loading = "lazy";
                    image.className = "slide";
                    image.setAttribute("osmid", act.osmid);
                    image.setAttribute("title", act.title);
                    dom.append(image);
                    if (src.slice(0, 5) == "File:") {   // Wikimedia Commons
                        basic.getWikiMediaImage(src, Conf.etc.thumbnailWidth, image);
                    } else {
                        image.src = src;
                    }
                }
            })
        })
    }

    // 指定したDOMを横スクロール対応にする
    mouseDragScroll(element, callback) {
        let target;
        element.addEventListener('mousedown', function (evt) {
            console.log("down");
            evt.preventDefault();
            target = element;
            target.dataset.down = 'true';
            target.dataset.move = 'false';
            target.dataset.x = evt.clientX;
            target.dataset.scrollleft = target.scrollLeft;
            evt.stopPropagation();
        });
        document.addEventListener('mousemove', function (evt) {
            if (target != null && target.dataset.down == 'true') {
                evt.preventDefault();
                let move_x = parseInt(target.dataset.x) - evt.clientX;
                if (Math.abs(move_x) > 2) {
                    target.dataset.move = 'true';
                } else {
                    return;
                }
                target.scrollLeft = parseInt(target.dataset.scrollleft) + move_x;
                evt.stopPropagation();
            }
        });
        document.addEventListener('mouseup', function (evt) {
            if (target != null && target.dataset.down == 'true') {
                target.dataset.down = 'false';
                if (target.dataset.move !== 'true') callback(evt.target);
                evt.stopPropagation();
            }
        });
    }
}
