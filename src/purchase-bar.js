/** Keep the mobile purchase summary out of the opening view.
 * IntersectionObserver alone misses a jump from above to below the viewport
 * when both samples have an intersection ratio of zero. Scroll/resize events
 * schedule at most one geometry read per frame; nothing runs while idle.
 */
export function mountPurchaseBar(row, bar) {
  if (!row || !bar) return () => {};
  const events = new AbortController();
  let disposed = false;
  let frame = 0;
  const update = () => {
    frame = 0;
    if (disposed) return;
    bar.hidden = !row.getClientRects().length || row.getBoundingClientRect().bottom >= 0;
  };
  const schedule = () => {
    if (!disposed && !frame) frame = requestAnimationFrame(update);
  };
  const intersection = new IntersectionObserver(schedule, { threshold: 0 });
  intersection.observe(row);
  const resize = new ResizeObserver(schedule);
  resize.observe(row);
  resize.observe(document.documentElement);
  window.addEventListener('scroll', schedule, { passive: true, signal: events.signal });
  window.addEventListener('resize', schedule, { passive: true, signal: events.signal });
  update();
  return () => {
    disposed = true;
    events.abort();
    intersection.disconnect();
    resize.disconnect();
    if (frame) cancelAnimationFrame(frame);
    bar.hidden = true;
  };
}
