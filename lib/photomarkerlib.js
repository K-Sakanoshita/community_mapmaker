"use strict";

// DOM images also work with public image servers that do not allow canvas/CORS.
class PhotoMarkerController {
    constructor(map, { onSelect, resolveCommons } = {}) {
        this.map = map;
        this.onSelect = onSelect;
        this.resolveCommons = resolveCommons;
        this.entries = new Map();
        this.failed = new Set();
        this.queue = [];
        this.loading = 0;
        this.destroyed = false;
        map.on("remove", () => this.destroy());
    }

    static firstImage(activities, tags, forms = {}, settings = {}) {
        for (const activity of activities ?? []) {
            const form = forms[String(activity.id ?? "").split("/")[0]]?.form;
            const fields = Array.isArray(settings.imageFields) && settings.imageFields.length ? settings.imageFields
                : form ? Object.values(form).filter(field => field.type === "image_url")
                    .map(field => field.gsheet).filter(Boolean)
                    : Object.keys(activity).filter(key => /^picture_url\d+$/.test(key))
                        .sort((a, b) => Number(a.slice(11)) - Number(b.slice(11)));
            for (const field of fields) {
                const value = this.imageReference(activity[field]);
                if (value) return value;
            }
        }
        return this.imageReference(tags?.image) || this.imageReference(tags?.wikimedia_commons);
    }

    static imageReference(value) {
        const raw = String(value ?? "").trim();
        if (/^File:\s*\S/i.test(raw)) return `File:${raw.slice(5).trim()}`;
        if (!raw) return "";
        try {
            const url = new URL(raw, location.href);
            return ["http:", "https:"].includes(url.protocol) ? url.href : "";
        } catch { return ""; }
    }

    sync(candidates, settings = {}) {
        if (this.destroyed) return;
        const limit = Math.max(1, Math.min(500, Number(settings.maxMarkers) || 100));
        const desired = new Map();
        if (settings.use === true) for (const item of candidates) {
            if (!item.image || this.failed.has(item.image) || desired.has(item.id)) continue;
            desired.set(item.id, item);
            if (desired.size >= limit) break;
        }
        for (const [id, entry] of this.entries) {
            if (desired.get(id)?.image === entry.item.image) continue;
            entry.active = false;
            entry.marker?.remove();
            this.entries.delete(id);
        }
        for (const [id, item] of desired) {
            let entry = this.entries.get(id);
            if (!entry) {
                entry = { item, active: true };
                this.entries.set(id, entry);
                this.queue.push(entry);
            } else entry.item = item;
            if (entry.marker) this.update(entry);
        }
        this.pump();
    }

    update(entry) {
        const item = entry.item;
        const size = Math.max(16, Math.min(96, item.size || 40));
        entry.button.style.width = `${size}px`;
        entry.button.style.height = `${size}px`;
        entry.button.style.borderColor = item.color || "#888888";
        entry.button.setAttribute("aria-label", (item.name || item.id)
            + (item.stamp ? `（${item.stampLabel || "スタンプ設置場所"}）` : ""));
        entry.button.setAttribute("data-upper-floor", String(Boolean(item.upperFloor)));
        entry.button.title = item.name || item.id;
        entry.heart.hidden = !item.favorite;
        entry.button.setAttribute("data-stamp", String(Boolean(item.stamp)));
        if (item.stamp) {
            if (!entry.stamp) {
                entry.stamp = document.createElement("span");
                entry.stamp.className = "poi-photo-marker-stamp";
                entry.stamp.setAttribute("aria-hidden", "true");
                entry.button.append(entry.stamp);
            }
            entry.stamp.title = item.stampLabel || "スタンプ設置場所";
            entry.stamp.style.color = item.stampColor || "#D65C8C";
            entry.button.style.setProperty("--poi-stamp-color", item.stampColor || "#D65C8C");
        } else if (entry.stamp) {
            entry.button.removeChild(entry.stamp);
            delete entry.stamp;
        }
        entry.marker.setLngLat(item.lnglat);
    }

    getIdsAtPoint(point) {
        const canvas = this.map.getCanvas().getBoundingClientRect();
        const x = canvas.left + point.x, y = canvas.top + point.y;
        const ids = [];
        for (const entry of this.entries.values()) {
            if (!entry.active || !entry.marker) continue;
            const bounds = entry.button.getBoundingClientRect();
            const radius = Math.min(bounds.width, bounds.height) / 2;
            if (radius > 0 && Math.hypot(x - (bounds.left + bounds.width / 2),
                y - (bounds.top + bounds.height / 2)) <= radius) ids.push(entry.item.id);
        }
        return ids;
    }

    clickEvent(entry, event) {
        const canvas = this.map.getCanvas?.().getBoundingClientRect();
        const bounds = entry.button.getBoundingClientRect?.();
        const point = canvas && bounds ? {
            x: (event.detail && Number.isFinite(event.clientX) ? event.clientX : bounds.left + bounds.width / 2) - canvas.left,
            y: (event.detail && Number.isFinite(event.clientY) ? event.clientY : bounds.top + bounds.height / 2) - canvas.top
        } : this.map.project?.(entry.item.lnglat);
        return { point, lngLat: point ? this.map.unproject(point) : entry.item.lnglat, originalEvent: event };
    }

    pump() {
        while (!this.destroyed && this.loading < 4 && this.queue.length) {
            const entry = this.queue.shift();
            if (!entry.active) continue;
            this.loading++;
            this.load(entry).finally(() => { this.loading--; this.pump(); });
        }
    }

    async load(entry) {
        try {
            let src = entry.item.image.startsWith("File:")
                ? await this.resolveCommons?.(entry.item.image) : entry.item.image;
            if (!src || !entry.active || this.destroyed) return;
            if (typeof ActivityThumbnails !== "undefined") src = await ActivityThumbnails.resolve(entry.item.thumbnail || src, src);
            if (!entry.active || this.destroyed) return;
            const button = document.createElement("button");
            button.type = "button";
            button.className = "poi-photo-marker";
            const image = document.createElement("img");
            image.alt = "";
            image.draggable = false;
            image.width = image.height = 80;
            image.decoding = "async";
            const heart = document.createElement("span");
            heart.className = "poi-photo-marker-heart";
            heart.textContent = "♥";
            heart.setAttribute("aria-hidden", "true");
            button.append(image, heart);
            button.addEventListener("click", event => {
                event.stopPropagation();
                if (entry.active) this.onSelect?.(entry.item.id, this.clickEvent(entry, event));
            });
            await new Promise((resolve, reject) => {
                const timer = setTimeout(() => finish(new Error("Image timeout")), 15000);
                const finish = error => {
                    clearTimeout(timer);
                    image.onload = image.onerror = null;
                    error ? reject(error) : resolve();
                };
                image.onload = () => finish();
                image.onerror = () => finish(new Error("Image unavailable"));
                image.src = src;
            });
            if (!entry.active || this.destroyed) return;
            entry.button = button;
            entry.heart = heart;
            entry.marker = new maplibregl.Marker({ element: button, anchor: "center" });
            this.update(entry);
            entry.marker.addTo(this.map);
        } catch {
            // Keep the ordinary map icon; a failed photo never blocks startup.
            if (this.failed.size >= 256) this.failed.delete(this.failed.values().next().value);
            this.failed.add(entry.item.image);
        }
    }

    destroy() {
        this.destroyed = true;
        for (const entry of this.entries.values()) {
            entry.active = false;
            entry.marker?.remove();
        }
        this.entries.clear();
        this.queue.length = 0;
        this.failed.clear();
    }
}
