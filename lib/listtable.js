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
		listTable.categorys;		// category list 
	};

	static make() {
		// カテゴリのリスト表示
		listTable.list = [];
		for (const target of Conf.listTable.targets) {
			let mod_target = target == "targets" ? Conf.targets : [target];
			listTable.list = listTable.list.concat(listTable.list, poiCont.list(mod_target));
		}
		listTable.flist = this.#filter(list_category.value);
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

	// make category list
	static make_category(targets) {
		let oldselect = list_category.value == "" ? "-" : list_category.value;
		console.log(`listtable: make_category(now ${oldselect})`);
		let pois = [];
		winCont.select_clear(`list_category`);
		listTable.categorys = [];
		for (const target of targets) {
			switch (target) {
				case "targets":		// ターゲットリストからカテゴリを表示
					pois = Conf.targets.map(name => { return [glot.get(`target_${name}`), name] });
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
							winCont.select_add(`list_category`, category, category)
							listTable.categorys.push(category);
						};
					};
					break;
				default:			// 既存リストからカテゴリを表示
					pois = listTable.list.map(data => { return [data[2], data[4] == undefined ? "" : data[4][0]] });
					pois = [...new Set(pois.map(JSON.stringify))].map(JSON.parse);
					pois.sort().map(poi => {
						if (poi[1] == target) {
							winCont.select_add(`list_category`, poi[0], poi[0])
							listTable.categorys.push(poi);
						};
					});
					break;
			};
		};
		list_category.value = oldselect;
	};

	// select category
	static select_category(catname) {
		for (const category of this.categorys) {
			if (catname == category) {
				list_category.value = catname;
				break;
			}
		};
	};

	static filter_category(target) {		// subset of change list_category
		if (listTable.list.length > 0) {
			listTable.flist = target !== "-" ? this.#filter(target) : listTable.list;
			listTable.grid.updateConfig({ "data": listTable.flist, "autoWidth": false }).forceRender(document.getElementById("tableid"));
		};
	};

	static filter_keyword() {		// subset of change list_keyword
		if (listTable.list.length > 0) {
			listTable.flist = this.#filter(list_keyword.value);
			listTable.grid.updateConfig({ "data": listTable.flist }).forceRender(document.getElementById("tableid"));
		};
	};

	static disabled(mode) {
		list_category.disabled = mode;
		list_keyword.disabled = mode;
		listTable.lock = mode;
	};

	static heightSet(height) {								// set table height
		listTable.grid.updateConfig({ "height": height }).forceRender(document.getElementById("tableid"));
		cMapmaker.mode_change('list');
	};

	static select(actid) {									// リスト選択
		let rows = document.getElementsByClassName('gridjs-tr selected');
		if (rows.length > 0) Array.from(rows).forEach(row => { row.classList.remove("selected") });
		let lstidx = listTable.flist.findIndex(elm => elm[0] === actid);
		if (lstidx > -1) {
			let row = document.querySelector("#tableid table").rows[lstidx + 1];
			row.classList.add("selected");
			row.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
		}
	}

	static #filter(keyword) {								// 指定したキーワードで絞り込み
		if (listTable.list == undefined) return [];
		return listTable.list.filter((row) => {
			return (row.join(',').indexOf(keyword) > -1) || keyword == "-";
		});
	};
}
