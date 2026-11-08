// One image viewer shared by ordinary photos and related document previews.
class ImageViewer {
    static text(key) { return glot.get(`image_viewer_${key}`); }
    static normalize(value) {
        try {
            if (!value || typeof value.image !== 'string' || !value.image.trim()) return null;
            const url = new URL(value.image, document.baseURI);
            if (!['http:', 'https:', 'blob:'].includes(url.protocol) || url.username || url.password) return null;
            const region = value.region;
            if (region !== undefined) {
                if (!Array.isArray(region) || region.length !== 4 || !region.every(Number.isFinite)) return null;
                const [x, y, width, height] = region;
                if (x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1.000001 || y + height > 1.000001) return null;
            }
            return { image: url.href, ...(region ? { region: [...region] } : {}), title: String(value.title || '') };
        } catch { return null; }
    }
    static createViewer() {
        const dialog = document.createElement('dialog');
        dialog.className = 'image-viewer';
        dialog.setAttribute('aria-label', this.text('title'));
        const toolbar = document.createElement('div');
        toolbar.className = 'image-viewer-toolbar';
        const stage = document.createElement('div');
        stage.className = 'image-viewer-stage';
        stage.tabIndex = 0;
        stage.setAttribute('aria-label', this.text('help'));
        const image = document.createElement('img');
        image.alt = this.text('title');
        image.draggable = false;
        const status = document.createElement('p');
        status.className = 'image-viewer-status';
        status.setAttribute('role', 'status');
        stage.append(image, status);
        dialog.append(toolbar, stage);
        document.body.append(dialog);
        this.viewer = { dialog, stage, image, status, points: new Map(), ready: false };
        const actions = {
            region: () => this.fit('region'),
            size: () => this.fit(this.viewer.mode === 'whole' ? 'actual' : 'whole'),
            close: () => dialog.close()
        };
        for (const [key, action] of Object.entries(actions)) {
            const button = document.createElement('button');
            button.type = 'button';
            button.textContent = key === 'close' ? '×' : this.text(key === 'size' ? 'whole' : key);
            if (key === 'close') button.setAttribute('aria-label', this.text('close'));
            button.addEventListener('click', action);
            button.dataset.imageAction = key;
            toolbar.append(button);
        }
        dialog.addEventListener('close', () => {
            if (dialog.open) return; // A previous close event can arrive after reopening.
            this.viewer.ready = false;
            this.viewer.points.clear();
            this.viewer.generation++;
            image.removeAttribute('src');
        });
        stage.addEventListener('wheel', event => {
            event.preventDefault();
            const rect = stage.getBoundingClientRect();
            this.zoom(Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * 0.003), event.clientX - rect.left, event.clientY - rect.top);
        }, { passive: false });
        const gesture = () => {
            const points = [...this.viewer.points.values()];
            if (!points.length) return null;
            const a = points[0], b = points[1] || a;
            return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) };
        };
        stage.addEventListener('pointerdown', event => {
            if (event.button !== 0 || !this.viewer.ready) return;
            stage.setPointerCapture(event.pointerId);
            this.viewer.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
            stage.focus();
        });
        stage.addEventListener('pointermove', event => {
            const view = this.viewer;
            if (!view.points.has(event.pointerId) || !view.ready) return;
            const before = gesture();
            view.points.set(event.pointerId, { x: event.clientX, y: event.clientY });
            const after = gesture(), rect = stage.getBoundingClientRect();
            if (before.distance > 0 && after.distance > 0) this.zoom(after.distance / before.distance, before.x - rect.left, before.y - rect.top);
            view.x += after.x - before.x;
            view.y += after.y - before.y;
            this.paint();
        });
        for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) {
            stage.addEventListener(type, event => this.viewer.points.delete(event.pointerId));
        }
        stage.addEventListener('keydown', event => {
            const view = this.viewer;
            if (!view.ready) return;
            if (['+', '=', '-'].includes(event.key)) this.zoom(event.key === '-' ? 1 / 1.4 : 1.4);
            else if (event.key === '0') this.fit('whole');
            else if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) {
                view.x += event.key === 'ArrowLeft' ? 40 : event.key === 'ArrowRight' ? -40 : 0;
                view.y += event.key === 'ArrowUp' ? 40 : event.key === 'ArrowDown' ? -40 : 0;
                this.paint();
            } else return;
            event.preventDefault();
        });
        window.addEventListener('resize', () => { if (dialog.open && this.viewer.ready) this.fit(this.viewer.mode); });
    }
    static close() {
        if (this.viewer?.dialog.open) this.viewer.dialog.close();
    }
    static async open(value) {
        value = this.normalize(value);
        if (!value) return;
        if (!this.viewer) this.createViewer();
        const view = this.viewer;
        const generation = view.generation = (view.generation || 0) + 1;
        view.points.clear();
        view.value = value;
        view.dialog.querySelector('[data-image-action="region"]').hidden = !value.region;
        const title = value.title || this.text('title');
        view.dialog.setAttribute('aria-label', title);
        view.image.alt = title;
        view.ready = false;
        view.image.hidden = true;
        view.status.hidden = false;
        view.status.textContent = this.text('loading');
        if (!view.dialog.open) view.dialog.showModal();
        view.image.src = value.image;
        try {
            await view.image.decode();
            if (view.generation !== generation || !view.dialog.open) return;
            view.ready = true;
            view.image.hidden = false;
            view.status.hidden = true;
            this.fit(value.region ? 'region' : 'whole');
            view.stage.focus();
        } catch {
            if (view.generation === generation) view.status.textContent = this.text('error');
        }
    }
    static fit(mode) {
        const view = this.viewer;
        if (!view?.ready) return;
        view.mode = mode;
        const sizeButton = view.dialog?.querySelector('[data-image-action="size"]');
        if (sizeButton) sizeButton.textContent = this.text(mode === 'whole' ? 'actual' : 'whole');
        const region = mode === 'region' && view.value.region ? view.value.region : [0, 0, 1, 1];
        const [x, y, width, height] = region;
        const iw = view.image.naturalWidth, ih = view.image.naturalHeight;
        view.scale = mode === 'actual' ? 1 : Math.min(view.stage.clientWidth / (iw * width), view.stage.clientHeight / (ih * height)) * 0.94;
        view.minScale = Math.min(view.stage.clientWidth / iw, view.stage.clientHeight / ih) * 0.5;
        view.maxScale = Math.max(4, view.scale * 4);
        view.x = view.stage.clientWidth / 2 - (x + width / 2) * iw * view.scale;
        view.y = view.stage.clientHeight / 2 - (y + height / 2) * ih * view.scale;
        this.paint();
    }
    static zoom(factor, x, y) {
        const view = this.viewer;
        if (!view?.ready) return;
        x ??= view.stage.clientWidth / 2;
        y ??= view.stage.clientHeight / 2;
        const scale = Math.min(view.maxScale, Math.max(view.minScale, view.scale * factor));
        view.x = x - (x - view.x) * scale / view.scale;
        view.y = y - (y - view.y) * scale / view.scale;
        view.scale = scale;
        view.mode = 'zoom';
        const sizeButton = view.dialog?.querySelector('[data-image-action="size"]');
        if (sizeButton) sizeButton.textContent = this.text('whole');
        this.paint();
    }
    static paint() {
        const view = this.viewer;
        view.image.style.transform = `translate(${view.x}px, ${view.y}px) scale(${view.scale})`;
    }
}
