"use strict";

// Keep parsing and conversion off the UI thread for large responses.
self.onmessage = ({ data: { task, value } }) => {
    try {
        let result;
        if (task === "parse") {
            result = JSON.parse(value);
        } else if (task === "geojson") {
            const converterUrl = new URL("./osmtogeojson.js", self.location.href);
            converterUrl.search = self.location.search;
            importScripts(converterUrl.href);
            result = self.osmtogeojson(value, { flatProperties: true });
        } else {
            throw new Error(`Unknown OSM data task: ${task}`);
        }
        self.postMessage({ result });
    } catch (error) {
        self.postMessage({ error: error.message });
    }
};
