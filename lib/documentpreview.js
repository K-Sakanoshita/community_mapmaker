// Related document images. Content and normalized viewing regions come from data.
class DocumentPreview {
    static settings() { return Conf.documentPreview || {}; }
    static text(key) { return glot.get(`document_preview_${key}`); }
    static escape(value) {
        return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
    }
    static parse(raw) {
        try {
            const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
            if (!value || typeof value.image !== 'string' || !value.image.trim()) return null;
            const url = new URL(value.image, document.baseURI);
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) return null;
            const region = value.region === undefined ? [0, 0, 1, 1] : value.region;
            if (!Array.isArray(region) || region.length !== 4 || !region.every(Number.isFinite)) return null;
            const [x, y, width, height] = region;
            if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1.000001 || y + height > 1.000001) return null;
            return { image: url.href, region: [...region] };
        } catch { return null; }
    }
    static collect(records) {
        const settings = this.settings();
        if (settings.use !== true || !settings.field) return [];
        const unique = new Map();
        for (const record of records) {
            const value = this.parse(record[settings.field]);
            if (value) unique.set(JSON.stringify(value), value);
        }
        return [...unique.values()];
    }
    static render(records) {
        const values = this.collect(records);
        if (!values.length) return '';
        this.init();
        return `<section class="document-previews" aria-label="${this.escape(this.text('title'))}">${values.map(value => {
            const [x, y, width, height] = value.region;
            return `<button type="button" class="document-preview" data-document-preview="${this.escape(JSON.stringify(value))}">
                <span class="document-preview-frame"><img loading="lazy" alt="${this.escape(this.text('title'))}"
                    src="${this.escape(value.image)}" style="width:${100 / width}%;height:${100 / height}%;left:${-100 * x / width}%;top:${-100 * y / height}%"></span>
                <span class="document-preview-caption">${this.escape(this.text('open'))}</span></button>`;
        }).join('')}</section>`;
    }
    static init() {
        if (this.initialized) return;
        this.initialized = true;
        document.addEventListener('click', event => {
            const button = event.target.closest?.('[data-document-preview]');
            if (button) this.open(this.parse(button.dataset.documentPreview));
        });
        document.addEventListener('load', event => {
            const image = event.target;
            const button = image.closest?.('[data-document-preview]');
            if (!button || image.tagName !== 'IMG') return;
            const value = this.parse(button.dataset.documentPreview);
            if (!value) return;
            const frame = button.querySelector('.document-preview-frame');
            const frameWidth = frame.clientWidth || 320, frameHeight = frame.clientHeight || 140;
            const [x, y, width, height] = value.region;
            // Fit the selected area without stretching it; the wider frame shows its surroundings.
            const scale = Math.min(frameWidth / (image.naturalWidth * width), frameHeight / (image.naturalHeight * height));
            const imageWidth = image.naturalWidth * scale / frameWidth * 100;
            const imageHeight = image.naturalHeight * scale / frameHeight * 100;
            Object.assign(image.style, {
                width: `${imageWidth}%`, height: `${imageHeight}%`,
                left: `${50 - (x + width / 2) * imageWidth}%`,
                top: `${50 - (y + height / 2) * imageHeight}%`
            });
        }, true);
        document.addEventListener('error', event => {
            const button = event.target.closest?.('[data-document-preview]');
            if (button && event.target.tagName === 'IMG') {
                button.querySelector('.document-preview-caption').textContent = this.text('error');
                button.disabled = true;
            }
        }, true);
    }
    static open(value) { return ImageViewer.open(value); }
}
