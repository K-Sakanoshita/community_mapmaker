// Extend the existing image-only fixtures with the strip's card/caption nodes.
module.exports = (context, strip) => {
    const createImage = context.document.createElement;
    const images = node => (node.children || []).flatMap(child => child.tagName === 'IMG' ? [child] : images(child));
    context.document.createElement = tag => {
        if (tag === 'img') {
            const image = createImage(tag);
            image.tagName = 'IMG';
            return image;
        }
        return {
            tagName: tag.toUpperCase(), children: [],
            append(...nodes) { this.children.push(...nodes); nodes.forEach(node => { node.parentElement = this; }); },
            querySelector() { return images(this)[0] || null; },
            remove() {
                if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(node => node !== this);
                this.parentElement = null;
            }
        };
    };
    strip.children ||= [];
    const append = strip.append.bind(strip);
    strip.append = node => { append(node); node.parentElement = strip; };
    strip.querySelector = () => images(strip)[0] || null;
    strip.querySelectorAll = selector => images(strip).filter(image => !selector.includes('data-thumbnail-loaded') || image.dataset.thumbnailLoaded === 'true');
};
