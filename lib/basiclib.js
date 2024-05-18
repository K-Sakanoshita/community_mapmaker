// Basic Closure
class Basic {
    getDate() {							                // Overpass Queryに付ける日付指定
        let seldate = $("#Select_Date").val();
        return seldate ? '[date:"' + (new Date(seldate)).toISOString() + '"]' : "";
    }

    formatDate(date, format) {
        // date format
        if (Number.isNaN(date.getDate())) return "";
        try {
            format = format.replace(/YYYY/g, date.getFullYear());
            format = format.replace(/YY/g, date.getFullYear().toString().slice(-2));
            format = format.replace(/MM/g, ('0' + (date.getMonth() + 1)).slice(-2));
            format = format.replace(/DD/g, ('0' + date.getDate()).slice(-2));
            format = format.replace(/hh/g, ('0' + date.getHours()).slice(-2));
            format = format.replace(/mm/g, ('0' + date.getMinutes()).slice(-2));
            format = format.replace(/ss/g, ('0' + date.getSeconds()).slice(-2));
        } catch {
            format = "";
        };
        return format;
    }

    dataURItoBlob(dataURI) {                               // DataURIからBlobへ変換（ファイルサイズ2MB超過対応）
        const b64 = atob(dataURI.split(',')[1]);
        const u8 = Uint8Array.from(b64.split(""), function (e) { return e.charCodeAt() });
        return new Blob([u8], { type: "image/png" });
    }

    concatTwoDimensionalArray(array1, array2, axis) {      // 2次元配列の合成
        if (axis != 1) axis = 0;
        var array3 = [];
        if (axis == 0) {    //　縦方向の結合
            array3 = array1.slice();
            for (var i = 0; i < array2.length; i++) {
                array3.push(array2[i]);
            }
        } else {              //　横方向の結合
            for (var i = 0; i < array1.length; i++) {
                array3[i] = array1[i].concat(array2[i]);
            };
        };
        return array3;
    }

    unicodeUnescape(str) {     // \uxxx形式→文字列変換
        let result = "", strs = str.match(/\\u.{4}/ig);
        if (!strs) return '';
        for (var i = 0, len = strs.length; i < len; i++) {
            result += String.fromCharCode(strs[i].replace('\\u', '0x'));
        };
        return result;
    }

    uniq(array) {
        let elems = new Map();
        for (let elem of array) elems.set(elem, true); // 同じキーに何度も値を設定しても問題ない
        return Array.from(elems.keys()).filter(Boolean);
    }

    getWikipedia(lang, url) {      // get wikipedia contents
        return new Promise((resolve, reject) => {
            let encurl = encodeURI(url);
            encurl = "https://" + lang + "." + Conf.wikipedia.api + encurl + "?origin=*";
            console.log(encurl);
            $.get({ url: encurl, dataType: "json" }, function (data) {
                console.log(data.extract);
                resolve([data.extract, data.thumbnail]);
            });
        });
    }

    isSmartPhone() {
        if (window.matchMedia && window.matchMedia('(max-device-width: 640px)').matches) {
            return true;
        } else {
            return false;
        };
    }

    autoLink(str) {
        var regexp_url = /((h?)(ttps?:\/\/[a-zA-Z0-9.\-_@:/~?%&;=+#',()*!]+))/g; // ']))/;
        var regexp_makeLink = function (all, url, h, href) {
            return '<a href="h' + href + '" target="_blank">' + url + '</a>';
        }
        return str.replace(regexp_url, regexp_makeLink);
    }

    getStyleSheetValue(cssname, property) {
        let element = document.querySelector(cssname);
        if (!element || !property) return null;
        let style = window.getComputedStyle(element);
        return style.getPropertyValue(property);
    }

    async makeSHA256(text) {
        const uint8 = new TextEncoder().encode(text);
        const digest = await crypto.subtle.digest('SHA-256', uint8);
        return Array.from(new Uint8Array(digest)).map(v => v.toString(16).padStart(2, '0')).join('');
    }

    htmlspecialchars(str) {
        return String(str).replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
    }

    //二次元配列 -> CSV形式の文字列に変換
    makeArray2CSV(arr, col = ',', row = '\n') {
        const escape = (s) => { return `"${s.replace(/\"/g, '\"\"')}"` };
        return arr.map((row) => row.map((cell) => escape(Array.isArray(cell) ? cell.join("//") : cell)).join(col)).join(row);
    }

    //指定したWikimedia Commons画像を取得 / fileTitle:ページ名 / thumbnailWidth:サイズ / imageDom:dom or id名
    //id名を指定した場合、同id + "-copyright"のid要素(span想定)に著作権表示を実施する
    getWikiMediaImage(fileTitle, thumbnailWidth, imageDom) {
        const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&titles=${fileTitle}&format=json&prop=imageinfo&iiprop=url|extmetadata&origin=*`;
        fetch(apiUrl + (thumbnailWidth == "" ? "" : `&iiurlwidth=${thumbnailWidth}`))
            .then(response => response.json())
            .then(data => {
                const pages = data.query.pages;
                const pageId = Object.keys(pages)[0];
                const urlCat = thumbnailWidth == "" ? "url" : "thumburl";
                if (pages[pageId].imageinfo !== undefined) {
                    const fileUrl = pages[pageId].imageinfo[0][urlCat];
                    const copyright = typeof (imageDom) == "string" ? document.getElementById(imageDom + "-copyright") : undefined
                    imageDom = typeof (imageDom) == "string" ? document.getElementById(imageDom) : imageDom;
                    imageDom.src = fileUrl;
                    imageDom.setAttribute("src_org", pages[pageId].imageinfo[0].url);
                    imageDom.setAttribute("src_org", pages[pageId].imageinfo[0].url);
                    if (copyright !== undefined) {
                        let artist = pages[pageId].imageinfo[0].extmetadata.Artist.value
                        let license = pages[pageId].imageinfo[0].extmetadata.LicenseShortName.value
                        let html = `Image by ${artist} <a href="${pages[pageId].imageinfo[0].descriptionurl}">${license}</a>`
                        copyright.innerHTML = html
                    }
                } else {
                    console.log("File Not Found:" + pages[pageId].title);
                }
            })
    }

};
