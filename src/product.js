import { findVariant, resolveVariant, quantity, configurationUrl } from './core.js';
import { settings, formatMoney, showError, announce, openDialog, closeDialog } from './dom.js';
import { ARC, arcSelection, posterURL, assetURL } from './arc-state.js';
import { cart } from './cart.js';
import { mountPurchaseBar } from './purchase-bar.js';

/** A product owns its selection and view; the cart owns server mutations. */
export class ProductController {
  constructor(section) {
    this.section = section;
    this.product = JSON.parse(section.querySelector('[data-product-json]').textContent);
    this.config = JSON.parse(section.querySelector('[data-configurator-settings]').textContent);
    this.variant = null;
    this.selection = null;
    this.viewer = null;
    this.viewerPromise = null;
    this.viewerVisible = false;
    this.disposed = false;
    this.adding = false;
    this.slide = 0;
    this.posterRevision = 0;
    this.abort = new AbortController();
    this.form = section.querySelector('[data-product-form]');
    this.price = section.querySelector('[data-product-price]');
    this.select = section.querySelector('[data-variant-select]');
    this.onHistory = () => this.fromURL(false);
    this.decorateOptions();
    section.addEventListener('change', event => {
      if (event.target.matches('[data-option-input]')) {
        const options = [...section.querySelectorAll('[data-option-index]')].map(fieldset => fieldset.querySelector('input:checked')?.value);
        this.applyVariant(findVariant(this.product.variants, options), true);
      }
      if (event.target.matches('[data-variant-select]')) this.applyVariant(resolveVariant(this.product.variants, event.target.value), true);
    }, { signal: this.abort.signal });
    section.addEventListener('click', event => this.onClick(event), { signal: this.abort.signal });
    section.addEventListener('keydown', event => {
      if (!this.section.querySelector('[data-gallery-dialog]')?.open) return;
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      event.preventDefault(); this.showSlide(this.slide + (event.key === 'ArrowRight' ? 1 : -1));
    }, { signal: this.abort.signal });
    this.form.addEventListener('submit', event => this.addToCart(event), { signal: this.abort.signal });
    window.addEventListener('popstate', this.onHistory);
    this.disposePurchaseBar = mountPurchaseBar(
      section.querySelector('.purchase-row'), section.querySelector('[data-sticky-purchase]'),
    );
    this.fromURL(false);
  }

  $(selector) { return this.section.querySelector(selector); }
  text(selector, value) { this.section.querySelectorAll(selector).forEach(node => { node.textContent = value; }); }

  decorateOptions() {
    if (!this.config.arc) return;
    this.section.querySelectorAll('[data-option-name]').forEach(field => {
      const type = field.dataset.optionName;
      field.querySelectorAll('.option-choice').forEach(label => {
        const value = label.querySelector('input').value;
        const face = label.querySelector('.choice-face');
        if (type === 'Size' && ARC.sizes[value]) {
          const record = ARC.sizes[value];
          const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
          svg.setAttribute('viewBox', '0 0 90 48'); svg.setAttribute('aria-hidden', 'true');
          // Fixed, original diagrams; no merchant input is inserted into markup.
          svg.innerHTML = value === 'Chaise'
            ? '<path d="M5 7h80v34H59V29H5Z"/><path d="M13 14h64M13 14v15m22-15v15m23-15v15"/>'
            : `<rect x="${value === 'Compact' ? 13 : 5}" y="7" width="${value === 'Compact' ? 64 : 80}" height="29" rx="3"/><path d="M${value === 'Compact' ? 20 : 12} 14h${value === 'Compact' ? 50 : 66}M45 14v22"/>`;
          face.prepend(svg);
          const width = document.createElement('small'); width.textContent = `${record.dimensions[0]} cm wide`; face.append(width);
          label.title = record.description;
        }
        if (type === 'Upholstery' && ARC.fabrics[value]) {
          const image = new Image(96, 64);
          image.src = assetURL(`arc-material-${ARC.fabrics[value].id}.webp`, this.config.assetBase, location.href);
          image.alt = ''; image.loading = 'lazy'; face.prepend(image);
        }
      });
    });
  }

