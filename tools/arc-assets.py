"""Arc Atelier: tailored panel geometry, physical UVs and a shared render/glTF material set.
Blender 4.5+; run arc-materials.py first. All dimensions are metres.
Example: blender -b -t 8 --python tools/arc-assets.py -- --mode all --samples 64
"""
import argparse
import json
import math
import sys
from pathlib import Path
import bpy
import bmesh
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets'
SPEC = json.loads((ROOT / 'tools/arc-spec.json').read_text())
parser = argparse.ArgumentParser()
parser.add_argument('--mode', choices=['models', 'posters', 'details', 'all'], default='all')
parser.add_argument('--fabric', choices=list(SPEC['fabrics']) + ['all'], default='all')
parser.add_argument('--size', choices=list(SPEC['sizes']) + ['all'], default='all')
parser.add_argument('--samples', type=int, default=64)
parser.add_argument('--width', type=int, default=1440)
parser.add_argument('--only', default='', help='Optional exact poster key for material studies')
args = parser.parse_args(sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else [])


def rgba(hex_value):
    values = [int(hex_value.lstrip('#')[i:i+2], 16) / 255 for i in (0, 2, 4)]
    return tuple(v / 12.92 if v <= .04045 else ((v + .055) / 1.055) ** 2.4 for v in values) + (1,)


def reset():
    bpy.ops.object.select_all(action='SELECT')
    bpy.ops.object.delete(use_global=False)
    for coll in list(bpy.data.collections):
        if coll.name != 'Collection':
            bpy.data.collections.remove(coll)
    for mat in list(bpy.data.materials):
        bpy.data.materials.remove(mat)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = args.samples
    scene.cycles.use_denoising = True
    scene.cycles.adaptive_threshold = .025
    scene.cycles.max_bounces = 8
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = .18
    world = bpy.data.worlds.get('Arc studio') or bpy.data.worlds.new('Arc studio')
    scene.world = world
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs[0].default_value = (.72, .76, .80, 1)
    world.node_tree.nodes['Background'].inputs[1].default_value = .22
    return scene


def material(name, colour, roughness=.8, fabric=None):
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    bs = mat.node_tree.nodes.get('Principled BSDF')
    bs.inputs['Base Color'].default_value = rgba(colour)
    bs.inputs['Roughness'].default_value = roughness
    mat.diffuse_color = rgba(colour)
    if fabric:
        for suffix, socket in [('color', 'Base Color'), ('rough', 'Roughness')]:
            node = mat.node_tree.nodes.new('ShaderNodeTexImage')
            node.image = bpy.data.images.load(str(OUT / f'arc-{fabric}-{suffix}.png'), check_existing=True)
            if suffix != 'color':
                node.image.colorspace_settings.name = 'Non-Color'
            # glTF multiplies the image by the Principled base factor, as the viewer does.
            mat.node_tree.links.new(node.outputs['Color'], bs.inputs[socket])
        tex = mat.node_tree.nodes.new('ShaderNodeTexImage')
        tex.image = bpy.data.images.load(str(OUT / f'arc-{fabric}-normal.png'), check_existing=True)
        tex.image.colorspace_settings.name = 'Non-Color'
        normal = mat.node_tree.nodes.new('ShaderNodeNormalMap')
        normal.inputs['Strength'].default_value = .65 if fabric != 'boucle' else .9
        mat.node_tree.links.new(tex.outputs['Color'], normal.inputs['Color'])
        mat.node_tree.links.new(normal.outputs['Normal'], bs.inputs['Normal'])
        if fabric != 'walnut':
            bs.inputs['Sheen Weight'].default_value = .45
            bs.inputs['Sheen Roughness'].default_value = .7
    return mat


