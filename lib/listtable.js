"use strict";

// listTable管理(イベントやPoi情報を表示)
class ListTable {
    #list;
    #flist;
    #categorys;

    // dataListに必要な初期化
    init() {
        console.log("listTable: init.")
        this.lock = false		// true then disable listtable
        this.#list = []			// リストデータ本体
        this.#flist = [];
        this.#categorys;

        // カードクリックイベント
        this.lock = false;
        const listArea = document.getElementById("listArea");
        listArea.addEventListener("click", (event) => {
            const item = event.target.closest(".list-group-item");
            if (!item || !listArea.contains(item)) return;
            if (this.lock) return;
            this.lock = true;
            this.select(item.dataset.id);
        });
    }

    // 現在選択しているカテゴリを返す(表示とvalueが違う場合はvalue)
    getSelCategory() {
        return list_category.value.split(",")
    }

    // 表示しているリストを返す
    getFilterList() {
        return this.#flist
    }

    // 表示しているリスト数を返す
    getFlistCount() {
        return this.#flist.length
    }

    // 無効化(選択できなくする or 有効化)
    disabled(mode) {
        list_category.disabled = mode
        list_keyword.disabled = mode
        this.lock = mode
    }

    // make Select list
    makeSelectList(target) {
        //let oldselect = list_category.value == "" ? Conf.selectItem.default : list_category.value;
        let oldselect = list_category.value;
        let domSel = [];
        this.#categorys = [["-", ""]];

        winCont.clearSelect(`list_category`);
        switch (target) {
            case "activity":	// アクティビティリストのカテゴリを表示
                let acts = new Map;
                for (const act of poiCont.pois().acts) {
                    if (act.category !== "") {
                        act.category.split(",").forEach(cat => acts.set(cat, true)); // 同じキーに何度も値を設定しても問題ない
                    }
                }
                acts = Array.from(acts.keys())
                for (const category of acts) {
                    if (category !== "") {
                        domSel.push([category, category])
                        this.#categorys.push(["activity", category])
                    }
                }
                domSel = domSel.sort();
                break
            case "tags":		// タグからカテゴリを表示
                let pois = this.#list.map(data => {
                    let rets = []
                    data.forEach(col => rets.push(col == undefined ? "" : col))
                    return rets
                })
                pois = [...new Set(pois.map(JSON.stringify))].map(JSON.parse)       // 重複削除
                let categoryCol = Conf.list.columns.poiFields.indexOf("#category")  // #categoryの場所を探す
                pois.filter(Boolean).sort().map(poi => {
                    let poiview = false;
                    poi[poi.length - 2].forEach(a => {  // カテゴリの追加が必要ならpoiview = true
                        if (Conf.osm[a] !== undefined && Conf.poiView.poiZoom[a] !== undefined) {
                            poiview = Conf.osm[a].expression.poiView ? true : poiview;
                        }
                    })
                    if (poiview) {
                        let kv = target + "," + poi[poi.length - 3].replace("=", ".")
                        domSel.push([poi[categoryCol], kv])
                        if (!this.#categorys.some(category => category[1] === kv)) {
                            this.#categorys.push([poi[categoryCol], kv])
                        }
                    }
                })
                domSel = domSel.sort();
                break
            case "menu":        // メニューからカテゴリを表示
                Object.keys(Conf.selectItem.menu).forEach((key) => {
                    domSel.push([key, Conf.selectItem.menu[key]])
                    this.#categorys.push([key, Conf.selectItem.menu[key]])
                })
                break
        }
        domSel.forEach(sel => winCont.addSelect(`list_category`, sel[0], sel[1]))
        list_category.value = oldselect
        this.#categorys = basic.uniq(this.#categorys)
    }

    // リスト作成
    makeList() {
        let targets = []
        switch (Conf.listTable.target) {
            case "targets":
                targets = poiCont.getTargets().filter(target => {                                                    // poiView=trueのみ返す
                    return Conf.osm[target] !== undefined ? Conf.osm[target].expression.poiView : false;
                })
                break
            case "activity": targets = ["activity"]; break
            default:
                targets = Object.keys(Conf.osm).filter(key => Conf.osm[key].expression?.poiView === true); // リストに掲載するPoi種別
                targets.push("activity")
                break
        }
        this.#list = poiCont.makeList(targets, Conf.listTable.allActs); // 全て表示時はtrue
        let already = {};	// 重複するidは最初だけに絞るとしたが、(2025/11/09)
        this.#list = this.#list.filter(row => {
            already[row[0]] = already[row[0]] !== undefined ? false : true;
            return already[row[0]];
        })
        let categorys = this.getSelCategory(), keyword = "";
        if (categorys[0] == "tags") {
            keyword = categorys[1].replace(".", "=")    // タグ時はtagを元に戻す
        } else {
            keyword = categorys[categorys.length - 1]   // 配列時は最後のデータをキーワード
        }
        let fieldName = Conf.listTable.category == "activity" ? "actFields" : "poiFields"
        let ccol = Conf.list.columns[fieldName].length                  // columns +1がカテゴリ名
        this.#flist = this.#filter(this.#list, keyword, ccol);	    // カテゴリ名でフィルタ
        this.#flist.forEach(row => row[2] === "" && (row[2] = ""));    // 名前が空欄なら""へ"
        this.makeListArea(this.#flist);
    };

    // リストを作成
    makeListArea(flist) {
        const listArea = document.getElementById("listArea");
        listArea.innerHTML = ""; // 既存のカードをクリア

        let listGroup = document.createElement("div");
        listGroup.className = "list-group";

        flist.forEach(row => {
            let list = document.createElement("a");
            list.dataset.id = row[0]; // OSMIDをdata-id属性に保存
            list.className = "list-group-item list-group-item-action";
            list.href = "#"; // リンクとして機能させる

            let items = document.createElement("div");
            items.className = "row";
            list.appendChild(items);

            Conf.list.columns.style.forEach((col, index) => {
                let name = col.glotName ? glot.get(col.glotName) : "";
                let value = row[index + 1] !== undefined && row[index + 1] !== "" ? row[index + 1] : "";
                let part = document.createElement("div");
                if (col.icon == true) {
                    let icon = document.createElement("img");
                    icon.src = window.withAppAssetVersion(`./icon/${row[row.length - 1]}`);
                    icon.className = "list-icon";
                    part.prepend(icon);
                }
                if (value !== "") {
                    let span = document.createElement("span");
                    span.className = "align-middle";
                    span.textContent = name + value;
                    part.appendChild(span);
                    part.className = col.className ? col.className : "";
                    items.appendChild(part);
                }
            })
            listGroup.appendChild(list);
        })
        listArea.appendChild(listGroup);
    }

    // リスト選択
    select(id) {
        let row = document.querySelector(`[data-id="${id}"]`);
        row.classList.add("selected");
        row.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
        poiCont.select(id, true)
            .catch(err => { console.error(err); })
            .finally(() => { this.lock = false; });
    }

    // subset of change list_keyword
    filterKeyword(keyword) {
        if (this.#list.length > 0) {
            this.filterCategory(this.getSelCategory());       // 一旦、今の選択肢でフィルタ
            this.#flist = this.#filter(this.#flist, keyword, -1);
            this.makeListArea(this.#flist);
        };
    };

    // subset of change list_category / categorys:select array(main,sub key)
    filterCategory(categorys) {
        console.log("listTable: filterCategory")
        if (this.#list.length > 0) {
            const isTags = categorys[0] == "tags";
            const fieldName = Conf.listTable.category == "activity" ? "actFields" : "poiFields";
            const ccol = isTags
                ? Conf.list.columns.poiFields.length
                : Conf.list.columns[fieldName].indexOf("category");
            const keyword = isTags
                ? (categorys[1] || "").replace(".", "=")
                : categorys[categorys.length - 1];
            this.#flist = keyword !== "-" ? this.#filter(this.#list, keyword, ccol) : this.#list;
            this.makeListArea(this.#flist);
        };
    };

    // 指定したキーワードで絞り込み col: 列番号(-1は全て)
    // targetList: OSMID, CategoryName, SubCategory or Names, MainTag, SubTag, Targets(配列)
    #filter(targetList, keyword, col) {
        if (targetList == undefined) return [];
        if (keyword == "") return targetList;
        let fieldName = Conf.listTable.category == "activity" ? "actFields" : "poiFields"
        let ccol = Conf.list.columns[fieldName].indexOf(fieldName == "actFields" ? "id" : "#id");
        if (ccol == -1) {
            console.log(`Not Found.Conf.list.columns.${fieldName}.${fieldName == "actFields" ? "id" : "#id"}`)
            return []
        }
        let retval = targetList.filter((row) => {
            let cols = col == -1 ? row.join(',') : row[col];
            cols = Array.isArray(cols) ? cols.join(",") : cols;
            let osm = poiCont.get_osmid(row[0])
            if (osm == undefined) {
                let act = poiCont.get_actid(row[0])
                if (act !== undefined) osm = poiCont.get_osmid(act.osmid)
            }
            let prop = osm.geojson.properties       // geoJsonからも検索
            cols += "," + Object.entries(prop)
                .filter(([key, value]) => key.startsWith("name") || key.endsWith("name"))
                .map(([key, value]) => value)
                .filter(value => value !== undefined && value !== null && value !== "")
                .join(", ");
            cols = cols.toLowerCase()
            return (cols.indexOf(keyword.trim().replace('.', '=').toLowerCase()) > -1) || keyword == "-";
        });
        return retval;
    };

    filterByPoiStatus(visitedFilterStatus, favoriteFilter) {
        console.log("listTable: filterByPoiStatus");
        if (this.#list.length > 0) {
            // 訪問済みフィルター
            if (visitedFilterStatus == "visited") {
                this.#flist = this.#flist.filter(osmid => {
                    // localStorageの全keyを操作し、osmid を含むものを探す
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        const concatLocalSave_osmid = Conf.etc.localSave + "." + osmid;
                        if (concatLocalSave_osmid.startsWith(key)) {
                            const value = localStorage.getItem(key);
                            if (value) {
                                const poiStatus = value.split(",");
                                if (poiStatus[PoiStatusIndex.VISITED].startsWith("true")) {	// 1つ目の要素は訪問済みフラグ
                                    return true;
                                }
                            }
                        }
                    }
                    return false;
                });
            }
            else if (visitedFilterStatus == "unvisited") {
                this.#flist = this.#flist.filter(osmid => {
                    // localStorageの全keyを操作し、osmid を含むものを探す
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        const concatLocalSave_osmid = Conf.etc.localSave + "." + osmid;
                        if (concatLocalSave_osmid.startsWith(key)) {
                            const value = localStorage.getItem(key);
                            if (value) {
                                const poiStatus = value.split(",");
                                if (poiStatus[PoiStatusIndex.VISITED].startsWith("true")) {
                                    return false;
                                }
                            }
                        }
                    }
                    return true;
                });
            }

            // お気に入りフィルター
            if (favoriteFilter) {
                this.#flist = this.#flist.filter(osmid => {
                    // localStorageの全keyを操作し、osmid を含むものを探す
                    for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        const concatLocalSave_osmid = Conf.etc.localSave + "." + osmid;
                        if (concatLocalSave_osmid.startsWith(key)) {
                            const value = localStorage.getItem(key);
                            if (value) {
                                const poiStatus = [...value.split(","), ""];
                                if (poiStatus[PoiStatusIndex.FAVORITE].startsWith("true")) {
                                    return true;
                                }
                            }
                        }
                    }
                    return false;
                });
            }
            this.makeListArea(this.#flist);
        }
    }

    // select category
    selectCategory(catname) {
        const selectedValue = Array.isArray(catname) ? catname.join(",") : String(catname ?? "");
        for (const category of this.#categorys) {
            if (category[1] === selectedValue) {
                list_category.value = category[1];
                this.filterCategory(listTable.getSelCategory())
                break
            };
        };
    };
}
