// Geographic image-link boards; image display is handled by the shared viewer.
class MapImageLinks {
    constructor({ Marker = maplibregl.Marker, viewer = ImageViewer } = {}) {
        this.Marker = Marker;
        this.viewer = viewer;
        this.boards = [];
    }

    label(value, key) { return key ? glot.get(key) : String(value || ''); }

    init(map, config = {}) {
        this.destroy();
        if (config.use !== true) return;
        this.map = map;
        this.config = config;
        for (const item of config.items || []) {
            const coordinates = item.coordinates;
            if (item.use === false || !Array.isArray(coordinates) || coordinates.length !== 2
                || !coordinates.every(Number.isFinite) || Math.abs(coordinates[0]) > 180 || Math.abs(coordinates[1]) > 85) continue;
            const element = document.createElement('section');
            element.className = 'map-image-links';
            element.setAttribute('role', 'group');
            const title = this.label(item.title, item.titleKey);
            element.setAttribute('aria-label', title);
            const heading = document.createElement('span');
            heading.className = 'map-image-links-title';
            heading.textContent = title;
            const links = document.createElement('div');
            links.className = 'map-image-links-items';
            for (const link of item.links || []) {
                const label = this.label(link.title, link.titleKey);
                const value = this.viewer.normalize({ image: link.image, region: link.region, title: label });
                const thumbnail = this.viewer.normalize({ image: link.thumbnail || link.image });
                if (!value || !thumbnail || !['http:', 'https:'].includes(new URL(value.image).protocol)
                    || !['http:', 'https:'].includes(new URL(thumbnail.image).protocol)) continue;
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'map-image-link';
                button.setAttribute('aria-label', label);
                const image = document.createElement('img');
                image.src = window.withAppAssetVersion?.(thumbnail.image) || thumbnail.image;
                image.alt = '';
                image.decoding = 'async';
                image.draggable = false;
                const caption = document.createElement('span');
                caption.textContent = label;
                button.append(image, caption);
                button.addEventListener('click', () => this.viewer.open(value));
                links.append(button);
            }
            if (!links.children.length) continue;
            element.append(heading, links);
            // A board click must not also select a POI or zoom the underlying map.
            for (const event of ['click', 'dblclick', 'pointerdown', 'mousedown', 'touchstart', 'keydown']) {
                element.addEventListener(event, e => e.stopPropagation());
            }
            const marker = new this.Marker({ element, anchor: 'center' }).setLngLat(coordinates).addTo(map);
            this.boards.push({ marker, element, config: item });
        }
        this.updateBound = () => this.update();
        this.removeBound = () => this.destroy();
        map.on('zoom', this.updateBound);
        map.on('remove', this.removeBound);
        this.update();
    }

    update() {
        const zoom = this.map.getZoom();
        for (const board of this.boards) {
            board.element.hidden = zoom < (board.config.minZoom ?? this.config.minZoom ?? 0)
                || zoom >= (board.config.maxZoom ?? this.config.maxZoom ?? 24);
        }
    }

    destroy() {
        if (this.map) {
            this.map.off('zoom', this.updateBound);
            this.map.off('remove', this.removeBound);
        }
        for (const board of this.boards) board.marker.remove();
        this.boards = [];
        this.map = null;
    }
}