  fromURL(updateURL) {
    const id = new URL(location.href).searchParams.get('variant');
    const valid = this.product.variants.some(variant => String(variant.id) === id);
    this.applyVariant(resolveVariant(this.product.variants, id || this.select.value), updateURL);
    if (id && !valid) this.notice('This configuration is no longer available. We’ve selected the first available option.');
  }

  notice(message) { showError(this.$('[data-variant-notice]'), message); }

  purchaseState() {
    const text = this.adding ? 'Adding to your bag…' : !this.variant ? 'Unavailable combination' : this.variant.available ? 'Add to bag' : 'Currently unavailable';
    this.text('[data-add-label]', text);
    this.section.querySelectorAll('[data-add-to-cart], [data-sticky-add]').forEach(button => {
      button.disabled = this.adding || !this.variant?.available;
      button.setAttribute('aria-busy', String(this.adding));
    });
    this.text('[data-sticky-add]', text);
  }

  applyVariant(variant, updateURL) {
    this.variant = variant;
    this.selection = this.config.arc ? arcSelection(this.product, variant) : null;
    this.purchaseState();
    this.notice(!variant ? 'This combination is not offered. Please choose another option.' : !variant.available ? 'This configuration is currently unavailable. Choose another colour, upholstery or size.' : '');
    if (!variant) { this.select.value = ''; return; }
    this.select.value = String(variant.id);
    this.text('[data-product-price], [data-sticky-price]', formatMoney(variant.price));
    const hidden = this.$('[data-config-property]');
    if (hidden) hidden.value = variant.title;
    this.section.querySelectorAll('[data-option-index]').forEach(fieldset => {
      const value = variant.options[Number(fieldset.dataset.optionIndex)];
      fieldset.querySelectorAll('input').forEach(input => { input.checked = input.value === value; });
      fieldset.querySelector('[data-option-current]').textContent = value;
    });
    if (this.selection) {
      const { dimensions, title, fabric } = this.selection;
      this.text('[data-size-dimensions], [data-selected-dimensions]', `${dimensions.join(' × ')} cm`);
      this.text('[data-selected-materials]', `${fabric} upholstery · walnut frame`);
      this.text('[data-material-description]', ARC.fabrics[fabric].description);
      this.text('[data-sticky-selection]', title);
      this.text('[data-measure-title]', `Arc ${this.selection.size}`);
      dimensions.forEach((value, index) => this.text(`[data-measure-${['width','depth','height'][index]}]`, `${value} cm`));
      const path = this.$('[data-plan-outline]');
      if (path) {
        const depth = Math.min(170, 280 * dimensions[1] / dimensions[0]);
        const front = 60 + depth;
        const short = 60 + depth * 103 / dimensions[1];
        path.setAttribute('d', this.selection.size === 'Chaise' ? `M80 60H360V${front}H270V${short}H80Z` : `M80 60H360V${front}H80Z`);
        this.$('[data-plan-lines]').setAttribute('d', `M80 245H360M80 238V252M360 238V252M395 60V${front}M388 60H402M388 ${front}H402`);
        const width = this.$('svg [data-measure-width]'); width.setAttribute('y', '269');
        const d = this.$('svg [data-measure-depth]'); const y = (front + 60) / 2;
        d.setAttribute('y', String(y)); d.setAttribute('transform', `rotate(90 416 ${y})`);
      }
      this.updatePoster();
    } else if (this.config.arc) {
      // A merchant-created variant remains purchasable but must not impersonate a supported model.
      this.notice('This configuration does not have a matched 3D model or render. Please confirm its specifications with the store.');
      this.text('[data-size-dimensions], [data-selected-dimensions]', 'Confirm dimensions with the store');
      this.text('[data-sticky-selection]', variant.title);
      this.posterRevision++;
      const poster = this.$('[data-selected-poster]'); if (poster) poster.hidden = true;
      this.setView('gallery');
    } else if (variant.featured_image?.id) {
      const index = this.product.media?.findIndex(media => media.id === variant.featured_image.id);
      if (index >= 0) this.showSlide(index);
    }
    this.$('[data-availability-dot]')?.classList.toggle('availability-dot--off', !variant.available);
    this.text('[data-delivery-copy]', variant.available ? `Estimated dispatch: ${this.config.delivery}` : 'This configuration is currently unavailable.');
    if (updateURL) history.pushState({}, '', configurationUrl(location.href, variant.id));
    if (this.viewer && this.selection) this.updateViewer().catch(() => this.viewerFailure());
  }

