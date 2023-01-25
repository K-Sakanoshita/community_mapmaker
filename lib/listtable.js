"use strict";

// listTable管理(イベントやPoi情報を表示)
class listTable {

	static init() { // dataListに必要な初期化
		console.log("listTable: init.");
		listTable.columns = Conf.list.columns.common;
		listTable.height = window.innerHeight * 0.4;
		listTable.grid;
		listTable.lock = false;		// true then disable listtable
		listTable.list = [];
		listTable.flist;
		listTable.categorys = [];
	};

	static disabled(mode) {
		list_category.disabled = mode;
		list_keyword.disabled = mode;
		listTable.lock = mode;
	};

	// リスト作成
	static make() {
		listTable.list = [];
		for (const target of Conf.listTable.targets) {
			let mod_target = target == "targets" ? Conf.PoiView.targets : [target];
			listTable.list = listTable.list.concat(listTable.list, poiCont.list(mod_target));
		}
		let duplicate = [];
		listTable.list = listTable.list.filter(datas => {
			if (duplicate[datas[0]] == undefined) {
				duplicate[datas[0]] = true;
				return datas;
			};
		});

		listTable.flist = this.#filter(list_category.value, 1);
		let option = { "columns": listTable.columns, "data": listTable.flist, "height": listTable.height, sort: true, fixedHeader: true, "autoWidth": false };
		if (listTable.grid !== undefined) {
			listTable.grid.updateConfig(option).forceRender(document.getElementById("tableid"));
		} else {
			listTable.grid = new gridjs.Grid(option).render(document.getElementById("tableid"));
		};
		if (listTable.grid.callbacks.rowClick == undefined) {
			listTable.grid.on('rowClick', (...args) => {
				console.log("listTable: rowClick start");
				if (!listTable.lock) {
					listTable.lock = true;
					winCont.spinner(true);
					try {
						let actid = args[1].cell(0).data;
						listTable.select(actid);
						poiMarker.select(actid, true).then(() => {
							console.log("listTable: rowClick OK");
						}).catch(() => {
							console.log("listTable: rowClick NG");
						}).then(() => { listTable.lock = false });
					} catch (error) {
						winCont.spinner(false);
						listTable.lock = false;
					};
				};
			});
		};
	};

	// リスト選択
	static select(actid) {
		let rows = document.getElementsByClassName('gridjs-tr selected');
		if (rows.length > 0) Array.from(rows).forEach(row => { row.classList.remove("selected") });
		let lstidx = listTable.flist.findIndex(elm => elm[0] === actid);
		if (lstidx > -1) {
			let row = document.querySelector("#tableid table").rows[lstidx + 1];
			row.classList.add("selected");
			row.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
		}
	}

	// subset of change list_keyword
	static filter_keyword() {
		if (listTable.list.length > 0) {
			listTable.flist = this.#filter(list_keyword.value, -1);
			listTable.grid.updateConfig({ "data": listTable.flist }).forceRender(document.getElementById("tableid"));
		};
	};

	// make category list
	static make_category(targets) {
		let oldselect = list_category.value == "" ? "-" : list_category.value;
		console.log(`listtable: make_category(now ${oldselect})`);
		let pois = [];
		winCont.select_clear(`list_category`);
		for (const target of targets) {
			switch (target) {
				case "targets":		// ターゲットリストからカテゴリを表示
					pois = targets.map(name => { return [glot.get(`target_${name}`), name] });
					pois.map(poi => {
						winCont.select_add(`list_category`, poi[0], poi[1]);
						listTable.categorys.push(poi[1]);
					});
					break;
				case "activity":	// アクティビティリストのカテゴリを表示
					let acts = new Map;
					for (const act of poiCont.pois().acts) {
						if (act.category !== "") acts.set(act.category, true); // 同じキーに何度も値を設定しても問題ない
					};
					acts = Array.from(acts.keys());
					for (const category of acts) {
							if (category !== "") {
								winCont.select_add(`list_category`, category, category);
								listTable.categorys.push(category);
							};
					};
					break;
				default:			// 指定したターゲットからカテゴリを表示
					pois = listTable.list.map(data => {
						let rets = [];
						data.forEach(col => rets.push(col == undefined ? "" : col));
						return rets;
					});
					pois = [...new Set(pois.map(JSON.stringify))].map(JSON.parse);
					pois.filter(Boolean).sort().map(poi => {
						if (poi[poi.length - 1].join(",").indexOf(target) > -1) {
							winCont.select_add(`list_category`, poi[1], poi[1]);
							listTable.categorys.push(poi[1]);
						};
					});
					break;
			};
		};
		list_category.value = oldselect;
		console.log(`listtable: make_category End.`);
	};

	// select category
	static select_category(catname) {
		for (const category of listTable.categorys) {
			if (catname == category) {
				list_category.value = catname;
				break;
			}
		};
	};

	static filter_category(target) {		// subset of change list_category
		if (listTable.list.length > 0) {
			listTable.flist = target !== "-" ? listTable.#filter(target, 1) : listTable.list;
			listTable.grid.updateConfig({ "data": listTable.flist, "autoWidth": false }).forceRender(document.getElementById("tableid"));
		};
	};

	static heightSet(height) {								// set table height
		listTable.grid.updateConfig({ "height": height }).forceRender(document.getElementById("tableid"));
		cMapmaker.mode_change('list');
	};

	static #filter(keyword, col) {								// 指定したキーワードで絞り込み col: 列番号(-1は全て)
		if (listTable.list == undefined) return [];
		return listTable.list.filter((row) => {
			let cols = col == -1 ? row.join(',') : row[col];
			return (cols.indexOf(keyword) > -1) || keyword == "-";
		});
	};
}
