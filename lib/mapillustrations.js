"use strict";

// Images are fixed to geographic rectangles and rendered on the map plane.
class MapIllustrations {
    constructor({ isMobile = () => window.matchMedia("(max-width: 640px)").matches } = {}) {
        this.isMobile = isMobile;
        this.items = [];
        this.frame = null;
        this.schedule = () => {
            if (this.frame !== null) return;
            this.frame = requestAnimationFrame(() => {
                this.frame = null;
                this.render();
            });
        };
    }

    init(map, config = {}) {
        this.destroy();
        this.map = map;
        this.config = config;
        if (config.use !== true) return;
        this.container = map.getContainer();
        for (const item of config.items ?? []) {
            const hasCenter = Array.isArray(item.coordinates) && item.coordinates.length === 2
                && item.coordinates.every(Number.isFinite)
                && Math.abs(item.coordinates[0]) <= 180 && Math.abs(item.coordinates[1]) <= 85;
            if (item.use === false || !item.image || (!hasCenter && !this.getFixedCoordinates(item))) continue;
            const image = document.createElement("img");
            image.decoding = "async";
            image.crossOrigin = "anonymous";
            image.onload = this.schedule;
            image.onerror = this.schedule;
            image.src = window.withAppAssetVersion?.(item.image) ?? item.image;
            this.items.push({ config: item, image, layerId: `map-illustration-${this.items.length}` });
        }
        // Stable order avoids changing the chosen images as the map renders.
        this.items.sort((a, b) => (a.config.priority ?? 0) - (b.config.priority ?? 0));
        map.on("render", this.schedule);
        map.on("style.load", this.schedule);
        map.on("remove", this.destroyBound = () => this.destroy());
        const controls = this.getControls();
        if (typeof ResizeObserver !== "undefined") {
            this.resizeObserver = new ResizeObserver(this.schedule);
            [this.container, ...controls].forEach(element => this.resizeObserver.observe(element));
        }
        if (typeof MutationObserver !== "undefined") {
            this.controlObserver = new MutationObserver(this.schedule);
            controls.forEach(element => this.controlObserver.observe(element, {
                subtree: true, childList: true, attributes: true,
                attributeFilter: ["class", "style", "hidden"]
            }));
        }
        this.schedule();
    }

    getControls() {
        return [...document.querySelectorAll(
            ".maplibregl-ctrl, #bottom-pane, #cMapIntro, .dropdown-menu.show, .modal.show"
        )];
    }

    intersects(a, b, padding = 0) {
        return a.left < b.right + padding && a.right > b.left - padding
            && a.top < b.bottom + padding && a.bottom > b.top - padding;
    }