def tint(mat, fabric, colour):
    """Use the same base map and linear tint as MeshPhysicalMaterial in the viewer."""
    bs = mat.node_tree.nodes.get('Principled BSDF')
    base = rgba(SPEC['colours'][colour]['hex'])
    # A MULTIPLY node survives export as a baseColorFactor in supported glTF exporters.
    colour_node = next(n for n in mat.node_tree.nodes if n.type == 'TEX_IMAGE' and '-color' in n.image.name)
    mix = mat.node_tree.nodes.get('Arc tint')
    if not mix:
        mix = mat.node_tree.nodes.new('ShaderNodeMixRGB')
        mix.name = 'Arc tint'
        mix.blend_type = 'MULTIPLY'
        mix.inputs[0].default_value = 1
        mat.node_tree.links.new(colour_node.outputs['Color'], mix.inputs[1])
        mat.node_tree.links.new(mix.outputs[0], bs.inputs['Base Color'])
    mix.inputs[2].default_value = base
    for node in mat.node_tree.nodes:
        if node.type == 'TEX_IMAGE':
            suffix = node.image.name.rsplit('-', 1)[-1].split('.')[0]
            node.image = bpy.data.images.load(str(OUT / f"arc-{SPEC['fabrics'][fabric]['id']}-{suffix}.png"), check_existing=True)
            if suffix != 'color':
                node.image.colorspace_settings.name = 'Non-Color'
    bs.inputs['Sheen Weight'].default_value = SPEC['fabrics'][fabric]['sheen']
    mat.diffuse_color = base


def mesh(name, vertices, faces, mat, uv_faces=None):
    data = bpy.data.meshes.new(name)
    data.from_pydata(vertices, [], faces)
    data.update()
    obj = bpy.data.objects.new(name, data)
    bpy.context.collection.objects.link(obj)
    data.materials.append(mat)
    if uv_faces:
        uv = data.uv_layers.new(name='Physical panel UV')
        for poly, coords in zip(data.polygons, uv_faces):
            for loop, coordinate in zip(poly.loop_indices, coords):
                uv.data[loop].uv = coordinate
    bm = bmesh.new()
    bm.from_mesh(data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=.00001)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(data)
    bm.free()
    for poly in data.polygons:
        poly.use_smooth = True
    return obj


def surface(p, half, radius, crown_axis=2, crown_sign=1, crown=.02):
    q = Vector(tuple(max(-h + radius, min(h - radius, v)) for v, h in zip(p, half)))
    delta = Vector(p) - q
    if delta.length:
        q += delta.normalized() * radius
    other = [i for i in range(3) if i != crown_axis]
    a, b = (max(0, 1 - (abs(q[i]) / half[i]) ** 3) for i in other)
    facing = max(0, crown_sign * q[crown_axis] / half[crown_axis]) ** 3
    q[crown_axis] += crown_sign * crown * a * b * facing
    # Small seam-local tension; no random global displacement or inflated corners.
    edge = math.exp(-((abs(q[other[0]]) / half[other[0]] - .80) / .10) ** 2)
    q[crown_axis] += crown_sign * .0018 * math.sin(q[other[1]] * 53 + q[other[0]] * 17) * edge * facing
    return q


def tailored(name, centre, dimensions, mat, radius=.055, crown=.02, front=False, lean=0):
    half = tuple(d / 2 for d in dimensions)
    radius = min(radius, min(half) * .82)
    vertices, faces, uvs = [], [], []
    grid = 16
    axis = 1 if front else 2
    sign = -1 if front else 1
    for face_axis in range(3):
        a, b = [i for i in range(3) if i != face_axis]
        for side in (-1, 1):
            offset = len(vertices)
            for j in range(grid + 1):
                for i in range(grid + 1):
                    p = [0, 0, 0]
                    p[face_axis] = side * half[face_axis]
                    p[a] = math.sin((i / grid - .5) * math.pi) * half[a]
                    p[b] = math.sin((j / grid - .5) * math.pi) * half[b]
                    vertices.append(surface(p, half, radius, axis, sign, crown))
            for j in range(grid):
                for i in range(grid):
                    ids = [offset + j*(grid+1)+i, offset+j*(grid+1)+i+1, offset+(j+1)*(grid+1)+i+1, offset+(j+1)*(grid+1)+i]
                    faces.append(ids)
                    uvs.append([(vertices[k][a]/SPEC['tileMetres'], vertices[k][b]/SPEC['tileMetres']) for k in ids])
    obj = mesh(name, vertices, faces, mat, uvs)
    obj.location = centre
    obj.rotation_euler.x = lean
    return obj, (half, radius, axis, sign, crown)