  async updatePoster() {
    const poster = this.$('[data-selected-poster]');
    if (!poster || !this.selection) return;
    const selection = this.selection;
    const revision = ++this.posterRevision;
    const url = posterURL(selection, this.config.assetBase, location.href);
    const small = posterURL(selection, this.config.assetBase, location.href, 720);
    const status = this.$('[data-poster-status]');
    this.showSlide(0);
    const apply = () => {
      if (this.disposed || revision !== this.posterRevision) return;
      poster.srcset = `${small} 720w, ${url} 1440w`;
      poster.sizes = '(min-width: 1100px) 58vw, 100vw'; poster.src = url;
      poster.alt = `Arc · ${selection.title}`;
      poster.hidden = false;
      poster.dataset.configuration = selection.key;
      const thumb = this.$('[data-selected-thumbnail]'); if (thumb) thumb.src = small;
      if (status) status.hidden = true;
      this.showSlide(this.slide);
    };
    if (poster.src === url && poster.complete && poster.naturalWidth > 0) { apply(); return; }
    poster.hidden = true;
    if (status) { status.textContent = 'Preparing your selection…'; status.hidden = this.viewerVisible; }
    try {
      const image = new Image(); image.src = window.innerWidth < 760 ? small : url;
      await image.decode(); apply();
    } catch {
      if (this.disposed || revision !== this.posterRevision) return;
      if (status) { status.textContent = 'This selection’s image could not load. Your choices are saved; the other gallery views and purchase controls remain available.'; status.hidden = this.viewerVisible; }
    }
  }

  async onClick(event) {
    const button = event.target.closest('button');
    if (!button) return;
    if (button.matches('[data-thumbnail]')) { this.setView('gallery'); this.showSlide(Number(button.dataset.thumbnail)); }
    if (button.matches('[data-view]')) await this.setView(button.dataset.view);
    if (button.matches('[data-viewer-reset]')) this.viewer?.reset();
    if (button.matches('[data-camera]')) this.viewer?.view(button.dataset.camera);
    if (button.matches('[data-rotate]')) this.viewer?.rotate(Number(button.dataset.rotate));
    if (button.matches('[data-zoom]')) this.viewer?.zoom(Number(button.dataset.zoom));
    if (button.matches('[data-dimensions]')) this.toggleDimensions();
    if (button.matches('[data-open-dimensions]')) openDialog(this.$('[data-measure-dialog]'), button);
    if (button.matches('[data-open-gallery]')) { openDialog(this.$('[data-gallery-dialog]'), button); this.showSlide(this.slide); }
    if (button.matches('[data-gallery-step]')) this.showSlide(this.slide + Number(button.dataset.galleryStep));
    if (button.matches('[data-close-product-dialog]')) closeDialog(button.closest('dialog'));
    if (button.matches('[data-share-config]')) await this.share();
    if (button.matches('[data-sticky-add]')) {
      this.purchaseTrigger = button;
      try { this.form.requestSubmit(this.$('[data-add-to-cart]')); }
      finally { this.purchaseTrigger = null; }
    }
    if (button.matches('[data-quantity-step]')) {
      const input = this.form.querySelector('[name="quantity"]');
      input.value = String(Math.max(1, Math.min(99, (Number(input.value) || 1) + Number(button.dataset.quantityStep))));
    }
  }

  showSlide(index) {
    const slides = [...this.section.querySelectorAll('[data-slide]')];
    if (!slides.length) return;
    this.slide = (index + slides.length) % slides.length;
    slides.forEach(slide => { slide.hidden = Number(slide.dataset.slide) !== this.slide; });
    this.section.querySelectorAll('[data-thumbnail]').forEach(button => button.setAttribute('aria-pressed', String(Number(button.dataset.thumbnail) === this.slide)));
    const current = slides[this.slide];
    const caption = this.config.arc && this.slide === 0 ? `Your selection · ${this.selection?.title || this.variant?.title || ''}` : current.dataset.caption || this.product.title;
    this.text('[data-gallery-caption], [data-lightbox-caption]', caption);
    this.text('[data-gallery-counter], [data-lightbox-counter]', `${String(this.slide + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`);
    const source = current.querySelector('img');
    const target = this.$('[data-lightbox-image]');
    if (target && source && this.$('[data-gallery-dialog]')?.open) { target.src = source.src; target.alt = source.alt; target.hidden = source.hidden; }
    const status = this.$('[data-poster-status]');
    if (status) status.hidden = this.slide !== 0 || this.viewerVisible || !this.$('[data-selected-poster]')?.hidden;
  }

