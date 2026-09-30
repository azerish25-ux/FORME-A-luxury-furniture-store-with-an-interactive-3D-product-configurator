/** Presentation-only presets. Never used to resolve a purchasable variant. */
export const STUDIO_LIGHTS = Object.freeze({
  daylight: Object.freeze({ label: 'Daylight', background: '#e4dfd5', key: '#fff7ed', fill: '#dce7f4', keyIntensity: 3, fillIntensity: .55, ambient: .85, environment: .5, exposure: 1.14 }),
  warm: Object.freeze({ label: 'Warm light', background: '#bcb09d', key: '#ffe0ab', fill: '#ded9d2', keyIntensity: 2.6, fillIntensity: .35, ambient: .65, environment: .38, exposure: 1.12 }),
});
export function studioLighting(value) {
  return Object.hasOwn(STUDIO_LIGHTS, value) ? STUDIO_LIGHTS[value] : STUDIO_LIGHTS.daylight;
}
