# Original assets and provenance

All 12 products, the three Arc sofa size meshes, the studio views, room scenes and material close-ups were authored for this fictional project in Blender. `tools/build_assets.py` is the reproducible geometry, material, lighting and camera source. The original local render used Blender 5.2.2; CI pins the official Blender 4.5.3 distribution with Cycles and verifies its published checksum. Minor denoising differences between Blender versions are expected.

The images are **computer-generated renders**, not photographs of manufactured products. An external AI image-generation attempt failed with an HTTP 402 billing response; no successful AI-generated photography is claimed or included. No furniture photography was copied from another brand. The original forms are not production engineering specifications. Arc gallery views and its interactive meshes share the same authored geometry. The gallery intentionally includes different colours and camera angles; the caption identifies the opening size and finish.

Type is requested through Google Fonts using the open-licensed DM Sans and Instrument Serif families. Font binaries are not bundled. System sans/serif fallbacks keep text usable offline. Three.js is MIT licensed; bundled library comments retain its attribution. Source SVG icons were authored for the theme.

WebP derivatives are delivered in the theme. Full PNG working renders can be regenerated. Product images are roughly 25–80 KB apiece; the three original GLB sizes are approximately 1.2–1.6 MB each. Only the requested model loads after the visitor explicitly opens 3D. Public gallery images remain available when WebGL or network loading fails.
