"""Strict web delivery derivatives for the original Atelier scenes.
Run AFTER atelier-assets.py. Original full-resolution PNGs stay out of the theme.
"""
import hashlib
import json
from pathlib import Path
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
ASSETS=ROOT/'assets'
names=['atelier-hero','atelier-room','vale-lounge-chair','monolith-coffee-table','lumen-floor-lamp']
records={}
for name in names:
    path=ASSETS/(name+'.png')
    if not path.exists():raise SystemExit(f'Missing authored render: {path}')
    with Image.open(path) as original:
        image=original.convert('RGB')
        target=ASSETS/(name+'.webp')
        image.save(target,'WEBP',quality=94,method=6)
        records[target.name]={'width':image.width,'height':image.height,'bytes':target.stat().st_size,'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
        small=image.copy();small.thumbnail((900,900))
        small_target=ASSETS/(name+'-900.webp')
        small.save(small_target,'WEBP',quality=92,method=6)
        records[small_target.name]={'width':small.width,'height':small.height,'bytes':small_target.stat().st_size,'sha256':hashlib.sha256(small_target.read_bytes()).hexdigest()}
# New page sections use these exact scene files; retain legacy image names only
# for merchant content that still references them, not as a second model source.
sources={str(p.relative_to(ROOT)):hashlib.sha256(p.read_bytes()).hexdigest() for p in [ROOT/'tools/atelier-assets.py',ROOT/'tools/atelier-pack.py',ROOT/'tools/arc-assets.py']}
models={}
for name in names[2:]:
    path=ASSETS/('atelier-'+name+'.glb')
    if not path.exists():raise SystemExit(f'Missing companion model: {path}')
    models[path.name]={'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
(ASSETS/'atelier-asset-manifest.json').write_text(json.dumps({'schema':1,'sourceHashes':sources,'renders':records,'models':models,'colourStudy':'Generous / Linen / Moss','note':'Original Blender renders of fictional products. Not documentary product photography.'},indent=2)+'\n')
print(f'Atelier: {len(records)} full-size/responsive images and three companion models.')
