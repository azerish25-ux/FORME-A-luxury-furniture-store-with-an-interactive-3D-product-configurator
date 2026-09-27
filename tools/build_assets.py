"""FORME original furniture. Blender 4.0+ / Cycles, authored in Blender 5.2.2.

blender -b -t 4 --python tools/build_assets.py -- --mode all
Distances are metres. The same Arc geometry supplies the gallery and glTF.
FORME_ONLY optionally limits product renders to comma-separated asset names.
"""
import bpy
import math
import random
import sys
import os
import argparse
import json
from mathutils import Vector
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets'
OUT.mkdir(exist_ok=True)
parser = argparse.ArgumentParser()
parser.add_argument('--mode', default='all', choices=['all', 'models', 'hero', 'products', 'detail', 'room'])
parser.add_argument('--quality', type=int, default=48)
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])
ONLY = set(filter(None, os.environ.get('FORME_ONLY', '').split(',')))
random.seed(73)


def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for block in list(bpy.data.materials):
        if block.users == 0:
            bpy.data.materials.remove(block)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = args.quality
    scene.cycles.use_denoising = True
    scene.cycles.max_bounces = 8
    scene.cycles.diffuse_bounces = 4
    scene.cycles.glossy_bounces = 4
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = 0.3
    world = bpy.data.worlds.new('Warm daylight') if not bpy.data.worlds else bpy.data.worlds[0]
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (0.73, 0.78, 0.84, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = 0.28
    return scene


def srgb(hexstr):
    s = hexstr.lstrip('#')
    vals = [int(s[i:i + 2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in vals) + (1,)


def material(name, color, rough=.5, metal=0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bs = m.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = srgb(color)
    bs.inputs['Roughness'].default_value = rough
    bs.inputs['Metallic'].default_value = metal
    m.diffuse_color = srgb(color)
    return m


def fabric(name='Upholstery', color='#beb3a2', kind='linen'):
    m = material(name, color, .84)
    n, l = m.node_tree.nodes, m.node_tree.links
    bs = n.get('Principled BSDF')
    bs.inputs['Sheen Weight'].default_value = .38
    bs.inputs['Sheen Roughness'].default_value = .7
    tex = n.new('ShaderNodeTexNoise')
    tex.inputs['Scale'].default_value = 210
    tex.inputs['Detail'].default_value = 3
    tex.inputs['Roughness'].default_value = .76
    coord = n.new('ShaderNodeTexCoord')
    l.new(coord.outputs['Generated'], tex.inputs['Vector'])
    if kind == 'boucle':
        vor = n.new('ShaderNodeTexVoronoi')
        vor.inputs['Scale'].default_value = 180
        l.new(coord.outputs['Generated'], vor.inputs['Vector'])
        source = vor.outputs['Distance']
    else:
        wave = n.new('ShaderNodeTexWave')
        wave.wave_type = 'BANDS'
        wave.bands_direction = 'X'
        wave.inputs['Scale'].default_value = 235
        wave.inputs['Distortion'].default_value = 6
        l.new(coord.outputs['Generated'], wave.inputs['Vector'])
        mul = n.new('ShaderNodeMixRGB')
        mul.blend_type = 'MULTIPLY'
        mul.inputs[0].default_value = .68
        l.new(wave.outputs[0], mul.inputs[1])
        l.new(tex.outputs['Fac'], mul.inputs[2])
        source = mul.outputs[0]
    bump = n.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .28 if kind == 'boucle' else .21
    bump.inputs['Distance'].default_value = .0032 if kind == 'boucle' else .0018
    l.new(source, bump.inputs['Height'])
    l.new(bump.outputs['Normal'], bs.inputs['Normal'])
    ramp = n.new('ShaderNodeValToRGB')
    base = srgb(color)
    ramp.color_ramp.elements[0].position = .1
    ramp.color_ramp.elements[0].color = tuple(c * .79 for c in base[:3]) + (1,)
    ramp.color_ramp.elements[1].position = .85
    ramp.color_ramp.elements[1].color = tuple(min(1, c * 1.12) for c in base[:3]) + (1,)
    l.new(tex.outputs['Fac'], ramp.inputs[0])
    l.new(ramp.outputs[0], bs.inputs['Base Color'])
    return m


def wood(name='Oak', color='#987557'):
    m = material(name, color, .42)
    n, l = m.node_tree.nodes, m.node_tree.links
    bs = n.get('Principled BSDF')
    tc = n.new('ShaderNodeTexCoord')
    mapping = n.new('ShaderNodeMapping')
    mapping.inputs['Scale'].default_value = (2, 65, 2)
    l.new(tc.outputs['Generated'], mapping.inputs[0])
    noise = n.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 3
    noise.inputs['Detail'].default_value = 4
    noise.inputs['Roughness'].default_value = .8
    l.new(mapping.outputs[0], noise.inputs['Vector'])
    ramp = n.new('ShaderNodeValToRGB')
    base = srgb(color)
    ramp.color_ramp.elements[0].color = tuple(c * .35 for c in base[:3]) + (1,)
    ramp.color_ramp.elements[1].color = tuple(min(1, c * 1.3) for c in base[:3]) + (1,)
    l.new(noise.outputs['Fac'], ramp.inputs[0])
    l.new(ramp.outputs[0], bs.inputs['Base Color'])
    bump = n.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .19
    bump.inputs['Distance'].default_value = .002
    l.new(noise.outputs['Fac'], bump.inputs['Height'])
    l.new(bump.outputs[0], bs.inputs['Normal'])
    return m


def stone():
    m = material('Honed travertine', '#c1b295', .68)
    n, l = m.node_tree.nodes, m.node_tree.links
    bs = n.get('Principled BSDF')
    tc = n.new('ShaderNodeTexCoord')
    mp = n.new('ShaderNodeMapping')
    mp.inputs['Scale'].default_value = (1, 1, 9)
    l.new(tc.outputs['Generated'], mp.inputs[0])
    no = n.new('ShaderNodeTexNoise')
    no.inputs['Scale'].default_value = 8
    no.inputs['Detail'].default_value = 5
    no.inputs['Roughness'].default_value = .72
    l.new(mp.outputs[0], no.inputs[0])
    ra = n.new('ShaderNodeValToRGB')
    ra.color_ramp.elements[0].position = .12
    ra.color_ramp.elements[0].color = srgb('#807561')
    ra.color_ramp.elements[1].position = .9
    ra.color_ramp.elements[1].color = srgb('#dfd2b9')
    l.new(no.outputs['Fac'], ra.inputs[0])
    l.new(ra.outputs[0], bs.inputs['Base Color'])
    bump = n.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .22
    bump.inputs['Distance'].default_value = .006
    l.new(no.outputs['Fac'], bump.inputs['Height'])
    l.new(bump.outputs[0], bs.inputs['Normal'])
    return m


def plaster(color='#dad4c8'):
    m = material('Limewash', color, .94)
    n, l = m.node_tree.nodes, m.node_tree.links
    no = n.new('ShaderNodeTexNoise')
    no.inputs['Scale'].default_value = 150
    no.inputs['Detail'].default_value = 3
    bump = n.new('ShaderNodeBump')
    bump.inputs['Strength'].default_value = .17
    bump.inputs['Distance'].default_value = .012
    l.new(no.outputs['Fac'], bump.inputs['Height'])
    l.new(bump.outputs[0], n.get('Principled BSDF').inputs['Normal'])
    return m


def box(name, loc, scale, mat, bevel=.03, sub=0):
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.object
    o.name = name
    o.dimensions = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if mat:
        o.data.materials.append(mat)
    if bevel:
        m = o.modifiers.new('Soft manufactured edges', 'BEVEL')
        m.width, m.segments = bevel, 5
        bpy.context.view_layer.objects.active = o
        bpy.ops.object.modifier_apply(modifier=m.name)
    if sub:
        m = o.modifiers.new('Upholstery surface', 'SUBSURF')
        m.levels = sub
        bpy.ops.object.modifier_apply(modifier=m.name)
    for p in o.data.polygons:
        p.use_smooth = True
    if not sub:
        m = o.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
        m.keep_sharp = True
    return o


def cushion(name, loc, scale, mat, seed=0, crease=.002):
    o = box(name, loc, scale, mat, min(scale) * .31, 2)
    for v in o.data.vertices:
        p = v.co
        x, y, z = p.x / (scale[0] / 2), p.y / (scale[1] / 2), p.z / (scale[2] / 2)
        edge = max(abs(x), abs(y))
        wave = math.sin(x * 31 + y * 17 + seed) * math.sin(y * 28 - seed)
        p.z += crease * wave * edge ** 5 * abs(z) ** 1.7
        p.y += crease * .6 * math.sin(x * 42 + z * 23) * abs(y) ** 4
        p.x += crease * .5 * math.sin(y * 38 + z * 17) * abs(x) ** 4
    return o


def curve(name, points, radius, mat, closed=False):
    c = bpy.data.curves.new(name, 'CURVE')
    c.dimensions, c.resolution_u = '3D', 2
    c.bevel_depth, c.bevel_resolution = radius, 2
    s = c.splines.new('POLY')
    s.points.add(len(points) - 1)
    for p, co in zip(s.points, points):
        p.co = (*co, 1)
    s.use_cyclic_u = closed
    o = bpy.data.objects.new(name, c)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    return o


def seam(name, cx, cy, z, w, d, r, mat):
    pts = []
    corners = [(cx + w/2-r, cy+d/2-r, 0), (cx-w/2+r, cy+d/2-r, 90), (cx-w/2+r, cy-d/2+r, 180), (cx+w/2-r, cy-d/2+r, 270)]
    for x, y, start in corners:
        for i in range(12):
            a = math.radians(start + i / 11 * 90)
            pts.append((x + r * math.cos(a), y + r * math.sin(a), z))
    return curve(name, pts, .0014, mat, True)


def cylinder(name, loc, radius, depth, mat, vertices=96, bevel=.007):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=loc)
    o = bpy.context.object
    o.name = name
    o.data.materials.append(mat)
    if bevel:
        m = o.modifiers.new('Edge radius', 'BEVEL')
        m.width, m.segments = bevel, 3
    for p in o.data.polygons:
        p.use_smooth = True
    o.modifiers.new('Weighted normals', 'WEIGHTED_NORMAL')
    return o


def lathe(name, profile, mat, segments=96):
    vs, fs = [], []
    for r, z in profile:
        for j in range(segments):
            a = j / segments * math.tau
            vs.append((r * math.cos(a), r * math.sin(a), z))
    for i in range(len(profile) - 1):
        for j in range(segments):
            k, n = i * segments + j, i * segments + (j + 1) % segments
            fs.append((k, n, n + segments, k + segments))
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata(vs, [], fs)
    mesh.update()
    o = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(mat)
    for p in mesh.polygons:
        p.use_smooth = True
    return o


def rod(name, a, b, r, mat):
    a, b = Vector(a), Vector(b)
    o = cylinder(name, (a + b) / 2, r, (b - a).length, mat, 32, .001)
    o.rotation_euler = (b - a).to_track_quat('Z', 'Y').to_euler()
    return o


def group_since(before, name):
    objects = [o for o in bpy.context.scene.objects if o not in before]
    root = bpy.data.objects.new(name, None)
    bpy.context.collection.objects.link(root)
    for o in objects:
        o.parent = root
    return root


def arc(size='generous', color='#c3b7a5', kind='linen'):
    before = set(bpy.context.scene.objects)
    w = {'compact': 2.24, 'generous': 2.84, 'chaise': 3.04}[size]
    mat = fabric('Upholstery', color, kind)
    seammat = material('Tailored piping', color, .86)
    walnut = wood('Walnut plinth', '#5e4937')
    box('Inset solid-walnut plinth', (0, .025, .108), (w-.28, .79, .115), walnut, .025)
    foot = material('Recessed feet', '#292722', .5)
    for x in [-w/2+.24, w/2-.24]:
        for y in [-.31, .34]:
            cylinder('Floor glides', (x, y, .022), .036, .042, foot, 32)
    cushion('Continuous upholstered deck', (0, 0, .258), (w, 1.02, .24), mat, 2, .0008)
    armw = .23
    for sign in [-1, 1]:
        cushion(('Left' if sign < 0 else 'Right') + ' arm', (sign*(w/2-armw/2), .02, .494), (armw, 1, .51), mat, sign+5, .0015)
    n = 2 if size == 'compact' else 3
    iw = w - 2 * armw - .032
    sw = iw / n
    for i in range(n):
        x = -iw/2 + sw*(i+.5)
        d = 1.4 if size == 'chaise' and i == n-1 else .77
        y = -.124-(d-.77)/2
        if d > 1:
            cushion('Chaise upholstered extension', (x, y-.25, .258), (sw, 1.22, .24), mat, 7, .001)
        cushion(f'Seat cushion {i+1:02}', (x, y, .434), (sw-.017, d, .22), mat, 10+i, .003)
        seam(f'Seat welt {i+1:02}', x, y, .44, sw-.027, d-.008, .08, seammat)
        back = cushion(f'Back cushion {i+1:02}', (x, .329, .613), (sw-.014, .262, .368), mat, 30+i, .0023)
        back.rotation_euler.x = math.radians(-9)
    pillow = cushion('Lumbar cushion', (-w*.30, .10, .623), (.48, .17, .32), mat, 51, .005)
    pillow.rotation_euler = (math.radians(-17), math.radians(-6), math.radians(-8))
    root = group_since(before, 'Arc — ' + size)
    root['width_cm'] = int(w*100)
    root['height_cm'] = 83
    root['depth_cm'] = 182 if size == 'chaise' else 103
    return root


def vale():
    before = set(bpy.context.scene.objects)
    m, w = fabric('Soft boucle', '#c9c0ae', 'boucle'), wood('Smoked oak', '#66533e')
    box('Solid oak sled', (0, 0, .12), (.77, .72, .13), w, .055)
    cushion('Deep lounge seat', (0, -.045, .34), (.83, .78, .26), m, 3, .004)
    cushion('Left curved bolster', (-.35, .04, .53), (.23, .80, .53), m, 4, .004)
    cushion('Right curved bolster', (.35, .04, .53), (.23, .80, .53), m, 5, .004)
    o = cushion('Relaxed back', (0, .32, .60), (.80, .25, .57), m, 6, .004)
    o.rotation_euler.x = -.13
    return group_since(before, 'Vale lounge chair')


def miro():
    before = set(bpy.context.scene.objects)
    w, f = wood('Dark oak', '#534939'), fabric('Flax linen', '#c0b59f')
    for x in [-.22, .22]:
        for y in [-.22, .22]:
            rod('Tapered oak leg', (x*1.18, y*1.12, .015), (x, y, .43), .028, w)
    box('Seat frame', (0, 0, .44), (.54, .5, .06), w, .04)
    cushion('Upholstered seat', (0, -.015, .487), (.50, .46, .08), f, 5, .001)
    for x in [-.22, .22]:
        rod('Back stanchion', (x, .19, .42), (x, .26, .8), .024, w)
    o = box('Curved oak back', (0, .25, .76), (.54, .10, .17), w, .047, 1)
    o.rotation_euler.x = -.16
    return group_since(before, 'Miro dining chair')


def monolith():
    before = set(bpy.context.scene.objects)
    m = stone()
    box('Honed oval top', (0, 0, .345), (1.16, .76, .095), m, .12, 1)
    for x in [-.29, .29]:
        box('Monolithic pedestal', (x, 0, .155), (.25, .45, .31), m, .06)
    return group_since(before, 'Monolith coffee table')


def trestle():
    before = set(bpy.context.scene.objects)
    w = wood('Natural oak', '#a48863')
    box('Soft-edged oak top', (0, 0, .74), (2.10, .95, .08), w, .065)
    for x in [-.65, .65]:
        box('Sculpted trestle', (x, 0, .36), (.16, .7, .69), w, .062)
    box('Oak stretcher', (0, 0, .27), (1.35, .1, .10), w, .025)
    return group_since(before, 'Trestle dining table')


def silo():
    before = set(bpy.context.scene.objects)
    w = wood('Walnut', '#6d513b')
    cylinder('Reeded cylinder', (0, 0, .21), .216, .42, w)
    for i in range(48):
        a = i/48*math.tau
        cylinder('Vertical walnut reed', (.214*math.cos(a), .214*math.sin(a), .21), .010, .385, w, 12, .003)
    cylinder('Solid walnut top', (0, 0, .45), .285, .065, w)
    return group_since(before, 'Silo side table')


def line():
    before = set(bpy.context.scene.objects)
    w = wood('Oiled oak', '#8c7555')
    box('Console top', (0, 0, .76), (1.5, .38, .065), w, .035)
    for x in [-.57, .57]:
        box('Rounded console leg', (x, 0, .37), (.11, .30, .74), w, .045)
    box('Lower shelf', (0, 0, .22), (1.23, .32, .045), w, .025)
    return group_since(before, 'Line console')


def lumen():
    before = set(bpy.context.scene.objects)
    m, s = material('Brushed bronze', '#77634a', .32, .8), fabric('Linen shade', '#eee4d1')
    cylinder('Weighted bronze base', (0, 0, .028), .21, .052, m)
    cylinder('Bronze stem', (0, 0, .75), .016, 1.43, m)
    lathe('Pleated linen shade', [(.37, 1.23), (.365, 1.235), (.165, 1.68), (.158, 1.68), (.357, 1.235)], s, 128)
    for i in range(80):
        a = i/80*math.tau
        rod('Shade pleat', (.367*math.cos(a), .367*math.sin(a), 1.23), (.165*math.cos(a), .165*math.sin(a), 1.68), .0016, s)
    cylinder('Shade finial', (0, 0, 1.694), .023, .025, m)
    return group_since(before, 'Lumen floor lamp')


def halo():
    before = set(bpy.context.scene.objects)
    paper, wire = fabric('Washi paper', '#e9deca'), material('Dark cord', '#3d372e', .65)
    profile = []
    for i in range(65):
        a = .13+(math.pi-.26)*i/64
        profile.append((.4*math.sin(a)*(1+.008*math.cos(a*70)), .43+.24*math.cos(a)))
    lathe('Washi elliptical lantern', profile, paper, 128)
    cylinder('Braided suspension cord', (0, 0, .93), .0035, .66, wire, 16, .001)
    for i in range(24):
        a = .2+(math.pi-.4)*i/23
        r, z = .401*math.sin(a), .43+.241*math.cos(a)
        curve('Paper rib', [(r*math.cos(j/128*math.tau), r*math.sin(j/128*math.tau), z) for j in range(128)], .0015, paper, True)
    return group_since(before, 'Halo pendant')


def pebble():
    before = set(bpy.context.scene.objects)
    m = material('Glazed mushroom ceramic', '#b1a087', .22)
    lathe('Rounded ceramic base', [(0, 0), (.13, 0), (.15, .025), (.11, .08), (.07, .20), (.07, .27)], m)
    lathe('Mushroom dome', [(.26, .21), (.27, .22), (.27, .235), (.25, .29), (.20, .345), (.1, .38), (0, .385)], m)
    return group_since(before, 'Pebble table lamp')


def ottoman():
    before = set(bpy.context.scene.objects)
    f, w = fabric('Upholstery', '#b7b29e', 'boucle'), wood('Walnut', '#654938')
    box('Inset oak plinth', (0, 0, .07), (.67, .62, .11), w, .04)
    cushion('Upholstered ottoman', (0, 0, .25), (.88, .82, .35), f, 51, .002)
    seam('Tailored ottoman seam', 0, 0, .35, .876, .816, .08, f)
    return group_since(before, 'Arc ottoman')


def samples():
    before = set(bpy.context.scene.objects)
    paper = material('Sample folio', '#d9d0bf', .9)
    box('Paper folio', (0, .04, .026), (.43, .34, .05), paper, .008)
    for i, c in enumerate(['#bdb29e', '#a2836c', '#6c7159', '#4c4b47']):
        o = cushion('Tactile fabric swatch', (-.12+i*.074, -.015-i*.012, .061+i*.01), (.15, .21, .009), fabric('Swatch '+str(i), c, 'boucle' if i % 2 else 'linen'), i, 0)
        o.rotation_euler.z = math.radians(16-i*10)
    return group_since(before, 'Material library')


PRODUCTS = [('arc-modular-sofa', lambda: arc()), ('vale-lounge-chair', vale), ('miro-dining-chair', miro), ('monolith-coffee-table', monolith), ('trestle-dining-table', trestle), ('silo-side-table', silo), ('line-console', line), ('lumen-floor-lamp', lumen), ('halo-pendant', halo), ('pebble-table-lamp', pebble), ('arc-ottoman', ottoman), ('material-library', samples)]


def light(name, loc, energy, size, color=(1, .91, .78), target=(0, 0, .5)):
    bpy.ops.object.light_add(type='AREA', location=loc)
    o = bpy.context.object
    o.name = name
    o.data.energy, o.data.shape, o.data.size, o.data.color = energy, 'DISK', size, color
    o.rotation_euler = (Vector(target)-o.location).to_track_quat('-Z', 'Y').to_euler()
    return o


def camera(loc, target, lens=52, ortho=None):
    bpy.ops.object.camera_add(location=loc)
    o = bpy.context.object
    o.name = 'Photographic camera'
    o.rotation_euler = (Vector(target)-o.location).to_track_quat('-Z', 'Y').to_euler()
    o.data.lens, o.data.clip_end = lens, 200
    if ortho:
        o.data.type, o.data.ortho_scale = 'ORTHO', ortho
    bpy.context.scene.camera = o
    return o


def studio(root):
    box('Infinite warm backdrop', (0, 0, -.11), (200, 200, .20), plaster('#e3ddd1'), 0)
    light('Large north-facing softbox', (-3, -4, 6), 680, 5, (1, .95, .87))
    light('White bounce card', (4, 1, 4), 220, 3, (.91, .95, 1))
    light('Rim window', (-2, 4, 4), 350, 3, (1, .90, .74))
    bpy.context.view_layer.update()
    objects = [o for o in [root] + list(root.children_recursive) if o.type == 'MESH']
    corners = [o.matrix_world @ Vector(p) for o in objects for p in o.bound_box]
    width = max(v.x for v in corners)-min(v.x for v in corners)
    maxz, minz = max(v.z for v in corners), min(v.z for v in corners)
    camera((4, -6, 3.1), (0, 0, maxz*.45), ortho=max(width*1.43, (maxz-minz)*1.60, 1))


def render(name, w=1200, h=1400):
    s = bpy.context.scene
    s.render.resolution_x, s.render.resolution_y = w, h
    s.render.filepath = str(OUT / (name+'.png'))
    bpy.ops.render.render(write_still=True)
    print('FORME_RENDERED '+name, flush=True)


def room_setup():
    wall, floor = plaster('#d4cdbc'), plaster('#bcb4a2')
    box('Limestone floor', (0, 0, -.12), (18, 18, .2), floor, 0)
    grout = material('Stone joints', '#a49b88', .99)
    for x in range(-6, 9):
        box('Floor joint', (x*1.1, 0, -.016), (.003, 16, .002), grout, 0)
    for y in range(-7, 7):
        box('Floor joint', (0, y*1.5, -.016), (16, .003, .002), grout, 0)
    box('Back limewashed wall', (0, 3.6, 2.2), (15, .25, 4.6), wall, .015)
    box('Left wall upper', (-4.8, .5, 3.95), (.25, 6.5, 1), wall, .008)
    box('Left wall lower', (-4.8, .5, .3), (.25, 6.5, .62), wall, .008)
    for y in [-2.4, 0, 2.4]:
        box('Window pier', (-4.8, y, 2.1), (.25, .18, 3.3), wall, .01)
    box('Niche interior', (2.55, 3.44, 1.5), (1.08, .1, 2.25), plaster('#b2a68e'), .15)
    box('Niche shelf', (2.55, 3.3, .78), (1.04, .4, .055), wall, .014)
    curtainmat = fabric('Curtain linen', '#e8dfca')
    curtainmat.node_tree.nodes.get('Principled BSDF').inputs['Transmission Weight'].default_value = .17
    vs, fs = [], []
    nx, nz = 96, 10
    for j in range(nz+1):
        for i in range(nx+1):
            vs.append((-4.45+.075*math.sin(i/nx*math.tau*14), -1.9+3.8*i/nx, .13+3.65*j/nz))
    for j in range(nz):
        for i in range(nx):
            a = j*(nx+1)+i
            fs.append((a, a+1, a+nx+2, a+nx+1))
    mesh = bpy.data.meshes.new('Soft curtain folds')
    mesh.from_pydata(vs, [], fs)
    mesh.update()
    o = bpy.data.objects.new('Floor-length linen curtain', mesh)
    bpy.context.collection.objects.link(o)
    o.data.materials.append(curtainmat)
    for p in mesh.polygons:
        p.use_smooth = True
    bpy.ops.object.light_add(type='SUN', location=(-5, -3, 5))
    sun = bpy.context.object
    sun.name = 'Late afternoon sun'
    sun.data.energy, sun.data.angle = 2.1, .12
    sun.rotation_euler = (math.radians(38), math.radians(-28), math.radians(-38))
    sun.data.color = (1, .89, .71)
    light('Window skylight', (-4, -1, 3), 600, 4, (.86, .91, 1), target=(0, 1, 1))
    light('Subtle photographic bounce', (3, -4, 5), 130, 4, (1, .93, .82))
    box('Wool rug', (.35, -.35, .011), (4.35, 3.1, .024), fabric('Handwoven rug', '#b9b29e'), .032)


def vase(loc=(2.55, 3.22, .81)):
    m = material('Hand-thrown ceramic', '#817762', .87)
    o = lathe('Hand-thrown vessel', [(.055, 0), (.09, .015), (.105, .16), (.075, .255), (.063, .28), (.056, .28), (.068, .255), (.094, .16)], m)
    o.location = loc
    stem, leaf = material('Olive branch', '#534d38', .86), material('Olive foliage', '#64694b', .74)
    for k in range(5):
        rng = random.Random(k+29)
        a = Vector((loc[0], loc[1], loc[2]+.20))
        b = a+Vector((rng.uniform(-.36, .36), rng.uniform(-.17, .17), rng.uniform(.5, .8)))
        rod('Olive branch', a, b, .003, stem)
        for j in range(8):
            p = a.lerp(b, .25+j*.09)
            for side in [-1, 1]:
                bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=1, location=p+Vector((side*.031, .013, .01)))
                o = bpy.context.object
                o.name = 'Olive leaf'
                o.scale = (.014, .045, .003)
                o.rotation_euler = (.3, side*.5, side*.8+k)
                o.data.materials.append(leaf)


def editorial(name='editorial-room'):
    reset()
    room_setup()
    root = arc()
    root.location = (.5, .85, 0)
    table = monolith()
    table.location, table.rotation_euler.z = (.25, -.55, 0), .06
    lamp = lumen()
    lamp.location = (2.3, 1.18, 0)
    chair = vale()
    chair.location, chair.rotation_euler.z = (-2, -.05, 0), -.35
    side = silo()
    side.location = (-2.45, 1.05, 0)
    vase()
    vase((-2.45, 1.05, .49))
    book, cover = material('Warm paper', '#d1c5aa', .9), material('Book cover', '#6b6253', .65)
    box('Open architecture volume', (.15, -.63, .410), (.32, .25, .03), book, .003)
    box('Linen book cover', (.15, -.63, .391), (.33, .26, .006), cover, .002)
    cup = material('Ceramic cup', '#615744', .32)
    o = lathe('Coffee cup', [(.035, 0), (.044, .015), (.045, .07), (.039, .07), (.037, .015)], cup)
    o.location = (.53, -.68, .40)
    if name == 'hero-room':
        camera((5.4, -8.9, 3.30), (-.70, .60, 1.05), lens=43)
        render(name, 2000, 1250)
    else:
        camera((5.5, -8, 3), (.05, .55, .90), lens=49)
        render(name, 1800, 1300)


def make_models():
    specs = {}
    for size in ['compact', 'generous', 'chaise']:
        reset()
        root = arc(size)
        bpy.ops.object.select_all(action='DESELECT')
        for o in [root]+list(root.children_recursive):
            o.select_set(True)
        bpy.ops.export_scene.gltf(filepath=str(OUT/f'arc-{size}.glb'), export_format='GLB', use_selection=True, export_apply=True, export_yup=True, export_materials='EXPORT', export_extras=True)
        specs[size] = {'width': root['width_cm'], 'depth': root['depth_cm'], 'height': root['height_cm'], 'file': f'arc-{size}.glb'}
        if size == 'generous':
            bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'tools'/'Arc-master.blend'))
        print('FORME_EXPORTED '+size, flush=True)
    (OUT/'arc-dimensions.json').write_text(json.dumps(specs, indent=2))


