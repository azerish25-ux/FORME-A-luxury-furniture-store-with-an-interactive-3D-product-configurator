/** Small, delegated studio enhancement. Variant links remain server-authored. */
document.addEventListener('click', event => {
  if (!(event.target instanceof Element)) return;
  const button = event.target.closest('[data-studio-option]');
  const studio = button?.closest('[data-atelier-studio]');
  if (!studio) return;
  const image = studio.querySelector('.studio-image img');
  const link = studio.querySelector('[data-studio-link]');
  const caption = studio.querySelector('[data-studio-caption]');
  if (!image || !link || !caption) return;
  const url = new URL(button.dataset.studioUrl, location.href);
  const poster = new URL(button.dataset.studioImage, location.href);
  if (url.origin !== location.origin || !['https:', 'http:'].includes(poster.protocol)) return;
  studio.querySelectorAll('[data-studio-option]').forEach(option => {
    option.setAttribute('aria-pressed', String(option === button));
  });
  // Remove responsive sources too: they otherwise override the newly selected src.
  studio.querySelectorAll('.studio-image source').forEach(source => source.removeAttribute('srcset'));
  image.removeAttribute('srcset');
  image.src = poster.href;
  image.alt = `Arc sofa — ${button.dataset.studioLabel}`;
  caption.textContent = button.dataset.studioLabel;
  link.href = url.href;
});