def seam(obj, shape, mat):
    half, radius, axis, sign, crown = shape
    a, b = [i for i in range(3) if i != axis]
    points = []
    for index in range(192):
        angle = index / 192 * math.tau
        p = [0, 0, 0]
        # A seam follows the authored panel, including its edge compression.
        p[axis] = sign * half[axis]
        p[a] = (half[a] - radius*.45) * math.copysign(abs(math.cos(angle))**.22, math.cos(angle))
        p[b] = (half[b] - radius*.45) * math.copysign(abs(math.sin(angle))**.22, math.sin(angle))
        q = surface(p, half, radius, axis, sign, crown)
        q[axis] += sign * .0009
        points.append(q)
    curve = bpy.data.curves.new(obj.name + ' welt', 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = .0015
    curve.bevel_resolution = 1
    spline = curve.splines.new('POLY')
    spline.points.add(len(points)-1)
    for dest, point in zip(spline.points, points):
        dest.co = (*point, 1)
    spline.use_cyclic_u = True
    cord = bpy.data.objects.new(obj.name + ' | inset welt', curve)
    bpy.context.collection.objects.link(cord)
    cord.location = obj.location
    cord.rotation_euler = obj.rotation_euler
    curve.materials.append(mat)
    return cord


def timber(name, centre, dims, mat):
    bpy.ops.mesh.primitive_cube_add(size=1, location=centre)
    obj = bpy.context.object
    obj.name = name
    obj.dimensions = dims
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    bevel = obj.modifiers.new('Joinery edge · 3 mm', 'BEVEL')
    bevel.width = .003
    bevel.segments = 3
    obj.modifiers.new('Weighted face normals', 'WEIGHTED_NORMAL')
    obj.data.materials.append(mat)
    # Physical grain runs along the longest horizontal axis of each member.
    uv = obj.data.uv_layers.active
    for poly in obj.data.polygons:
        normal = poly.normal
        axes = (0, 1) if abs(normal.z) > .5 else ((0, 2) if abs(normal.y) > .5 else (1, 2))
        for loop in poly.loop_indices:
            v = obj.data.vertices[obj.data.loops[loop].vertex_index].co
            uv.data[loop].uv = (v[axes[0]]/.5, v[axes[1]]/.2)
    return obj


def bounds(objects):
    bpy.context.view_layer.update()
    coords = [o.matrix_world @ Vector(c) for o in objects for c in o.bound_box]
    return Vector(tuple(min(c[i] for c in coords) for i in range(3))), Vector(tuple(max(c[i] for c in coords) for i in range(3)))


def sofa(size):
    definition = SPEC['sizes'][size]
    w, depth, height = (v/100 for v in definition['dimensions'])
    count = definition['seats']
    before = set(bpy.data.objects)
    upholstery = material('Arc Upholstery | UV 120 mm', '#c3b7a5', fabric='linen')
    tint(upholstery, 'Linen', 'Oat')
    piping = material('Arc Piping', '#aa9a85', .92)
    walnut = material('Arc Walnut | longitudinal grain', '#ffffff', .45, 'walnut')
    dark = material('Recessed support · graphite', '#292922', .65)
    front = .515 - depth
    # The main frame always follows the standard seat depth. An L-shaped chaise
    # receives a separate extension; no exposed rectangular deck fills the void.
    for y in (-.415, .42):
        timber('Walnut | long rail', (0,y,.12), (w-.12,.09,.085), walnut)
    for x in (-w/2+.105,w/2-.105):
        timber('Walnut | return rail', (x,0,.12), (.09,.85,.085), walnut)
        for y in (-.365,.365):
            timber('Inset walnut foot', (x,y,.045), (.055,.08,.09), walnut)
    timber('Shadow gap below upholstery', (0,0,.17), (w-.12,.91,.035), dark)
    # The chaise has its own extended seat and supporting platform, not a scaled sofa.
    platform,_ = tailored('Upholstered support platform', (0,0,.235), (w-.08,1.00,.15), upholstery, .035, .005)
    for x in (-w/2+.115, w/2-.115):
        arm, shape = tailored('Tailored arm | left' if x<0 else 'Tailored arm | right', (x,0,.425), (.23,1.03,.51), upholstery,.082,.010)
        seam(arm,shape,piping)
    tailored('Continuous upholstered rear rail', (0,.414,.46), (w-.38,.20,.49), upholstery,.065,.008,True)
    usable = w-.47
    gap = .023
    module = (usable - gap*(count-1))/count
    back_objects=[]
    for i in range(count):
        x = -usable/2+module/2+i*(module+gap)
        is_chaise = size=='Chaise' and i==count-1
        d = depth-.25 if is_chaise else .78
        centre_y = .265 - d/2
        if is_chaise:
            tailored('Chaise | independent extended support', (x,centre_y,.235), (module,d,.15), upholstery,.035,.003)
            timber('Chaise | recessed support', (x,centre_y,.17), (module-.08,d-.07,.035), dark)
            timber('Chaise | front walnut rail', (x,front+.08,.12), (module-.06,.09,.085), walnut)
            for edge_x in (x-module/2+.045,x+module/2-.045):
                timber('Chaise | longitudinal walnut rail', (edge_x,(front-.365)/2,.12), (.06,-.365-front,.085), walnut)
                timber('Chaise | front foot', (edge_x,front+.13,.045), (.055,.08,.09), walnut)
        seat,shape=tailored(f'Seat panel {i+1} | crowned top', (x,centre_y,.36), (module,d,.205), upholstery,.072,.033)
        seam(seat,shape,piping)
        back,shape=tailored(f'Back cushion {i+1} | tensioned face', (x,.285,.625), (module+.008,.245,.388), upholstery,.074,.047,True,-.12)
        cord=seam(back,shape,piping)
        back_objects.extend([back,cord])
    # Loose lumbar cushions: independent shaped panels and inset welt, not boxes.
    # Their variation is deterministic and contained within the canonical frame bounds.
    for i, side in enumerate((-1, 1)):
        x = side * (w / 2 - .52)
        pillow, shape = tailored('Lumbar cushion | ' + ('left' if side < 0 else 'right'),
                                 (x, -.005, .602), (.48, .155, .285), upholstery,
                                 .052, .028, True, -.22)
        pillow.rotation_euler.y = side * .09
        pillow.rotation_euler.z = side * .10
        seam(pillow, shape, piping)
    # Recessed support rails retain the visible 8 mm joinery reveal.
    for x in (-w/2+.105, w/2-.105):
        timber('Walnut | recessed corner join', (x,-.416,.12), (.072,.011,.054), walnut)
    objects=list(set(bpy.data.objects)-before)
    low,high=bounds(objects)
    shift=height-high.z
    for o in back_objects:
        o.location.z+=shift
    low,high=bounds(objects)
    measured=[(high.x-low.x)*100,(high.y-low.y)*100,(high.z-low.z)*100]
    for actual,expected in zip(measured,definition['dimensions']):
        if abs(actual-expected)>.6:
            raise ValueError(f'{size}: measured {measured} differs from design {definition["dimensions"]}')
    return objects,upholstery,piping,measured


def studio(objects, width=None):
    low,high=bounds(objects)
    centre=(low+high)/2
    floor=material('Studio limestone', '#ddd7ca', .86)
    bpy.ops.mesh.primitive_plane_add(size=200, location=(0,0,-.002))
    bpy.context.object.name='Studio | ground'
    bpy.context.object.data.materials.append(floor)
    for name,pos,energy,scale,colour in [
        ('Window | large soft key',(-3.2,-4.5,5),850,3.0,(1,.93,.85)),
        ('Window | fill',(4,-1.5,3),190,3.0,(.84,.91,1)),
        ('Rear softbox',(-1,3.5,4),420,2.6,(1,.94,.85))]:
        data=bpy.data.lights.new(name,'AREA');data.energy=energy;data.shape='DISK';data.size=scale;data.color=colour
        lamp=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(lamp);lamp.location=pos
        lamp.rotation_euler=(centre-lamp.location).to_track_quat('-Z','Y').to_euler()
    camera=bpy.data.cameras.new('Arc | 65 mm product lens')
    obj=bpy.data.objects.new('Arc | product camera',camera);bpy.context.collection.objects.link(obj)
    bpy.context.scene.camera=obj;camera.lens=65;camera.clip_start=.02
    distance=max(high.x-low.x, (high.y-low.y)*1.18)*2.7
    obj.location=centre+Vector((.48,-.83,.32)).normalized()*distance
    target=Vector((centre.x,centre.y,.40))
    obj.rotation_euler=(target-obj.location).to_track_quat('-Z','Y').to_euler()
    scene=bpy.context.scene
    scene.render.resolution_x=width or args.width
    scene.render.resolution_y=round(scene.render.resolution_x*1000/1440)
    return obj


def render(filename):
    bpy.context.scene.render.filepath=str(OUT/filename)
    bpy.ops.render.render(write_still=True)


def export_models():
    measurements={}
    for size,record in SPEC['sizes'].items():
        reset();objects,mat,piping,measured=sofa(size)
        bpy.ops.object.select_all(action='DESELECT')
        for obj in objects:
            obj.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        neutral = mat.node_tree.nodes['Arc tint'].inputs[2]
        neutral.default_value = (1, 1, 1, 1)
        bpy.ops.export_scene.gltf(filepath=str(OUT/record['model']),export_format='GLB',use_selection=True,export_apply=True,export_yup=True,export_texcoords=True,export_normals=True,export_materials='EXPORT',export_image_format='AUTO')
        tint(mat, 'Linen', 'Oat')
        measurements[size]={'design_cm':record['dimensions'],'measured_cm':[round(v,3) for v in measured]}
    reset()
    for size in SPEC['sizes']:
        objects,mat,piping,_=sofa(size)
        coll=bpy.data.collections.new('Arc / '+size)
        bpy.context.scene.collection.children.link(coll)
        for obj in objects:
            for current in list(obj.users_collection): current.objects.unlink(obj)
            coll.objects.link(obj)
        coll.hide_render=size!='Generous'
        coll.hide_viewport=size!='Generous'
        if size=='Generous': hero=objects
    studio(hero)
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'tools/Arc-master.blend'))
    (OUT/'arc-dimensions.json').write_text(json.dumps({'revision':2,'units':'centimetres','sizes':measurements},indent=2)+'\n')