  async setView(view) {
    if (view === '3d' && (!this.config.enabled || !this.selection)) return;
    this.viewerVisible = view === '3d';
    this.$('[data-gallery]').hidden = this.viewerVisible;
    const host = this.$('[data-viewer]');
    if (host) host.hidden = !this.viewerVisible;
    for (const selector of ['[data-viewer-tools]', '[data-camera-controls]']) {
      const node = this.$(selector); if (node) node.hidden = !this.viewerVisible;
    }
    this.$('[data-open-gallery]').hidden = this.viewerVisible;
    this.section.querySelectorAll('[data-view]').forEach(button => {
      const active = button.dataset.view === view;
      button.classList.toggle('is-active', active); button.setAttribute('aria-pressed', String(active));
    });
    this.viewer?.setVisible(this.viewerVisible);
    this.showSlide(this.slide);
    if (!this.viewerVisible) return;
    try {
      if (!this.viewerPromise) {
        this.viewerPromise = import(/* @vite-ignore */ settings.configurator).then(async module => {
          if (this.disposed) return null;
          const viewer = await module.createConfigurator(host, this.config);
          if (this.disposed) { viewer.dispose(); return null; }
          this.viewer = viewer; return viewer;
        }).catch(error => { this.viewerPromise = null; throw error; });
      }
      await this.viewerPromise;
      if (!this.disposed && this.viewer) {
        this.viewer.setVisible(this.viewerVisible); await this.updateViewer();
        this.text('[data-gallery-hint]', 'Drag or use the rotation buttons. Pinch, scroll or use + / − to zoom.');
      }
    } catch { this.viewerFailure(); }
  }

  viewerFailure() {
    if (this.disposed) return;
    this.viewer?.dispose(); this.viewer = null; this.viewerPromise = null;
    this.setView('gallery');
    this.text('[data-gallery-hint]', 'The 3D view could not load. Your selected configuration, gallery and bag remain available.');
    announce('3D could not load. Your selected configuration is preserved.');
  }

  async updateViewer() { if (this.viewer && this.selection) await this.viewer.update(this.selection); }

  toggleDimensions(force) {
    if (!this.viewer) return;
    const button = this.$('[data-dimensions]');
    const show = force ?? button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(show));
    button.setAttribute('aria-label', show ? 'Hide dimensions' : 'Show dimensions');
    this.viewer.setDimensions(show);
  }

  async share() {
    if (!this.variant) return;
    const url = configurationUrl(location.href, this.variant.id);
    try {
      if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(url); announce('Your exact configuration link has been copied.'); return; }
    } catch { /* Manual copy remains available when clipboard permission is denied. */ }
    const fallback = this.$('[data-share-fallback]'); fallback.hidden = false;
    const input = fallback.querySelector('input'); input.value = url; input.focus(); input.select();
  }

  async addToCart(event) {
    event.preventDefault();
    if (this.adding) return;
    const error = this.$('[data-product-error]');
    const button = this.purchaseTrigger || event.submitter || this.$('[data-add-to-cart]');
    showError(error, '');
    if (!this.variant?.available) { showError(error, 'Please choose an available configuration.'); return; }
    const variant = this.variant;
    this.adding = true; this.purchaseState();
    try {
      const count = quantity(this.form.querySelector('[name="quantity"]').value);
      await cart.add(variant, count, { '_FORME configuration': variant.title });
      openDialog(document.getElementById('CartDrawer'), button);
      announce(`${this.product.title} added to your bag.`);
    } catch (failure) { showError(error, failure.message); }
    finally { this.adding = false; this.purchaseState(); }
  }

  dispose() {
    this.disposed = true; this.posterRevision++;
    this.abort.abort(); this.disposePurchaseBar?.();
    window.removeEventListener('popstate', this.onHistory);
    this.viewer?.dispose();
  }
}
