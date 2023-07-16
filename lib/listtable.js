"use strict";

// listTable管理(イベントやPoi情報を表示)
class ListTable {

	init() { // dataListに必要な初期化
		console.log("listTable: init.");
		this.columns = Conf.list.columns.common;
		this.height = window.innerHeight * Conf.list.height;
		this.grid;
		this.lock = false;		// true then disable listtable
		this.list = [];
		this.flist;
		this.categorys = [];
	};

	// 現在選択しているカテゴリを返す(表示とvalueが違う場合はvalue)
	getSelCategory() {
		return list_category.value.split(",");
	}

	// 表示しているリストを返す
	getFilterList() {
		return this.flist;
	}

	// 表示しているリスト数を返す
	getFlistCount() {
		return this.flist.length;
	}

	disabled(mode) {
		list_category.disabled = mode;
		list_keyword.disabled = mode;
		this.lock = mode;
	};

	// リスト作成
	make() {
		this.list = [];
		for (const target of Conf.listTable.targets) {
			let mod_target = target == "targets" ? Conf.PoiView.targets : [target];
			this.list = this.list.concat(this.list, poiCont.list(mod_target));
		}
		let duplicate = [];
		this.list = this.list.filter(datas => {
			if (duplicate[datas[0]] == undefined) {
				duplicate[datas[0]] = true;
				return datas;
			};
		});

		this.flist = this.#filter(list_category.value, 1);
		let option = { "columns": this.columns, "data": this.flist, "height": this.height, sort: true, fixedHeader: true, "autoWidth": false };
		if (this.grid !== undefined) {
			this.grid.updateConfig(option).forceRender(document.getElementById("tableid"));
		} else {
			this.grid = new gridjs.Grid(option).render(document.getElementById("tableid"));
		};
		if (this.grid.callbacks.rowClick == undefined) {
			this.grid.on('rowClick', (...args) => {
				console.log("listTable: rowClick start");
				if (!this.lock) {
					this.lock = true;
					winCont.spinner(true);
					try {
						let actid = args[1].cell(0).data;
						this.select(actid);
						poiMarker.select(actid, true).then(() => {
							console.log("listTable: rowClick OK");
						}).catch(() => {
							console.log("listTable: rowClick NG");
						}).then(() => { this.lock = false });
					} catch (error) {
						winCont.spinner(false);
						this.lock = false;
					};
				};
			});
		};
	};

	// リスト選択
	select(actid) {
		let rows = document.getElementsByClassName('gridjs-tr selected');
		if (rows.length > 0) Array.from(rows).forEach(row => { row.classList.remove("selected") });
		let lstidx = this.flist.findIndex(elm => elm[0] === actid);
		if (lstidx > -1) {
			let row = document.querySelector("#tableid table").rows[lstidx + 1];
			row.classList.add("selected");
			row.scrollIntoView({ behavior: "smooth", block: "end", inline: "nearest" });
		}
	}

	// subset of change list_keyword
	filterKeyword() {
		if (this.list.length > 0) {
			this.flist = this.#filter(list_keyword.value, -1);
			this.grid.updateConfig({ "data": this.flist }).forceRender(document.getElementById("tableid"));
		};
	};

	filterCategory(categorys) {		// subset of change list_category
		categorys = categorys[categorys.length - 1];		// 複数値は最後の値（表示名）を使う
		if (this.list.length > 0) {
			this.flist = categorys !== "-" ? this.#filter(categorys, 1) : this.list;
			this.grid.updateConfig({ "data": this.flist, "autoWidth": false }).forceRender(document.getElementById("tableid"));
		};
	};

	// subset of target no update flist
	filterTarget(target) {
		if (this.list.length > 0 && target !== "") {
			return this.#filter(target, this.list[0].length - 1);
		};
	}

	#filter(keyword, col) {								// 指定したキーワードで絞り込み col: 列番号(-1は全て)
		if (this.list == undefined) return [];
		return this.list.filter((row) => {
			let cols = col == -1 ? row.join(',') : row[col];
			return (cols.indexOf(keyword) > -1) || keyword == "-";
		});
	};


	// make category list
	makeCategory(targets) {
		let oldselect = list_category.value == "" ? "-" : list_category.value;
		console.log(`listtable: makeCategory(now ${oldselect})`);
		let pois = [];
		winCont.select_clear(`list_category`);
		for (const target of targets) {
			switch (target) {
				case "targets":		// ターゲットリストからカテゴリを表示
					pois = targets.map(name => { return [glot.get(`target_${name}`), name] });
					pois.map(poi => {
						winCont.select_add(`list_category`, poi[0], poi[1]);
						this.categorys.push(poi[1]);
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
							this.categorys.push("activity," + category);
						};
					};
					break;
				default:			// 指定したターゲットからカテゴリを表示
					pois = this.list.map(data => {
						let rets = [];
						data.forEach(col => rets.push(col == undefined ? "" : col));
						return rets;
					});
					pois = [...new Set(pois.map(JSON.stringify))].map(JSON.parse);
					pois.filter(Boolean).sort().map(poi => {
						if (poi[poi.length - 1].join(",").indexOf(target) > -1) {
							winCont.select_add(`list_category`, poi[1], target + "," + poi[1]);
							this.categorys.push(target + "," + poi[1]);
						};
					});
					break;
			};
		};
		list_category.value = oldselect;
		this.categorys = basic.uniq(this.categorys);
		console.log(`listtable: makeCategory End.`);
	};

	// select category
	selectCategory(catname) {
		for (const category of this.categorys) {
			if (category.split(",").indexOf(catname) > -1) {	// selectが複数(,区切り)があるため
				list_category.value = category;
				break;
			}
		};
	};

	heightSet(height) {								// set table height
		this.grid.updateConfig({ "height": height }).forceRender(document.getElementById("tableid"));
		cMapMaker.mode_change('list');
	};

}
