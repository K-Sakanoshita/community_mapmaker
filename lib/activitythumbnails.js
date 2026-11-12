"use strict";

// Only display-sized images use this API. Original URLs stay on records/viewers.
class ActivityThumbnails {
    static cache = new Map();
    static queue = [];
    static active = 0;
    static pauseUntil = 0;

    static url(activity, field, original) {
        const settings = Conf.thumbnail?.backend;
        if (settings?.use !== true || !activity?.id || !field || !/^https?:\/\//i.test(String(original))) return original;
        try {
            const source = new URL(original);
            const api = new URL(settings.url, document.baseURI);
            if (!['http:', 'https:'].includes(api.protocol) || !api.searchParams.get('app')
                || source.username || source.password || source.hash) return original;
            api.searchParams.set('id', activity.id);
            api.searchParams.set('field', field);
            return api.href;
        } catch { return original; }
    }

    static forSource(records, original) {
        for (const activity of Array.isArray(records) ? records : [records]) {
            if (!activity) continue;
            const form = Conf.activities?.[String(activity.id ?? '').split('/')[0]]?.form;
            const fields = form ? Object.values(form).filter(f => f.type === 'image_url').map(f => f.gsheet).filter(Boolean)
                : Object.keys(activity).filter(key => /^picture_url\d+$/.test(key));
            for (const field of fields) {
                const value = String(activity[field] ?? '').trim();
                let matches = value === String(original).trim();
                if (!matches && value) {
                    try { matches = new URL(value, document.baseURI).href === new URL(original, document.baseURI).href; } catch {}
                }
                if (matches) {
                    const thumbnail = this.url(activity, field, value);
                    return thumbnail === value ? original : thumbnail;
                }
            }
        }
        return original;
    }

    static resolve(url, original) {
        if (!url || url === original) return Promise.resolve(original);
        const key = JSON.stringify([url, original]);
        if (this.cache.has(key)) return this.cache.get(key);
        if (this.cache.size >= 256) return Promise.resolve(original);
        // Share both pending and completed requests across map, strip and detail.
        const task = new Promise((resolve, reject) => {
            this.queue.push({ url, original, resolve, reject });
        });
        this.cache.set(key, task);
        this.pump();
        return task;
    }

    static pump() {
        // Older backends remain serial unless the site opts into two connections.
        const configured = Number(Conf.thumbnail?.backend?.concurrency ?? 1);
        const limit = Math.max(1, Math.min(2, Math.floor(configured) || 1));
        while (this.active < limit && this.queue.length) {
            const task = this.queue.shift();
            this.active++;
            Promise.resolve().then(() => this.fetch(task.url, task.original))
                .then(task.resolve, task.reject)
                .finally(() => { this.active--; this.pump(); });
        }
    }

    static async fetch(url, original) {
        if (Date.now() < this.pauseUntil) return original;
        for (let attempt = 0; attempt < 3; attempt++) {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), 20000);
            try {
                const response = await fetch(url, { signal: controller.signal, credentials: 'omit' });
                if (response.status === 429) {
                    this.pauseUntil = Date.now() + Math.max(1, Math.min(120, Number(response.headers.get('Retry-After')) || 60)) * 1000;
                    return original;
                }
                if (response.status === 422) {
                    // Invalid individual URLs must not prevent other images loading.
                    const error = await response.json().catch(() => ({}));
                    if (error.errors?.field) this.pauseUntil = Date.now() + 60000;
                    return original;
                }
                if (response.status === 503 && attempt < 2) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    continue;
                }
                if (!response.ok || !/^image\//i.test(response.headers.get('Content-Type') || '')) return original;
                return URL.createObjectURL(await response.blob());
            } catch { return original; }
            finally { clearTimeout(timer); }
        }
        return original;
    }

    static hydrate(root = document) {
        for (const image of root.querySelectorAll('img[data-thumbnail-url]')) {
            if (image.dataset.thumbnailStarted) continue;
            image.dataset.thumbnailStarted = 'true';
            const load = () => this.resolve(image.dataset.thumbnailUrl, image.dataset.originalSrc)
                .then(src => { image.src = src; });
            if (typeof IntersectionObserver === 'undefined') load();
            else {
                const observer = new IntersectionObserver(entries => {
                    if (!entries.some(entry => entry.isIntersecting)) return;
                    observer.disconnect();
                    load();
                }, { rootMargin: '200px' });
                observer.observe(image);
            }
        }
    }
}
