class OSMbasic {
    // make modal html for OSM basic tags

    make(tags) {
        let catname = poiCont.getCatnames(tags);
        let elements = 0;
        let html = `<div class="d-flex justify-content-between align-items-center flex-wrap m-1">`;

        // write type
        if (catname[0] !== undefined) {
            html += `<div class="flex-row mt-1 me-3"> <i class="fas fa-square"></i> ${catname[0]}${catname[1] !== "" ? "(" + catname[1] + ")" : ""}</div>`;
            elements++;
        }

        // write brand
        let brand = [tags["brand:ja"], tags.brand].filter((a) => a !== undefined)[0];
        if (brand !== undefined) {
            html += `<div class="flex-row mt-1 me-3"> <i class="fa-solid fa-building"></i>${brand}</div>`;
            elements++;
        }

        // write changing_table
        if (tags.changing_table !== undefined) {
            let available = tags.changing_table == "yes" ? glot.get("available") : glot.get("unavailable");
            html += `<div class="flex-row mt-1 me-3"> <i class="fas fa-baby"></i> ${glot.get("changing_table")}:${available}</div>`;
            elements++;
        }

        // write wheelchair
        if (tags.wheelchair !== undefined) {
            let test = { yes: "available", no: "unavailable", limited: "limited" };
            if (test[tags.wheelchair] !== undefined) {
                let available = glot.get(test[tags.wheelchair]);
                html += `<div class="flex-row mt-1 me-3"> <i class="fas fa-wheelchair"></i> ${available}</div>`;
                elements++;
            }
        }

        // write bottle
        if (tags.bottle !== undefined) {
            let test = { yes: "available", no: "unavailable", limited: "limited" };
            if (test[tags.bottle] !== undefined) {
                let available = glot.get(test[tags.bottle]);
                html += `<div class="flex-row mt-1 me-3"> <i class="fas fa-wine-bottle"></i> ${available}</div>`;
                elements++;
            }
        }

        // write website
        let website = [tags.website, tags["contact:website"], tags["brand:website"]].filter((a) => a !== undefined)[0];
        if (website !== undefined) {
            let httpn = website.replace(/^https?:\/\//, "");
            let trunc = httpn.length > 19 ? httpn.substring(0, 29) + "..." : httpn;
            html += `<div class="flex-row mt-1 me-3"> <i class="fas fa-globe"></i> <a href="${website}" target="_new">${trunc}</a></div>`;
            elements++;
        }

        // opening_hours
        if (tags.opening_hours !== undefined) {
            let opening = basic.parseOpeningHours(tags.opening_hours)
            if (opening !== "") html += `<div class="flex-row mt-1 me-3"><i class="fa-solid fa-clock"></i>${opening}</div>`;
        }

        // write reservation
        if (tags.reservation !== undefined) {
            let reserve;
            switch (tags["reservation"]) {
                case "yes": reserve = glot.get("reservation_yes"); break;
                case "no": reserve = glot.get("reservation_no"); break;
                case "recommended": reserve = glot.get("reservation_recommended"); break;
            }
            html += `<div class="flex-row mt-1 me-3"> <i class="fa-solid fa-ticket"></i> ${reserve}</div>`;
            elements++;
        }

        // write instagram
        let instagram = [tags.instagram, tags["contact:instagram"]].filter((a) => a !== undefined)[0];
        if (instagram !== undefined) {
            instagram = this.getInstagramProfileUrl(instagram);
            if (instagram !== null) {
                html += `<div class="flex-row mt-1 me-3"> <i class="fa-brands fa-instagram"></i> <a href="${instagram[0]}" target="_new">${instagram[1]}</a></div>`;
                elements++;
            }
        }

        // write twitter(X)
        let twitter = [tags.twitter, tags["contact:twitter"]].filter((a) => a !== undefined)[0];
        if (twitter !== undefined) {
            twitter = this.getTwitterProfileUrl(twitter);
            if (twitter !== null) {
                html += `<div class="flex-row mt-1 me-3"> <i class="fa-brands fa-twitter"></i> <a href="${twitter[0]}" target="_new">${twitter[1]}</a></div>`;
                elements++;
            }
        }

        // write tel
        if (tags.phone !== undefined) {
            let phone = tags.phone
            phone = phone.startsWith("+81") ? "0" + phone.slice(3) : phone;
            html += `<div class="flex-row mt-1 me-3"> <i class="fas fa-phone-alt"></i> <a href="tel:${phone}">${phone}</a></div>`;
            elements++;
        }

        // write artist_name
        if (tags.artist_name !== undefined) {
            html += `<div class="flex-row mt-1 me-3"> <i class="fas fa-file-signature"></i> ${tags.artist_name}</div>`;
            elements++;
        }

        // write toilets
        if (tags.amenity == "toilets") {
            let test = { yes: "available", no: "unavailable", limited: "limited" };
            html += `<div class="flex-row mt-1 me-3"> `
            if (tags.female == "yes") {
                html += `<i class="fa-solid fa-venus"></i> `;
                let capacity = Number(tags["capacity:women"])
                if (capacity > 0 && capacity !== NaN) {
                    html += `:${capacity} `;
                } else {
                    html += `:${glot.get("available")} `;
                }
            }
            if (tags.male == "yes") {
                html += `<i class="fa-solid fa-mars"></i> `;
                let capacity = Number(tags["capacity:men"])
                if (capacity > 0 && capacity !== NaN) {
                    html += `:${capacity} `;
                } else {
                    html += `:${glot.get("available")} `;
                }
            }
            if (tags.unisex == "yes") {
                html += `<i class="fa-solid fa-mars-and-venus"></i> `;
                let capacity = Number(tags["capacity:unisex"])
                if (capacity > 0 && capacity !== NaN) {
                    html += `:${capacity} `;
                } else {
                    html += `:${glot.get("available")} `;
                }
            }
            html += `</div>`
            elements++;
        }

        // write level
        if (tags.level !== undefined) {
            const level = cMapMaker.formatIndoorLevel(tags.level);
            html += `<div class="flex-row mt-1 me-3"> <i class="fa-solid fa-stairs"></i> ${level}</div>`;
            elements++;
        }

        // write note
        if (tags.note !== undefined) {
            html += `<div class="flex-row mt-1 me-3"> <i class="fas fa-sticky-note"></i> ${tags.note}</div>`;
            elements++;
        }

        // write description
        if (tags.description !== undefined) {
            html += `<div class="flex-row mt-1 me-3"> <i class="fas fa-sticky-note"></i> ${tags.description}</div>`;
            elements++;
        }

        // 既に行ったかチェック
        if (Conf.etc.localSave !== "") {
            let poiStatus = poiStatusCont.getValueByOSMID(tags.id)
            html += `<div class="flex-row mt-1 me-3"><i class="fa-solid fa-person-walking me-1"></i>`;
            html += `${glot.get("visited")} <input type="checkbox" id="visited" class="m-2" name="${tags.id}" ${poiStatus[PoiStatusIndex.VISITED] ? "checked" : ""}/>`;
            html += `</div><div class="flex-row mt-1 me-3"><i class="fa-solid fa-heart me-1"></i>`;
            html += `${glot.get("favorite")} <input type="checkbox" id="favorite" class="m-2" name="${tags.id}" ${poiStatus[PoiStatusIndex.FAVORITE] ? "checked" : ""}/>`;
            html += `</div><div class="flex-row mt-1 me-3 d-flex text-nowrap align-items-center w-100">`;
            let memo = poiStatus[PoiStatusIndex.MEMO] !== undefined ? poiStatus[PoiStatusIndex.MEMO] : "";
            html += `<input type="text" id="visited-memo" maxlength="140" size="20" class="form-control ms-2" placeholder="${glot.get("reservation_memo")}" value="${memo}" /></div>`
            elements++;
        }

        // wikimedia画像の追加
        if (tags.wikimedia_commons !== undefined) {
            let wikimq = [], wikim = tags.wikimedia_commons;
            if (wikim.slice(0, 5) == "File:") {     // File:のみ対応
                let id = tags.id;
                wikimq.push([wikim, id]);
                html += `<div class="col-12 mt-3 mb-3 text-center"><img class="thumbnail" onclick="modalActs.viewImage(this)" id="${id}"><span id="${id}-copyright"></span></div>`;
                wikimq.forEach((q) => wikimedia.getWikiMediaImage(q[0], Conf.thumbnail.modalThumbWidth, q[1])); // WikiMedia Image 遅延読み込み
                elements++;
            }
        }
        return elements > 0 ? html + "</div>" : "";
    }

    // instagramのURLとユーザーネームを取得
    getInstagramProfileUrl(input) {
        const urlPattern = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9._]+)/;
        const usernamePattern = /^[a-zA-Z0-9._]+$/;
        const match = input.match(urlPattern);

