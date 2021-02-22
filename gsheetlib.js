// Google Spreadsheet Class Library Script.
"use strict";

class GoogleSpreadSheet {

	get(GET_Url, sheetname) {					// サーバーからデータを収集する
		return new Promise(function (resolve, reject) {
			console.log("GoogleSpreadSheet: get start.")
			$.ajax({ type: "get", url: GET_Url + '?sheet=' + sheetname, dataType: "jsonp", cache: false, jsonpCallback: 'GDocReturn' }).then(function (json) {
				console.log("GoogleSpreadSheet: get end.")
				resolve(json);
			}, json => {
				alert("POST_Ng");
				reject([]);
			});
		});
	}

	set(GET_Url, json, sheetname, silent) {	// サーバーにデータを投稿する(1件)
		return new Promise(function (resolve, reject) {
			let jsonp = JSON.stringify([json]);
			jsonp = jsonp.replace(/\?/g, '？');
			jsonp = jsonp.replace(/\&/g, '＆');
			$.ajax({ "type": "get", "url": GET_Url + '?json=' + jsonp + '&sheet=' + sheetname, dataType: "jsonp", cache: false, jsonpCallback: 'GDocReturn' }).then(json => {
				if (!silent) alert("POST_Ok");
				resolve(json);
			}, json => {
				if (!silent) alert("POST_Ng");
				reject(json);
			});
		});
	}

	sets(GET_Url, commits) {			// サーバーにデータを投稿する(複数)
		return new Promise(function (resolve, reject) {
			$.ajax({ "type": "get", "url": GET_Url + '?json=' + JSON.stringify(commits), cache: false }).then(function () {
				resolve();
			}, function (json) {
				reject(json);
			});
		});
	}

	update(query) {	// OSM overpass qlをもとにPOIデータを取得
		return new Promise(function (resolve, reject) {
			let maparea = '(' + bounds_all[1][0] + ',' + bounds_all[0][1] + ',' + bounds_all[0][0] + ',' + bounds_all[1][1] + ')';
			let ovpass = OvServer + '?data=[out:json][timeout:25];(';
			for (let q in query) ovpass += query[q] + maparea;
			ovpass += ';); out;>; out skel qt;';
			console.log(ovpass);

			//ProgressBar.show(0);
			//ProgressBar.button(false);
			//ProgressBar.message(UPDT_NW);
			$.get(ovpass).done(function (data) {
				let task = [];
				data.elements.forEach(function (ele) {
					let same = POIs.filter(poi => poi.OSMID == ele.id);
					if (same.length == 0) {		// 重複が無い場合(新規登録)
						let commit = { 'OSMID': ele.id, '緯度': ele.lat, '経度': ele.lon, '種別': ele.tags['species:ja'] };
						task.push(commit);
					};
				});

				let tasks = divideArray(task, 10);	// taskを30個毎にまとめたtasksを作る
				let idx = 0;
				let maxidx = tasks.length;
				update_loop(tasks, idx, maxidx, function () {
					//ProgressBar.message("UPDT_ok");
					//ProgressBar.button(true);
				});
			});

			// tasks内を1件ずつ同期する再帰処理
			function update_loop(tasks, idx, maxidx, calllback) {
				console.log("update_loop: " + idx + "/" + maxidx);
				//ProgressBar.show(Math.ceil(idx / maxidx) * 100);
				this.sets(tasks[idx++]).then(function () {
					if (idx < maxidx) update_loop(tasks, idx, maxidx, calllback);
				});
				calllback();
			};

		})
	}
};
var gSpreadSheet = new GoogleSpreadSheet();