def posters():
    for size in SPEC['sizes']:
        if args.size!='all' and size!=args.size:
            continue
        reset();objects,mat,piping,measured=sofa(size);studio(objects)
        for fabric in SPEC['fabrics']:
            if args.fabric != 'all' and args.fabric != fabric:
                continue
            for colour,colour_record in SPEC['colours'].items():
                tint(mat,fabric,colour)
                piping.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=tuple(c*.70 for c in rgba(colour_record['hex'])[:3])+(1,)
                key='-'.join([SPEC['sizes'][size]['id'],SPEC['fabrics'][fabric]['id'],colour_record['id']])
                if not args.only or args.only == key:
                    render(f'arc-v2-{key}.png')


def details():
    reset();objects,mat,piping,_=sofa('Generous');camera=studio(objects)
    camera.location=(0,-7,2.0);target=Vector((0,0,.43));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    render('arc-v2-side.png')
    # An actual side profile, rather than a second near-identical three-quarter shot.
    camera.location=(5.3,-.18,1.65);target=Vector((0,-.12,.42));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    render('arc-v2-profile.png')
    for fabric in SPEC['fabrics']:
        tint(mat,fabric,'Oat')
        camera.data.lens=72
        camera.location=(.22,-1.10,1.05);target=Vector((.18,-.34,.445));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
        render('arc-material-'+SPEC['fabrics'][fabric]['id']+'.png')
        if fabric=='Linen':render('arc-v2-seam.png')
    camera.data.lens=78
    camera.location=(1.55,-1.02,.40);target=Vector((1.19,-.40,.13));camera.rotation_euler=(target-camera.location).to_track_quat('-Z','Y').to_euler()
    render('arc-v2-walnut.png')

if __name__ == '__main__':
    if args.mode in ('all','models'):export_models()
    if args.mode in ('all','posters'):posters()
    if args.mode in ('all','details'):details()
    print('ARC_ATELIER_COMPLETE',args.mode,args.size)
