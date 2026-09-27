import test from 'node:test';
import assert from 'node:assert/strict';
import { CartState } from '../src/cart-state.js';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function fixture({ delay = 12, reject = false, removeOnFailure = false } = {}) {
  let value = 1, note = ''; const requests = [], errors = [], views = [];
  const snapshot = () => ({ item_count: value, total_price: value * 1500, note, items: value ? [{ key: 'line:properties', quantity: value, final_line_price: value * 1500 }] : [] });
  const request = async (path, body) => {
    requests.push({ path, body: structuredClone(body) }); await pause(delay);
    if (path === 'cart/change.js') {
      assert.equal(body.id, 'line:properties');
      if (reject) { if (removeOnFailure) value = 0; throw new Error('Only one remains available.'); }
      value = body.quantity;
    }
    if (path === 'cart/update.js') note = body.note;
    return snapshot();
  };
  const state = new CartState(request, { failed: error => errors.push(error.message), changed: (cart, pending) => views.push({ cart: structuredClone(cart), pending: [...pending] }) });
  state.commit(snapshot()); return { state, requests, errors, views };
}
test('rapid quantity clicks preserve every increment even during the first request', async () => {
  const { state, requests } = fixture();
  state.step('line:properties', 1);
  await pause(2);
  for (let n = 0; n < 7; n++) state.step('line:properties', 1);
  assert.equal(state.intended('line:properties'), 9);
  await state.idle();
  assert.equal(state.cart.items[0].quantity, 9);
  assert.equal(state.pending.size, 0);
  assert.equal(requests.filter(r => r.path === 'cart/change.js').at(-1).body.quantity, 9);
});
test('absolute edits and deltas share one latest-intent ordering', async () => {
  const { state } = fixture();
  state.step('line:properties', 1); await pause(2);
  state.set('line:properties', 7); state.step('line:properties', -1);
  await state.idle(); assert.equal(state.cart.items[0].quantity, 6);
});
test('remove while a previous quantity is in flight ends with an empty bag', async () => {
  const { state } = fixture();
  state.step('line:properties', 1); await pause(2); state.set('line:properties', 0);
  await state.idle(); assert.equal(state.cart.item_count, 0); assert.equal(state.cart.total_price, 0);
});
test('stock rejection discards pending intent and reconciles the server without a retry loop', async () => {
  const { state, requests, errors } = fixture({ reject: true });
  state.set('line:properties', 8); await state.idle();
  assert.equal(state.cart.items[0].quantity, 1); assert.equal(state.pending.size, 0);
  assert.equal(errors.length, 1);
  assert.deepEqual(requests.map(r => r.path), ['cart/change.js', 'cart.js']);
});
test('server reconciliation can remove an expired line after a failed update', async () => {
  const { state } = fixture({ reject: true, removeOnFailure: true });
  state.set('line:properties', 4); await state.idle(); assert.equal(state.cart.item_count, 0);
});
test('delivery notes wait behind quantity mutations', async () => {
  const { state, requests } = fixture(); state.set('line:properties', 3);
  await state.note('Please use the side entrance.'); await state.idle();
  assert.equal(state.cart.note, 'Please use the side entrance.'); assert.equal(state.cart.item_count, 3);
  assert.deepEqual(requests.map(r => r.path), ['cart/change.js', 'cart/update.js']);
});
test('add captures the exact variant and never automatically retries a failure', async () => {
  const requests=[];
  const state=new CartState(async(path,body)=>{requests.push({path,body}); throw new Error('Offline');});
  const variant={id:123,available:true}; const result=state.add(variant,1); variant.id=456;
  await assert.rejects(result, /Offline/); assert.equal(requests.length,1); assert.equal(requests[0].body.items[0].id,123);
});
test('invalid quantities, missing lines and unavailable variants are rejected', async () => {
  const { state } = fixture();
  for (const value of [-1, .5, 100, NaN]) assert.throws(()=>state.set('line:properties',value));
  assert.throws(()=>state.set('missing',1));
  await assert.rejects(state.add({id:1,available:false},1));
});