    getCoordinates(entry, mobile) {
        const item = entry.config;
        const boundsCoordinates = this.getFixedCoordinates(item);
        if (boundsCoordinates) return boundsCoordinates;
        const width = mobile ? (item.mobileWidthPx ?? this.config.mobileWidthPx ?? 80)
            : (item.widthPx ?? this.config.widthPx ?? 120);
        const referenceZoom = item.referenceZoom ?? this.config.referenceZoom ?? 15;
        if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(referenceZoom)) return null;
        // A MapLibre world is 512 * 2^zoom pixels wide. Define this footprint
        // once at a reference zoom; camera changes must never change its corners.
        const [lng, lat] = item.coordinates;
        const x = (lng + 180) / 360;
        const y = (1 - Math.asinh(Math.tan(lat * Math.PI / 180)) / Math.PI) / 2;
        this.getTextureUrl(entry);
        const worldWidth = width / (512 * 2 ** referenceZoom);
        const padding = worldWidth * (entry.texturePadding ?? 0);
        // Extend the footprint for the shadow margin, keeping the original
        // image's center and geographic size unchanged.
        const halfWidth = worldWidth / 2 + padding;
        const halfHeight = worldWidth / 2 * entry.image.naturalHeight / entry.image.naturalWidth + padding;
        return [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([dx, dy]) => [
            (x + dx * halfWidth) * 360 - 180,
            Math.atan(Math.sinh(Math.PI * (1 - 2 * (y + dy * halfHeight)))) * 180 / Math.PI
        ]);
    }

    getFixedCoordinates(item) {
        if (item.corners !== undefined) {
            const points = item.corners;
            if (!Array.isArray(points) || points.length !== 4 || !points.every(point =>
                Array.isArray(point) && point.length === 2 && point.every(Number.isFinite)
                && Math.abs(point[0]) <= 180 && Math.abs(point[1]) <= 85)) return null;
            const turns = points.map((a, i) => {
                const b = points[(i + 1) % 4], c = points[(i + 2) % 4];
                return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
            });
            if (!turns.every(turn => turn > 0) && !turns.every(turn => turn < 0)) return null;
            return points.map(point => [...point]);
        }
        const bounds = item.bounds;
        if (!Array.isArray(bounds) || bounds.length !== 4 || !bounds.every(Number.isFinite)) return null;
        const [west, south, east, north] = bounds;
        if (west >= east || south >= north || west < -180 || east > 180 || south < -85 || north > 85) return null;
        return [[west, north], [east, north], [east, south], [west, south]];
    }

    syncLayer(entry, coordinates, beforeId) {
        const id = entry.layerId;
        const source = this.map.getSource(id);
        const key = JSON.stringify(coordinates);
        if (!source) {
            this.map.addSource(id, { type: "image", url: this.getTextureUrl(entry), coordinates });
            entry.coordinatesKey = key;
        } else if (entry.coordinatesKey !== key) {
            source.setCoordinates(coordinates);
            entry.coordinatesKey = key;
        }
        if (!this.map.getLayer(id)) {
            this.map.addLayer({
                id, type: "raster", source: id,
                minzoom: entry.config.minZoom ?? this.config.minZoom ?? 0,
                maxzoom: entry.config.maxZoom ?? this.config.maxZoom ?? 24,
                layout: { visibility: "none" },
                paint: { "raster-fade-duration": 0 }
            }, beforeId);
        }
    }

    getTextureUrl(entry) {
        if (entry.textureUrl) return entry.textureUrl;
        const item = entry.config;
        const baseWidth = Math.max(item.widthPx ?? this.config.widthPx ?? 120,
            item.mobileWidthPx ?? this.config.mobileWidthPx ?? 80);
        const width = Math.min(entry.image.naturalWidth,
            Math.ceil(baseWidth * 2 * (window.devicePixelRatio || 1)));
        const shadow = { ...this.config.shadow, ...item.shadow };
        const useShadow = shadow.use === true && !this.getFixedCoordinates(item);
        entry.texturePadding = 0;
        // Prefilter large PNGs for the map's texture sampler. This affects only
        // the in-memory rendering texture; the original file remains untouched.
        if (!Number.isFinite(width) || width <= 0 || (!useShadow && width >= entry.image.naturalWidth)) {
            return entry.textureUrl = entry.image.src;
        }
        const scale = width / baseWidth;
        const blur = Number.isFinite(shadow.blurPx) ? Math.max(0, shadow.blurPx) : 4;
        const offsetX = Number.isFinite(shadow.offsetXPx) ? shadow.offsetXPx : 2;
        const offsetY = Number.isFinite(shadow.offsetYPx) ? shadow.offsetYPx : 4;
        const padding = useShadow ? Math.ceil((blur * 2 + Math.max(Math.abs(offsetX), Math.abs(offsetY))) * scale) : 0;
        const height = Math.max(1, Math.round(width * entry.image.naturalHeight / entry.image.naturalWidth));
        const canvas = document.createElement("canvas");
        canvas.width = width + padding * 2;
        canvas.height = height + padding * 2;
        const context = canvas.getContext?.("2d");
        if (!context) return entry.textureUrl = entry.image.src;
        context.imageSmoothingEnabled = true;
        context.imageSmoothingQuality = "high";
        if (useShadow) {
            context.shadowColor = shadow.color ?? "rgba(0, 0, 0, 0.25)";
            context.shadowBlur = blur * scale;
            context.shadowOffsetX = offsetX * scale;
            context.shadowOffsetY = offsetY * scale;
        }
        context.drawImage(entry.image, padding, padding, width, height);
        entry.texturePadding = padding / width;
        entry.textureUrl = canvas.toDataURL("image/png");
        return entry.textureUrl;
    }

    setVisible(entry, visible) {
        const visibility = visible ? "visible" : "none";
        if (this.map.getLayer(entry.layerId)
            && this.map.getLayoutProperty(entry.layerId, "visibility") !== visibility) {
            this.map.setLayoutProperty(entry.layerId, "visibility", visibility);
        }
    }

    render() {
        if (this.config?.use !== true) return;
        // Once our layers exist the style is parsed. Pending map tiles must not
        // delay collision updates while the user moves or resizes the map.
        if (!this.map.isStyleLoaded()
            && !this.items.some(entry => this.map.getLayer(entry.layerId))) return;
        const config = this.config;
        const mobile = this.isMobile();
        // Fixed artwork should behave like any other geographic map feature:
        // the map clips offscreen portions without toggling the whole image.
        // Screen-space selection is an explicit opt-in, not the default.
        if (config.autoHide !== true) {
            for (const entry of this.items) {
                const image = entry.image;
                if (!image.complete || !image.naturalWidth || !image.naturalHeight) {
                    this.setVisible(entry, false);
                    continue;
                }
                const coordinates = this.getCoordinates(entry, mobile);
                if (!coordinates) { this.setVisible(entry, false); continue; }
                const beforeId = (this.map.getStyle()?.layers ?? []).find(layer => layer.id.startsWith("marker-"))?.id;
                this.syncLayer(entry, coordinates, beforeId);
                this.setVisible(entry, true);
            }
            return;
        }
        const zoom = this.map.getZoom();
        const limit = Math.max(0, Math.floor(config.maxVisible?.[mobile ? "mobile" : "desktop"] ?? (mobile ? 2 : 4)));
        const padding = Math.max(0, config.avoidPaddingPx ?? 24);
        const gap = Math.max(0, config.illustrationGapPx ?? 40);
        const viewport = this.container.getBoundingClientRect();
        const controls = this.getControls().filter(element => {
            const style = getComputedStyle(element);
            return style.display !== "none" && style.visibility !== "hidden";
        }).map(element => element.getBoundingClientRect()).filter(rect => rect.width && rect.height);
        // MapLibre's hit test includes both the icon and the drawn label, even when
        // a variable text anchor places the label away from the point coordinate.
        const layers = (this.map.getStyle()?.layers ?? []).filter(layer =>
            layer.id.startsWith("marker-") && layer.id !== "marker-shadow"
            && (layer.type === "symbol" || layer.type === "circle")
        ).map(layer => layer.id);
        const placed = [];
        for (const entry of this.items) {
            const { config: item, image } = entry;
            if (!image.complete || !image.naturalWidth || !image.naturalHeight) {
                this.setVisible(entry, false);
                continue;
            }
            const coordinates = this.getCoordinates(entry, mobile);
            if (!coordinates) { this.setVisible(entry, false); continue; }
            this.syncLayer(entry, coordinates, layers[0]);
            // Project all four fixed corners, so collision tests follow rotation,
            // pitch and zoom just like the raster image rendered by MapLibre.
            const points = coordinates.map(coordinate => this.map.project(coordinate));
            const rect = {
                left: Math.min(...points.map(point => point.x)),
                right: Math.max(...points.map(point => point.x)),
                top: Math.min(...points.map(point => point.y)),
                bottom: Math.max(...points.map(point => point.y))
            };
            const hide = () => this.setVisible(entry, false);
            if (placed.length >= limit || !viewport.width || !viewport.height
                || zoom < (item.minZoom ?? config.minZoom ?? 0)
                || zoom >= (item.maxZoom ?? config.maxZoom ?? 24)
                || !Object.values(rect).every(Number.isFinite)) { hide(); continue; }
            if (rect.left < padding || rect.top < padding
                || rect.right > viewport.width - padding || rect.bottom > viewport.height - padding) { hide(); continue; }
            const screenRect = {
                left: rect.left + viewport.left, right: rect.right + viewport.left,
                top: rect.top + viewport.top, bottom: rect.bottom + viewport.top
            };
            if (controls.some(control => this.intersects(screenRect, control, padding))
                || placed.some(other => this.intersects(rect, other, gap))) { hide(); continue; }
            if (layers.length && this.map.queryRenderedFeatures([
                [Math.max(0, rect.left - padding), Math.max(0, rect.top - padding)],
                [Math.min(viewport.width, rect.right + padding), Math.min(viewport.height, rect.bottom + padding)]
            ], { layers }).length) { hide(); continue; }
            this.setVisible(entry, true);
            placed.push(rect);
        }
    }

    destroy() {
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null;
        this.map?.off("render", this.schedule);
        this.map?.off("style.load", this.schedule);
        if (this.destroyBound) this.map?.off("remove", this.destroyBound);
        this.resizeObserver?.disconnect();
        this.controlObserver?.disconnect();
        for (const { image, layerId } of this.items) {
            image.onload = image.onerror = null;
            if (this.map?.getLayer(layerId)) this.map.removeLayer(layerId);
            if (this.map?.getSource(layerId)) this.map.removeSource(layerId);
        }
        this.items = [];
    }
}
