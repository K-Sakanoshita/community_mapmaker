// Google Spreadsheet Class Library Script.
"use strict";

class GoogleSpreadSheet {

	constructor() {
		this.last_getdate = "";
	};

	get(GET_Url) {				// サーバーからデータを収集する
		return new Promise(function (resolve, reject) {
			if (GET_Url == "") {
				resolve([]);
			} else {
				console.log("GoogleSpreadSheet: GET: " + GET_Url);
				$.ajax({ type: "get", url: GET_Url, dataType: "jsonp", cache: false, jsonpCallback: 'GDocReturn' }).then(function (json) {
					console.log("[success]GoogleSpreadSheet: GET: OK");
					let pattern = /on[\w]+=[\"\']?[^>]*[\"\']?>/si;
					json.forEach(val => {
						Object.keys(val).forEach(key => { val[key] = typeof val[key] == "string" ? val[key].replace(pattern, '>') : val[key] });
					});	// Minimal sanitization for "on~" tags(onclick,onload etc)
					gSheet.last_getdate = new Date(Date.now());
					resolve(json);
				}, () => {
					console.log("GoogleSpreadSheet: GET: NG");
					reject([]);
				});
			}
		});
	};

	get_salt(GET_Url, userid) {			// サーバーからSaltを取得する
		return new Promise(function (resolve, reject) {
			if (GET_Url == "") {
				resolve([]);
			} else {
				let ggeturl = GET_Url + '?userid=' + userid;
				console.log("GoogleSpreadSheet: GET: " + ggeturl);
				$.ajax({ "type": "get", "url": ggeturl, dataType: "jsonp", cache: false, jsonpCallback: 'GDocReturn' }).then(json => {
					resolve(json);
				}, json => {
					reject(json);
				});
			}
		});
	};

	set(GET_Url, json, mode, userid, passwd) {	// サーバーにデータを投稿する(1件)
		return new Promise(function (resolve, reject) {
			let jsonp = JSON.stringify([json]);
			jsonp = jsonp.replace(/\&/g, '%26');
			let ggeturl = GET_Url + '?json=' + jsonp + '&mode=' + mode + '&userid=' + userid + '&passwd=' + passwd;
			console.log("GoogleSpreadSheet: GET: " + ggeturl);
			$.ajax({ "type": "get", "url": ggeturl, dataType: "jsonp", cache: false, jsonpCallback: 'GDocReturn' }).then(json => {
				resolve(json);
			}, json => {
				reject(json);
			});
		});
	};

	sets(GET_Url, commits) {				// サーバーにデータを投稿する(複数)
		return new Promise(function (resolve, reject) {
			$.ajax({ "type": "get", "url": GET_Url + '?json=' + JSON.stringify(commits), cache: false }).then(function () {
				resolve();
			}, function (json) {
				reject(json);
			});
		});
	};
};
var gSheet = new GoogleSpreadSheet();
