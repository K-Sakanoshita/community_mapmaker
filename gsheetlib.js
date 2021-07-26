// Google Spreadsheet Class Library Script.
"use strict";

class GoogleSpreadSheet {

	constructor() {
		this.last_getdate = "";
	};

	get(GET_Url) {				// サーバーからデータを収集する
		return new Promise(function (resolve, reject) {
			console.log("GoogleSpreadSheet: GET: " + GET_Url);
			$.ajax({ type: "get", url: GET_Url, dataType: "jsonp", cache: false, jsonpCallback: 'GDocReturn' }).then(function (json) {
				console.log("GoogleSpreadSheet: GET: OK");
				let pattern = /on[\w]+=[\"\']?[^>]*[\"\']?>/si;
				json.forEach(val => val.body = val.body.replace(pattern, '>'));	// Minimal sanitization for "on~" tags(onclick,onload etc)
				gSpreadSheet.last_getdate = new Date(Date.now());
				resolve(json);
			}, () => {
				alert("GoogleSpreadSheet: get ng.");
				reject([]);
			});
		});
	};

	get_salt(GET_Url,userid){			// サーバーからSaltを取得する
		return new Promise(function (resolve, reject) {
			let ggeturl = GET_Url + '?userid=' + userid;
			console.log("GoogleSpreadSheet: GET: " + ggeturl);
			$.ajax({ "type": "get", "url": ggeturl, dataType: "jsonp", cache: false, jsonpCallback: 'GDocReturn' }).then(json => {
				resolve(json);
			}, json => {
				reject(json);
			});
		});
	};

	set(GET_Url, json, mode, userid, passwd) {	// サーバーにデータを投稿する(1件)
		return new Promise(function (resolve, reject) {
			let jsonp = JSON.stringify([json]);
			let ggeturl = GET_Url + '?json=' + jsonp + '&mode=' + mode + '&userid=' + userid + '&passwd=' + passwd;
			console.log("GoogleSpreadSheet: GET: " + ggeturl);
			jsonp = jsonp.replace(/\?/g, '？');
			jsonp = jsonp.replace(/\&/g, '＆');
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
var gSpreadSheet = new GoogleSpreadSheet();
