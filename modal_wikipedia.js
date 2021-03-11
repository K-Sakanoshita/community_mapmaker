class modal_Wikipedia {
    // make modal html for Wikipedia

    // return elements
    element() {
        return `<h5>${glot.get("wikipedia")}</h5><div id="modal_wikipedia"></div>`;
    };

    // make html
    make(tags) {
        return new Promise((resolve, reject) => {
            let wiki = tags.wikipedia.split(':');
            let url = encodeURI(`https://${wiki[0]}.${Conf.osm.wikipedia.domain}/wiki/${wiki[1]}`);
            basic.getWikipedia(wiki[0], wiki[1]).then(text => {
                let html = `<span>${text}</span><a href="${url}" target="_blank">${glot.get("source_wikipedia")}</a>`;
                resolve(html);
            }).catch(e => reject(e));
        });
    };

    // set dom from html(make result)
    set_dom(html) {
        let wikidom = document.getElementById("modal_wikipedia");
        if (wikidom == undefined) {
            setTimeout(() => modal_wikipedia.set_dom(html), 500);
        } else {
            wikidom.innerHTML = html;
        };
    };
}
var modal_wikipedia = new modal_Wikipedia();
