"""Deterministic physical-scale texture authoring. No external stock textures.
Run with Python + numpy + Pillow before arc-assets.py. Each fabric tile is 12 cm.
Colour is an unlit multiplier; normals are tangent-space OpenGL (+Y).
"""
from pathlib import Path
import numpy as np
from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets'
N = 512
Y, X = np.mgrid[0:N, 0:N].astype(float)
rng = np.random.default_rng(240927)

def smooth_noise(scale, seed):
    random = np.random.default_rng(seed).random((scale, scale))
    im = Image.fromarray(np.uint8(random * 255)).resize((N, N), Image.Resampling.BICUBIC)
    return np.asarray(im, dtype=float) / 255

def save(name, height, grey, roughness, strength=1.0, colour=None):
    dx = (np.roll(height, -1, 1) - np.roll(height, 1, 1)) * strength
    dy = (np.roll(height, -1, 0) - np.roll(height, 1, 0)) * strength
    normals = np.dstack((-dx, dy, np.ones_like(dx)))
    normals /= np.linalg.norm(normals, axis=2)[..., None]
    Image.fromarray(np.uint8(np.clip(normals * .5 + .5, 0, 1) * 255)).save(OUT / f'arc-{name}-normal.png', optimize=True)
    if colour is None:
        rgb = np.repeat(np.clip(grey, 0, 1)[..., None], 3, axis=2)
    else:
        rgb = np.clip(grey[..., None] * np.array(colour), 0, 1)
    Image.fromarray(np.uint8(rgb * 255)).save(OUT / f'arc-{name}-color.png', optimize=True)
    Image.fromarray(np.uint8(np.clip(roughness, 0, 1) * 255)).save(OUT / f'arc-{name}-rough.png', optimize=True)

# Unequal warp/weft, alternating over-under intersections and yarn-scale slubs.
wx = (X / N * 80 + .10 * np.sin(Y / N * 2 * np.pi * 4))
wy = (Y / N * 72 + .10 * np.sin(X / N * 2 * np.pi * 3))
over = ((np.floor(wx) + np.floor(wy)) % 2)
warp = np.sin(np.pi * wx) ** 2
weft = np.sin(np.pi * wy) ** 2
linen = np.maximum(warp * (.6 + .4 * over), weft * (1 - .4 * over))
linen += .08 * smooth_noise(28, 21)
save('linen', linen, .77 + .17 * linen + .04 * smooth_noise(20, 2), .72 + .19 * linen, 1.35)

# A staggered field of irregular yarn loops, not white noise standing in for bouclé.
boucle = np.zeros((N, N))
for row in range(36):
    for col in range(36):
        cx = (col + .5 * (row % 2) + rng.uniform(-.18, .18)) * N / 36
        cy = (row + rng.uniform(-.2, .2)) * N / 36
        dx = (X - cx + N / 2) % N - N / 2
        dy = (Y - cy + N / 2) % N - N / 2
        radius = np.sqrt((dx / rng.uniform(3.1, 4.4)) ** 2 + (dy / rng.uniform(3.4, 5.1)) ** 2)
        loop = np.exp(-((radius - 1) / .30) ** 2) * rng.uniform(.65, 1)
        boucle = np.maximum(boucle, loop)
boucle += .10 * smooth_noise(100, 9)
save('boucle', boucle, .77 + .20 * boucle + .025 * smooth_noise(16, 4), .87 + .10 * boucle, 1.9)

# A fine twill and fibrous nap: directional but less pronounced than linen.
twill = (.5 + .5 * np.sin((X + Y * .7) * np.pi / 2.8)) * (.55 + .45 * np.sin(Y * np.pi / 2.2) ** 2)
wool = .36 * twill + .15 * smooth_noise(240, 13) + .16 * smooth_noise(40, 14)
save('wool', wool, .84 + .10 * wool + .035 * smooth_noise(14, 15), .82 + .14 * wool, .9)

# Longitudinal, irregular walnut grain. Unequal growth bands and elongated
# pores avoid the evenly spaced stripes of a repeated sine-only wood shader.
wood_rng = np.random.default_rng(44)
strands = Image.fromarray(np.uint8(wood_rng.random((96, 12))*255)).resize((N,N), Image.Resampling.BICUBIC)
strands = np.asarray(strands, dtype=float)/255
flow = Y/N*7 + .32*np.sin(X/N*(2*np.pi)) + .22*smooth_noise(5,45)
growth = .5 + .5*np.sin(flow*(2*np.pi))
pores = np.clip((strands-.73)*3.5,0,1)
wood = .13*growth + .12*strands - .025*pores
save('walnut', wood, .76+.09*growth+.12*strands-.08*pores, .42+.09*(1-strands), .45, [.34,.22,.135])
print('Authored 12 texture maps; fabric scale 0.12 m per UV unit.')
