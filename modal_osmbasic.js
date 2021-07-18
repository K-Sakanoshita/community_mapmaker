class modal_OSMbasic {
    // make modal html for OSM basic tags

    make(tags) {
        let catname = poiCont.get_catname(tags);
        let elements = 0;
        let html = `<div class="d-flex justify-content-between mb-3">`;
        if (tags.website !== undefined) {
            html += `<div class="flex-row">
                <strong>${glot.get("tags_website")}:</strong> <a href="${tags.website}" target="_blank">${tags.website}</a>
            </div>`;
            elements++;
        };

        if (tags.phone !== undefined) {
            html += `<div class="flex-row"><strong>${glot.get("tags_phone")}:</strong> ${tags.phone}</div>`;
            elements++;
        };

        if (catname !== undefined) {
            html += `<div class="flex-row"><strong>${glot.get("tags_type")}:</strong> ${catname}</div>`;
            elements++;
        };

        return elements > 0 ? html + "</div>" : "";
    };
}
var modal_osmbasic = new modal_OSMbasic();
