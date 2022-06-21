class modal_OSMbasic {
    // make modal html for OSM basic tags

    make(tags) {
        let catname = poiCont.get_catname(tags);
        let elements = 0;
        let html = `<div class="d-flex justify-content-between flex-wrap mb-3">`;

        // write type
        if (catname[0] !== undefined) {
            html += `<div class="flex-row"> <i class="fas fa-square"></i> ${catname[0]}${catname[1] !== "" ? "(" + catname[1] + ")" : ""}</div>`;
            elements++;
        };

        // write website
        if (tags.website !== undefined) {
            html += `<div class="flex-row"> <i class="fas fa-globe"></i> <a href="${tags.website}" target="_blank">${tags.website}</a></div>`;
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