        if (match && match[1]) {
            // 入力がURLの場合、ユーザー名を抽出し、配列にして返す
            return [input, match[1]];
        } else if (input.match(usernamePattern)) {
            // 入力がユーザー名の場合、URLを生成して配列にして返す
            return [`https://www.instagram.com/${input}/`, input];
        } else {
            // 入力がどちらでもない場合、nullを返す
            return null;
        }
    }

    // twitterのURLとユーザーネームを取得
    getTwitterProfileUrl(input) {
        const urlPattern = /(?:https?:\/\/)?(?:www\.)?x\.com\/([a-zA-Z0-9_]+)/;
        const usernamePattern = /^[a-zA-Z0-9_]+$/;
        const match = input.match(urlPattern);

        if (match && match[1]) {
            // 入力がURLの場合、ユーザー名を抽出し、配列にして返す
            return [input, match[1]];
        } else if (input.match(usernamePattern)) {
            // 入力がユーザー名の場合、URLを生成して配列にして返す
            return [`https://x.com/${input}/`, input];
        } else {
            // 入力がどちらでもない場合、nullを返す
            return null;
        }
    }

    // X/TwitterのURLとユーザーネームを取得
    getTwitterProfileUrl(input) {
        if (!input || typeof input !== 'string') return null;

        const value = input.trim();
        const usernamePattern = /^@?([a-zA-Z0-9_]{1,15})$/;         // @username に対応
        const urlPattern = /^(?:https?:\/\/)?(?:www\.)?(?:x\.com|twitter\.com)\/([a-zA-Z0-9_]{1,15})(?:\/)?(?:\?.*)?$/;        // x.com / twitter.com のプロフィールURLに対応
        const urlMatch = value.match(urlPattern);

        if (urlMatch && urlMatch[1]) {
            const username = urlMatch[1];
            const reservedNames = ['home', 'explore', 'notifications', 'messages', 'i', 'settings', 'login'];            // 予約っぽいパスは除外
            if (reservedNames.includes(username.toLowerCase())) return null;
            return [`https://x.com/${username}/`, username];
        }

        const usernameMatch = value.match(usernamePattern);
        if (usernameMatch && usernameMatch[1]) {
            const username = usernameMatch[1];
            return [`https://x.com/${username}/`, username];
        }
        return null;
    }

}
