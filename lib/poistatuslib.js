
class PoiStatusCont {

    // The public array API is retained for map markers and existing callers. New
    // records are objects so visit metadata can be added without changing slots.
    getValueByOSMID(osmid) {
        const record = this.getRecord(osmid);
        return [record.visited, record.favorite, record.memo];
    }

    getStatusId(id) {
        const value = String(id ?? "");
        if (/^(node|way|relation)\/\d+$/.test(value)) return value;
        const activity = typeof poiCont !== "undefined" ? poiCont.get_actid?.(value) : null;
        return /^(node|way|relation)\/\d+$/.test(String(activity?.osmid ?? "")) ? activity.osmid : value;
    }

    getRecord(osmid) {
        const empty = { visited: false, favorite: false, memo: "" };
        if (!Conf.etc.localSave) return empty;
        const id = this.getStatusId(osmid);
        try {
            const raw = localStorage.getItem(`${Conf.etc.localSave}.${id}`);
            if (raw) return this.#parseRecord(raw);
            // Earlier activity lists saved WP/... keys. Keep them readable until
            // a facility-level record is explicitly written, including false.
            const aliases = new Set();
            const activities = typeof poiCont !== "undefined" ? poiCont.getActlistByOsmid?.(id) ?? [] : [];
            for (const activity of activities) if (activity.id !== id) aliases.add(activity.id);
            if (id !== String(osmid)) aliases.add(String(osmid));
            const records = [...aliases].map(alias => localStorage.getItem(`${Conf.etc.localSave}.${alias}`))
                .filter(Boolean).map(raw => this.#parseRecord(raw));
            if (!records.length) return empty;
            return { ...Object.assign({}, ...records.slice().reverse()), visited: records.some(record => record.visited),
                favorite: records.some(record => record.favorite), memo: records.find(record => record.memo)?.memo ?? "" };
        } catch { return empty; }
    }

    #parseRecord(raw) {
        const empty = { visited: false, favorite: false, memo: "" };
        if (raw.startsWith("{")) {
            try {
                const record = JSON.parse(raw);
                if (!record || typeof record !== "object" || Array.isArray(record)) return empty;
                return { ...record, visited: record.visited === true,
                    favorite: record.favorite === true, memo: String(record.memo ?? "") };
            } catch { return empty; }
        }
        const [visited, favorite, ...memo] = raw.split(",");
        return { visited: visited?.toLowerCase() === "true",
            favorite: favorite?.toLowerCase() === "true", memo: memo.join(",").replace(/\r/g, "") };
    }

    setValueByOSMID(osmid, visited, favorite, memo) {
        if (!Conf.etc.localSave) return;
        const previous = this.getRecord(osmid);
        const id = this.getStatusId(osmid);
        try {
            localStorage.setItem(`${Conf.etc.localSave}.${id}`, JSON.stringify({
                ...previous, visited: Boolean(visited), favorite: Boolean(favorite), memo: String(memo ?? "")
            }));
        } catch { /* Storage may be disabled; keep map use available. */ }
    }

    getAllVisited() { return this.#getAllLocalStorage(record => record.visited); }
    getAllFavorite() { return this.#getAllLocalStorage(record => record.favorite); }

    #getAllLocalStorage(conditionFn) {
        if (!Conf.etc.localSave) return [];
        const prefix = `${Conf.etc.localSave}.`;
        const matched = [];
        const seen = new Set();
        try {
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (!key?.startsWith(prefix)) continue;
                const id = this.getStatusId(key.slice(prefix.length));
                if (seen.has(id)) continue;
                seen.add(id);
                const record = this.getRecord(id);
                if (conditionFn(record)) matched.push([prefix + id, record]);
            }
        } catch { /* Storage may be disabled; return no saved records. */ }
        return matched;
    }

    export() {
        console.log("export POI status:")
        let csvContent = "key,category,name,visited,favorite,memo\n";
        const prefix = `${Conf.etc.localSave}.`;
        const csvCell = value => `"${String(value ?? "").replace(/"/g, '""')}"`;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (!key.startsWith(prefix)) continue;
            const osmid = key.slice(prefix.length);
            const pois = poiCont.get_osmid(osmid);
            if (pois === undefined) continue;
            const category = poiCont.getCatnames(pois.geojson.properties)[0];
            const name = pois.geojson.properties.name ?? "";
            const record = this.getRecord(osmid);
            csvContent += [key, category, name, record.visited, record.favorite, record.memo]
                .map(csvCell).join(",") + "\n";
        }

        // CSVをダウンロードさせる
        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "localStorage_export.csv";
        a.click();
        URL.revokeObjectURL(url);
    }

    import() {
        let msg = { msg: glot.get("file_select"), ttl: glot.get("file_select") }
        winCont.setSidebar("view")
        mapLibre.viewMiniMap(false)
        winCont.makeDetail({
            "title": msg.ttl, "mode": ["yes", "no"], callback_yes: this.import_load, "menu": false,
            "message": '<input type="file" id="csvInput" class="form-control" accept=".csv,text/csv">',
            "append": Conf.menu.visited
        });
    }

    import_load() {
        console.log("import POI status:")
        if (csvInput.files.length > 0) {    // ファイルが選択された時
            let file = csvInput.files[0];
            const reader = new FileReader();
            reader.readAsText(file, "utf-8");
            reader.onload = function (e) {
                const text = e.target.result;
                const lines = text.trim().split("\n");
                const header = lines.shift(); // ヘッダーを削除

                if (header.startsWith("key,category,name,visited,memo")) {
                    lines.forEach(line => {
                        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s =>
                            s.replace(/^"|"$/g, "").replace(/""/g, '"').replace(/\r/g, '')  // CSVエスケープ解除
                        );
                        const key = values[PoiStatusCsvIndexOld.KEY];
                        const poiStatusCSV = values[PoiStatusCsvIndexOld.VISITED].toLowerCase() + ",false," + values[PoiStatusCsvIndexOld.MEMO];
                        if (key?.startsWith(`${Conf.etc.localSave}.`)) localStorage.setItem(key, poiStatusCSV);
                    })
                } else if (header.startsWith("key,category,name,visited,favorite,memo")) {
                    lines.forEach(line => {
                        const values = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s =>
                            s.replace(/^"|"$/g, "").replace(/""/g, '"').replace(/\r/g, '')  // CSVエスケープ解除
                        );
                        const key = values[PoiStatusCsvIndex.KEY];
                        const poiStatusCSV = values[PoiStatusCsvIndex.VISITED].toLowerCase() + "," + values[PoiStatusCsvIndex.FAVORITE].toLowerCase() + "," + values[PoiStatusCsvIndex.MEMO];
                        if (key?.startsWith(`${Conf.etc.localSave}.`)) localStorage.setItem(key, poiStatusCSV);
                    })
                } else {
                    winCont.addDetailMessage(glot.get("file_error"), true)
                    return;
                }
                setTimeout(() => {
                    let msg = { ttl: glot.get("results"), txt: glot.get("file_loaded") };
                    winCont.makeDetail({ "title": msg.ttl, "message": msg.txt, "menu": false, "mode": "close", "callback_close": winCont.closeModal });
                }, 500);
            }
        } else {
            winCont.addDetailMessage(glot.get("file_notfound"), true)
        }
        console.log("import  POI status: End")
    }
}
