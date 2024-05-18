class modal_OSMbasic {
    // make modal html for OSM basic tags

    make(tags) {
        let catname = poiCont.getCatnames(tags);
        let elements = 0;
        let html = `<div class="d-flex justify-content-between flex-wrap mb-3">`;

        // write type
        if (catname[0] !== undefined) {
            html += `<div class="flex-row"> <i class="fas fa-square"></i> ${catname[0]}${catname[1] !== "" ? "(" + catname[1] + ")" : ""}</div>`;
            elements++;
        };

        // write changing_table
        if (tags.changing_table !== undefined) {
            let available = tags.changing_table == "yes" ? glot.get("available") : glot.get("unavailable");
            html += `<div class="flex-row"> <i class="fas fa-baby"></i> ${glot.get("changing_table")}:${available}</div>`;
            elements++;
        };

        // write wheelchair
        if (tags.wheelchair !== undefined) {
            let test = { "yes": "available", "no": "unavailable", "limited": "limited" };
            if (test[tags.wheelchair] !== undefined) {
                let available = glot.get(test[tags.wheelchair]);
                html += `<div class="flex-row"> <i class="fas fa-wheelchair"></i> ${available}</div>`;
                elements++;
            }
        };

        // write bottle
        if (tags.bottle !== undefined) {
            let test = { "yes": "available", "no": "unavailable", "limited": "limited" };
            if (test[tags.bottle] !== undefined) {
                let available = glot.get(test[tags.bottle]);
                html += `<div class="flex-row"> <i class="fas fa-wine-bottle"></i> ${available}</div>`;
                elements++;
            }
        };

        // write website
        let website = [tags.website, tags["contact:website"]].filter(a => a !== undefined)[0];
        if (website !== undefined) {
            html += `<div class="flex-row"> <i class="fas fa-globe"></i> <a href="${website}" target="_blank">${website}</a></div>`;
            elements++;
        };

        // write tel
        if (tags.phone !== undefined) {
            html += `<div class="flex-row"> <i class="fas fa-phone-alt"></i> ${tags.phone}</div>`;
            elements++;
        };

        // write artist_name
        if (tags.artist_name !== undefined) {
            html += `<div class="flex-row"> <i class="fas fa-file-signature"></i> ${tags.artist_name}</div>`;
            elements++;
        };

        // write note
        if (tags.note !== undefined) {
            html += `<div class="flex-row"> <i class="fas fa-sticky-note"></i> ${tags.note}</div>`;
            elements++;
        };

        // write description
        if (tags.description !== undefined) {
            html += `<div class="flex-row"> <i class="fas fa-sticky-note"></i> ${tags.description}</div>`;
            elements++;
        };

        return elements > 0 ? html + "</div>" : "";

    };


}
var modal_osmbasic = new modal_OSMbasic();
