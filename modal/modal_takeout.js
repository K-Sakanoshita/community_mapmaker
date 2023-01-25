class modal_Takeout {
    // modal view for Takeout

    constructor() {
        this.html = ""
        var xhr = new XMLHttpRequest();
        xhr.open('GET', "./modal/modal_takeout.html", true);
        xhr.onerror = function () {
            console.log("[error]modal_Takeout:");
            console.log(xhr);
        };
        xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 400) {
                console.log("[success]modal_Takeout:");
                this.html = xhr.response;
            } else {
                console.log("[error]modal_Takeout:");
                console.log(xhr);
            };
        }.bind(this);
        xhr.send();
    };

    make(marker) {
        $("#modals").html(this.html);

        let osmid = marker.target.mapmaker_id
        let poi = poiCont.get_osmid(osmid);
        let tags = poi.geojson.properties;
        let date = moment(tags.timestamp);
        const osmidOrig = osmid;
        osmid = osmid.replace('/', "=");
        history.replaceState('', '', location.pathname + "?" + osmid + location.hash);

        $("#osmid").html(tags.id);
        $("#timestamp").html(date.format("YYYY/MM/DD hh:mm"));
        let name = tags.name == null ? "" : tags.name;
        if (tags.branch) {
            name += " " + tags.branch;
        }
        $("#name").html(name == null ? "-" : name);
        $("#category-icon").attr("src", tags.takeaway_icon);
        $("#category").html(poiCont.get_catname(tags));

        // opening_hours
        let openhour;
        if (tags["opening_hours:covid19"] != null) {
            openhour = tags["opening_hours:covid19"];
        } else {
            openhour = tags.opening_hours == null ? "-" : tags.opening_hours;
        };
        let RegexPTN = [[/\|\|/g, "<br>"], [/;/g, "<br>"]];
        Object.keys(Conf.opening_hours).forEach(key => {
            RegexPTN.push([new RegExp(key, "g"), Conf.opening_hours[key]]);
        });
        RegexPTN.forEach(val => { openhour = openhour.replace(val[0], val[1]) });
        if (tags["opening_hours:covid19"] != null) { openhour += Conf.category.suffix_covid19 }
        $("#opening_hours").html(openhour);

        // cuisine
        let cuisine = [];
        if (tags.cuisine != null) {
            cuisine = tags.cuisine.split(";").map(key => {
                return Conf.category.cuisine[key] || key;
            });
        };

        // cuisine(diet)
        let diet = Object.keys(Conf.category.diet).map(key => {
            if (tags[key] != null) {
                if (tags[key] !== "no") return Conf.category.diet[key] || key;
            }
        });
        cuisine = cuisine.concat(diet);
        cuisine = cuisine.filter(Boolean);
        cuisine = cuisine.join(', ');
        $("#cuisine").html(cuisine == "" ? "-" : cuisine);

        if (Conf.default.bookmark == true) {
            /*
            let bookmarked = bookmark.isBookmarked(osmidOrig);
            const CLASS_BOOKMARK_TRUE = "btn-bookmark-true";
            const CLASS_BOOKMARK_FALSE = "btn-bookmark-false";
            $("#modal_bookmark").show();
            $("#modal_bookmark").removeClass((bookmarked) ? CLASS_BOOKMARK_FALSE : CLASS_BOOKMARK_TRUE);
            $("#modal_bookmark").addClass((!bookmarked) ? CLASS_BOOKMARK_FALSE : CLASS_BOOKMARK_TRUE);
            $('#modal_bookmark').unbind('click');
            $('#modal_bookmark').click(() => {
                console.log(name);
                bookmarked = !bookmarked;
                bookmark.setBookmarkByModal(osmidOrig, bookmarked);
                $("#modal_bookmark").removeClass((bookmarked) ? CLASS_BOOKMARK_FALSE : CLASS_BOOKMARK_TRUE);
                $("#modal_bookmark").addClass((!bookmarked) ? CLASS_BOOKMARK_FALSE : CLASS_BOOKMARK_TRUE);
            });
            */
        }

        /*
        let outseet = YESNO.indexOf(tags.outdoor_seating) < 0 ? "" : tags.outdoor_seating;
        if (outseet !== "") {
            $("#outdoor_seating").attr("glot-model", "outdoor_seating_" + outseet);
        } else {
            $("#outdoor_seating").removeAttr("glot-model");
        };
        */

        // takeout
        /*
        let takeaway;
        if (tags["takeaway:covid19"] != null) {
            takeaway = Conf.category.takeaway[tags["takeaway:covid19"]];
            takeaway = takeaway == undefined ? "?" : takeaway + Conf.category.suffix_covid19;
        } else {
            takeaway = tags.takeaway == null ? "-" : Conf.category.takeaway[tags.takeaway];
            takeaway = takeaway == undefined ? "?" : takeaway;
        }
        $("#takeaway").html(takeaway);
        */

        // delivery
        /*
        let delname;
        if (tags["delivery:covid19"] != null) {
            delname = Conf.category.delivery[tags["delivery:covid19"]];
            delname = delname == undefined ? "?" : delname + Conf.category.suffix_covid19;
        } else {
            delname = tags.delivery == null ? "-" : Conf.category.delivery[tags.delivery];
            delname = delname == undefined ? "?" : delname;
        }
        $("#delivery").html(delname);
        
        if (tags.phone != null) {
            $("#phone").html("<a href=\"" + ("tel:" + tags.phone) + "\">" + tags.phone + "</a>");
        } else {
            $("#phone").html("-");
        }
        */

        let fld = {};
        fld.website = tags["contact:website"] == null ? tags["website"] : tags["contact:website"];
        fld.sns_instagram = tags["contact:instagram"] == null ? tags["instagram"] : tags["contact:instagram"];
        fld.sns_twitter = tags["contact:twitter"] == null ? tags["twitter"] : tags["contact:twitter"];
        fld.sns_facebook = tags["contact:facebook"] == null ? tags["facebook"] : tags["contact:facebook"];
        Object.keys(fld).forEach(key => {
            if (fld[key] == null) {
                $("#" + key).hide();
            } else {
                $("#" + key).show();
            };
        });

        $("#description").html(tags.description == null ? "-" : tags.description.trim());

        glot.render();
        $('#modal_poiview').modal({ backdrop: 'static', keyboard: true });

        let hidden = e => {
            //_status = "";
            history.replaceState('', '', location.pathname + location.hash);
            $('#modal_poiview').modal('hide');
        };
        $('#modal_poiview').one('hidePrevented.bs.modal', hidden);
        $('#modal_poiview').one('hidden.bs.modal', hidden);
    }
}