def products():
    for handle, fn in PRODUCTS:
        if ONLY and handle not in ONLY:
            continue
        reset()
        root = fn()
        studio(root)
        render(handle, 1000, 1180)
    shots = [('arc-gallery-side', '#c3b7a5', 'linen', (5, -3.7, 2)), ('arc-gallery-moss', '#757a61', 'boucle', (4, -6, 3.1)), ('arc-gallery-clay', '#a67e62', 'linen', (-4, -6, 2.6))]
    for name, color, kind, loc in shots:
        if ONLY and name not in ONLY:
            continue
        reset()
        root = arc(color=color, kind=kind)
        studio(root)
        bpy.context.scene.camera.location = loc
        bpy.context.scene.camera.rotation_euler = (Vector((0, 0, .45))-Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        render(name, 1400, 1200)


def details():
    reset()
    root = arc()
    studio(root)
    c = camera((1.55, -1.75, 1), (.88, -.02, .51), lens=76)
    c.data.dof.use_dof = True
    c.data.dof.focus_distance = (Vector((.88, -.02, .51))-c.location).length
    c.data.dof.aperture_fstop = 7.1
    render('arc-tailoring-detail', 1300, 1300)
    reset()
    o = cushion('Folded flax', (0, 0, .1), (1.7, 1.5, .2), fabric('Natural flax', '#bbae94'), 7, .004)
    studio(o)
    camera((.65, -.7, 1), (0, 0, .19), lens=65)
    render('material-linen', 900, 1050)
    reset()
    o = box('Solid oak', (0, 0, .1), (1.5, 1.5, .2), wood('Open grain oak', '#9d7c51'), .04)
    studio(o)
    camera((.4, -.6, .95), (0, 0, .17), lens=65)
    render('material-oak', 900, 1050)
    reset()
    o = monolith()
    studio(o)
    camera((.68, -.62, .75), (.05, 0, .3), lens=65)
    render('material-travertine', 900, 1050)


if args.mode in ['all', 'models']:
    make_models()
if args.mode in ['all', 'hero']:
    editorial('hero-room')
if args.mode in ['all', 'products']:
    products()
if args.mode in ['all', 'detail']:
    details()
if args.mode in ['all', 'room']:
    editorial('editorial-room')
