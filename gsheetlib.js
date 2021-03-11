// Google Spreadsheet Class Library Script.
"use strict";

class GoogleSpreadSheet {

	constructor() {
        this.last_getdate = "";
    };

	get(GET_Url, sheetname) {					// サーバーからデータを収集する
		return new Promise(function (resolve, reject) {
			console.log("GoogleSpreadSheet: get start.")
			$.ajax({ type: "get", url: GET_Url + '?sheet=' + sheetname, dataType: "jsonp", cache: false, jsonpCallback: 'GDocReturn' }).then(function (json) {
				console.log("GoogleSpreadSheet: get ok.");
				let pattern = /on[\w]+=[\"\']?[^>]*[\"\']?>/si;
				json.forEach(val => val.body = val.body.replace(pattern, '>'));	// Minimal sanitization for "on~" tags(onclick,onload etc)
				gSpreadSheet.last_getdate = new Date(Date.now());
				resolve(json);
			}, json => {
				alert("GoogleSpreadSheet: get ng.");
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
};
var gSpreadSheet = new GoogleSpreadSheet();
