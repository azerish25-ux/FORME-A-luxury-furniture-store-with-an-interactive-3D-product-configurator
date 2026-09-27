import { quantity } from './core.js';

/** Serializes server mutations while preserving the *latest intended* quantity per line.
 * Prices/discounts/stock remain server-owned. Adds are never automatically retried.
 */
export class CartState {
  /** @param {(path: string, body?: object) => Promise<any>} request
   * @param {{changed?: (cart: any, pending: Map<string, {quantity: number, revision: number}>) => void, failed?: (error: Error) => void}} options
   */
  constructor(request, { changed = () => {}, failed = () => {} } = {}) {
    this.request = request;
    this.changed = changed;
    this.failed = failed;
    this.cart = null;
    this.pending = new Map();
    this.tail = Promise.resolve();
    this.pumping = null;
    this.revision = 0;
  }

  run(task) {
    const next = this.tail.then(task);
    this.tail = next.catch(() => {});
    return next;
  }

  commit(cart) {
    if (!cart || !Array.isArray(cart.items)) throw new Error('The bag response was incomplete. Please refresh.');
    this.cart = cart;
    this.changed(cart, this.pending);
    return cart;
  }

  read() {
    return this.run(async () => this.commit(await this.request('cart.js')));
  }

  intended(key) {
    return this.pending.get(key)?.quantity ?? this.cart?.items.find(item => item.key === key)?.quantity ?? 0;
  }

  step(key, delta) {
    return this.set(key, this.intended(key) + delta);
  }

  set(key, value) {
    const next = quantity(value, 0);
    if (!this.cart?.items.some(item => item.key === key)) throw new Error('This piece is no longer in your bag. Please refresh.');
    this.pending.set(key, { quantity: next, revision: ++this.revision });
    this.changed(this.cart, this.pending);
    if (!this.pumping) {
      this.pumping = this.run(async () => {
        while (this.pending.size) {
          const [line, intent] = this.pending.entries().next().value;
          try {
            const updated = await this.request('cart/change.js', { id: line, quantity: intent.quantity });
            if (this.pending.get(line)?.revision === intent.revision) this.pending.delete(line);
            // A removed line key cannot be reused. Removal suppresses repeat actions while retaining focus in the view.
            if (!updated.items.some(item => item.key === line)) this.pending.delete(line);
            this.commit(updated);
          } catch (error) {
            this.pending.delete(line);
            // A timeout may have committed at the server. Reconcile; never blindly replay.
            try { this.commit(await this.request('cart.js')); } catch { this.changed(this.cart, this.pending); }
            this.failed(error);
          }
        }
      }).finally(() => { this.pumping = null; });
    }
    return this.pumping;
  }

  add(variant, count, properties = {}) {
    const amount = quantity(count);
    if (!variant?.available) return Promise.reject(new Error('Choose an available configuration.'));
    const id = variant.id; // Capture the purchase before any await.
    return this.run(async () => {
      await this.request('cart/add.js', { items: [{ id, quantity: amount, properties }] });
      return this.commit(await this.request('cart.js'));
    });
  }

  note(value) {
    const note = String(value).slice(0, 2000);
    return this.run(async () => this.commit(await this.request('cart/update.js', { note })));
  }

  async idle() {
    // Include operations queued while an earlier request was settling.
    let observed;
    do { observed = this.tail; await observed; } while (observed !== this.tail);
  }
}
