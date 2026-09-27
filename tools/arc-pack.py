"""Package completed original renders; never substitute a different configuration.

--partial is for an in-progress local review only. Release/CI must use --strict.
The runtime manifest records hashes of every resource and its authoring source.
"""
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / 'assets'
SPEC = json.loads((ROOT / 'tools/arc-spec.json').read_text())
parser = argparse.ArgumentParser()
parser.add_argument('--partial', action='store_true')
parser.add_argument('--strict', action='store_true')
args = parser.parse_args()
expected = []
for size in SPEC['sizes'].values():
    for fabric in SPEC['fabrics'].values():
        for colour in SPEC['colours'].values():
            expected.append('arc-v2-' + '-'.join([size['id'], fabric['id'], colour['id']]))
expected += ['arc-v2-side', 'arc-v2-profile', 'arc-v2-seam', 'arc-v2-walnut']
expected += [f'arc-material-{fabric["id"]}' for fabric in SPEC['fabrics'].values()]
missing = []
for name in expected:
    path = ASSETS / f'{name}.png'
    if not path.exists():
        missing.append(path.name)
        continue
    try:
        with Image.open(path) as image:
            image = image.convert('RGB')
            image.save(ASSETS / f'{name}.webp', quality=94, method=6)
            if name.startswith('arc-v2-') and name not in ['arc-v2-side', 'arc-v2-profile', 'arc-v2-seam', 'arc-v2-walnut']:
                image.thumbnail((720, 500), Image.Resampling.LANCZOS)
                image.save(ASSETS / f'{name}-720.webp', quality=92, method=6)
    except OSError:
        if not args.partial:
            raise
        missing.append(path.name)
if missing and not args.partial:
    raise SystemExit('Missing original renders: ' + ', '.join(missing))
if not args.partial:
    sources = ['tools/arc-spec.json', 'tools/arc-assets.py', 'tools/arc-materials.py', 'tools/arc-pack.py']
    source_hashes = {p: hashlib.sha256((ROOT / p).read_bytes()).hexdigest() for p in sources}
    resources = []
    paths = list(ASSETS.glob('arc-v2-*.webp')) + list(ASSETS.glob('arc-material-*.webp'))
    paths += [ASSETS / value['model'] for value in SPEC['sizes'].values()]
    for name in ['linen', 'boucle', 'wool', 'walnut']:
        paths += [ASSETS / f'arc-{name}-{channel}.png' for channel in ['color', 'normal', 'rough']]
    paths.append(ASSETS / 'arc-dimensions.json')
    for path in sorted(set(paths)):
        content = path.read_bytes()
        resources.append({'file': path.name, 'bytes': len(content), 'sha256': hashlib.sha256(content).hexdigest()})
    manifest = {'version': SPEC['version'], 'provenance': 'Original procedural materials and Blender CGI. No documentary product photography or manufacturing certification.', 'source_sha256': source_hashes, 'resources': resources}
    (ASSETS / 'arc-asset-manifest.json').write_text(json.dumps(manifest, indent=2) + '\n')
print(f'Packed {len(expected)-len(missing)} of {len(expected)} original render views. Missing: {len(missing)}.')
