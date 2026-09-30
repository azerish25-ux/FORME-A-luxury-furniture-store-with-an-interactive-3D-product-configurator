"""FORME Atelier: original architectural set and companion furniture.

Blender 4.5+; uses the exact Arc product geometry, not a scene-only lookalike.
python tools/arc-materials.py
blender -b -t 6 --python tools/atelier-assets.py -- --mode all --samples 64
Produces hero/editorial scenes, Vale/Monolith/Lumen packshots, editable master.
"""
import argparse
import importlib.util
import math
import sys
from pathlib import Path
import bpy
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'assets'
parser = argparse.ArgumentParser()
parser.add_argument('--mode', choices=['all', 'room', 'products'], default='all')
parser.add_argument('--samples', type=int, default=64)
parser.add_argument('--width', type=int, default=1800)
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
args = parser.parse_args(argv)
saved_argv = sys.argv[:]
sys.argv = ['blender']
spec = importlib.util.spec_from_file_location('arc', ROOT / 'tools/arc-assets.py')
arc = importlib.util.module_from_spec(spec)
spec.loader.exec_module(arc)
sys.argv = saved_argv
arc.args.samples = args.samples


def mat(name, colour, rough=.7, metallic=0):
    m = arc.material(name, colour, rough)
    m.node_tree.nodes['Principled BSDF'].inputs['Metallic'].default_value = metallic
    return m


def mineral(name, colour, pores=False):
    m = mat(name, colour, .73 if pores else .92)
    nodes, links = m.node_tree.nodes, m.node_tree.links
    bs = nodes['Principled BSDF']
    tc = nodes.new('ShaderNodeTexCoord')
    mapping = nodes.new('ShaderNodeVectorMath'); mapping.operation = 'MULTIPLY'
    mapping.inputs[1].default_value = (1.8, 1.8, 28) if pores else (4, 4, 4)
    links.new(tc.outputs['Object'], mapping.inputs[0])
    noise = nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 4
    noise.inputs['Detail'].default_value = 4
    links.new(mapping.outputs[0], noise.inputs['Vector'])
    ramp = nodes.new('ShaderNodeValToRGB')
    base = arc.rgba(colour)
    ramp.color_ramp.elements[0].position = .12
    ramp.color_ramp.elements[0].color = tuple(v*(.68 if pores else .94) for v in base[:3])+(1,)
    ramp.color_ramp.elements[1].position = .88
    ramp.color_ramp.elements[1].color = tuple(min(1,v*(1.15 if pores else 1.03)) for v in base[:3])+(1,)
    links.new(noise.outputs['Fac'], ramp.inputs[0]); links.new(ramp.outputs[0], bs.inputs['Base Color'])
    bump = nodes.new('ShaderNodeBump'); bump.inputs['Strength'].default_value = .22
    bump.inputs['Distance'].default_value = .0012 if pores else .0007
    micro = nodes.new('ShaderNodeTexNoise'); micro.inputs['Scale'].default_value = 280
    links.new(tc.outputs['Object'], micro.inputs['Vector'])
    links.new(micro.outputs['Fac'], bump.inputs['Height']); links.new(bump.outputs[0], bs.inputs['Normal'])
    return m


def cube(name, pos, size, material, bevel=.01):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    o = bpy.context.object; o.name = name; o.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    o.data.materials.append(material)
    # Architectural textiles use physical-scale UVs, never one stretched tile per rug.
    uv=o.data.uv_layers.active
    if uv:
        for polygon in o.data.polygons:
            axes=(0,1) if abs(polygon.normal.z)>.5 else ((0,2) if abs(polygon.normal.y)>.5 else (1,2))
            for loop in polygon.loop_indices:
                co=o.data.vertices[o.data.loops[loop].vertex_index].co
                uv.data[loop].uv=(co[axes[0]]/.12,co[axes[1]]/.12)
    if bevel:
        m = o.modifiers.new('Crafted edge radius', 'BEVEL'); m.width = bevel; m.segments = 4
        o.modifiers.new('Weighted corner normals', 'WEIGHTED_NORMAL')
    return o


def lathe(name, profile, material, segments=128, scale=(1,1), pleats=0):
    verts, faces = [], []
    for radius,z in profile:
        for i in range(segments):
            a = math.tau*i/segments
            r = radius * (1 + (.018*math.cos(a*pleats) if pleats else 0))
            verts.append((r*math.cos(a)*scale[0],r*math.sin(a)*scale[1],z))
    for j in range(len(profile)-1):
        for i in range(segments):
            k=j*segments+i; n=j*segments+(i+1)%segments
            faces.append((k,n,n+segments,k+segments))
    return arc.mesh(name,verts,faces,material)


def rod(name, a, b, radius, material):
    a,b=Vector(a),Vector(b)
    o=lathe(name,[(0,-(b-a).length/2),(radius,-(b-a).length/2),(radius,(b-a).length/2),(0,(b-a).length/2)],material,32)
    o.location=(a+b)/2; o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler()
    return o


def group(before, name):
    objects=[o for o in bpy.context.scene.objects if o not in before]
    root=bpy.data.objects.new(name,None); bpy.context.collection.objects.link(root)
    for o in objects:o.parent=root
    return root


def vale():
    before=set(bpy.context.scene.objects)
    fabric=arc.material('Vale | boucle 120 mm', '#ffffff', fabric='boucle')
    arc.tint(fabric,'Bouclé','Oat')
    welt=mat('Vale | inset hand-finished welt','#b6aa97',.9)
    oak=arc.material('Vale | smoked oak joinery','#ffffff',.42,'walnut')
    # Upholstered horseshoe shell: a swept, variable-height section, not cuboids.
    path=[(-.345,-.33),(-.345,-.20),(-.345,-.07)]
    path +=[(.345*math.cos(math.pi-i/64*math.pi),.345*math.sin(math.pi-i/64*math.pi)) for i in range(65)]
    path +=[(.345,-.07),(.345,-.20),(.345,-.33)]
    vertices,faces,uvs=[],[],[]
    for j,(x,y) in enumerate(path):
        p0=Vector(path[max(j-1,0)]); p1=Vector(path[min(j+1,len(path)-1)])
        tangent=(p1-p0).normalized(); normal=Vector((-tangent.y,tangent.x))
        rise=.49 + .11*max(0,y/.345)
        for i in range(32):
            a=i/32*math.tau
            r=.108*math.cos(a)
            vertices.append((x+normal.x*r,y+normal.y*r,rise+.225*math.sin(a)))
    for j in range(len(path)-1):
        for i in range(32):
            ni=(i+1)%32
            faces.append((j*32+i,j*32+ni,(j+1)*32+ni,(j+1)*32+i))
            uvs.append([(j*.025/.12,i*.02/.12),(j*.025/.12,(i+1)*.02/.12),((j+1)*.025/.12,(i+1)*.02/.12),((j+1)*.025/.12,i*.02/.12)])
    faces +=[tuple(reversed(range(32))),tuple((len(path)-1)*32+i for i in range(32))]
    uvs +=[[(i/32,0) for i in range(32)],[(i/32,0) for i in range(32)]]
    arc.mesh('Vale | continuous sculpted wraparound shell',vertices,faces,fabric,uvs)
    seat,shape=arc.tailored('Vale | floating crowned seat',(0,-.06,.345),(.62,.67,.19),fabric,.07,.035)
    arc.seam(seat,shape,welt)
    cushion,shape=arc.tailored('Vale | relaxed lumbar',(0,.13,.57),(.53,.135,.30),fabric,.052,.034,True,-.15)
    arc.seam(cushion,shape,welt)
    for x in (-.285,.285):
        arc.timber('Vale | exposed sled rail',(x,-.045,.14),(.073,.66,.075),oak)
        for y in (-.25,.24):arc.timber('Vale | housed leg',(x,y,.09),(.066,.065,.18),oak)
    for y in (-.30,.25):arc.timber('Vale | transverse stretcher',(0,y,.14),(.57,.061,.071),oak)
    return group(before,'Vale / sculpted boucle and walnut')


def monolith():
    before=set(bpy.context.scene.objects)
    stone=mineral('Monolith | vein-cut travertine','#bdae93',True)
    lathe('Monolith | continuous elliptical bullnose',[(0,.305),(.91,.305),(.98,.313),(1,.329),(1,.359),(.99,.375),(.96,.387),(0,.387)],stone,192,(.58,.38))
    for x in (-.285,.285):
        o=lathe('Monolith | rounded stone pedestal',[(0,.012),(.93,.012),(1,.025),(1,.287),(.94,.307),(0,.307)],stone,96,(.138,.215));o.location.x=x
    return group(before,'Monolith / solid travertine')


def lumen():
    before=set(bpy.context.scene.objects)
    bronze=mat('Lumen | brushed bronze','#685747',.29,.78)
    shade=mineral('Lumen | folded linen','#e6d6b7')
    bs=shade.node_tree.nodes['Principled BSDF'];bs.inputs['Transmission Weight'].default_value=.08
    lathe('Lumen | weighted turned base',[(0,.006),(.195,.006),(.21,.017),(.21,.038),(.19,.055),(0,.055)],bronze)
    rod('Lumen | slender stem',(0,0,.046),(0,0,1.68),.012,bronze)
    # Real accordion surface with 96 folds, inner wall and rolled hems.
    lathe('Lumen | 96 folded linen pleats',[(.369,1.23),(.372,1.235),(.17,1.675),(.166,1.675),(.367,1.235),(.369,1.23)],shade,768,pleats=96)
    for radius,z in[(.369,1.231),(.168,1.675)]:
        lathe('Lumen | folded binding',[(radius-.001,z-.003),(radius+.002,z),(radius-.001,z+.003)],shade,192)
    lathe('Lumen | brass finial',[(0,1.68),(.018,1.68),(.018,1.699),(0,1.70)],bronze)
    return group(before,'Lumen / folded linen and bronze')


def light(name, pos, target, power, size, colour=(1,.93,.83)):
    data=bpy.data.lights.new(name,'AREA');data.energy=power;data.shape='DISK';data.size=size;data.color=colour
    o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);o.location=pos
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    return o


def camera(pos,target,lens,width,height):
    data=bpy.data.cameras.new('Atelier | architectural lens');o=bpy.data.objects.new('Atelier camera',data)
    bpy.context.collection.objects.link(o);o.location=pos;data.lens=lens;data.clip_start=.02
    o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler()
    scene=bpy.context.scene;scene.camera=o;scene.render.resolution_x=width;scene.render.resolution_y=height
    return o


def room():
    scene=arc.reset();scene.view_settings.exposure=-.10
    scene.world.node_tree.nodes['Background'].inputs[1].default_value=.18
    wall=mineral('Warm lime plaster','#bdb29e')
    floor=mineral('Honed warm limestone','#a79c87',True)
    wood=arc.material('Architectural walnut','#ffffff',.5,'walnut')
    dark=mat('Window frames | blackened bronze','#302f28',.4,.4)
    cube('Continuous limestone floor',(0,0,-.065),(16,14,.12),floor,.004)
    # Closed back wall and genuinely deep alcove, built from separate reveals.
    cube('Back limewash wall',(0,2.20,2.15),(9,.20,4.3),wall,.016)
    cube('Left return',(-3.8,0,2.15),(.2,4.4,4.3),wall,.01)
    cube('Right reveal pier',(2.64,1.9,2.0),(.32,.75,4.0),wall,.014)
    cube('Right walnut plane',(3.42,2.0,2.0),(1.20,.15,4),wood,.004)
    for i in range(19):
        cube('Walnut shadow batten', (2.86+i*.061,1.88,2.0),(.032,.062,4),wood,.003)
    # Gallery relief, with visible textile-like irregularity.
    cube('Art frame',(0.05,2.065,2.19),(1.34,.06,1.47),wood,.007)
    canvas=mineral('Natural woven relief','#d5c8ae')
    cube('Relief ground',(.05,2.025,2.19),(1.27,.022,1.40),canvas,.002)
    for i in range(14):
        z=1.59+i*.087
        cube('Relief folded strip',(.05+math.sin(i*.73)*.13,1.997,z),(.83+math.sin(i*.56)*.20,.025,.055),canvas,.015)
    rug=arc.material('Handwoven rug','#ffffff',fabric='wool');arc.tint(rug,'Wool','Oat')
    cube('Woven wool rug',(-.15,-.7,.012),(4.48,3.26,.025),rug,.045)
    # Author the hero from the very same product model and material maps.
    objects,upholstery,piping,_=arc.sofa('Generous');arc.tint(upholstery,'Linen','Moss');piping.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=arc.rgba('#5a644d')
    for o in objects:o.location+=Vector((.25,.65,.0))
    arm=vale();arm.location=(-1.95,-.77,0);arm.rotation_euler.z=-.34
    coffee=monolith();coffee.location=(.32,-.77,0);coffee.rotation_euler.z=.045
    lamp=lumen();lamp.location=(2.21,.8,0)
    # Carefully scaled still-life props, with thickness and open vessel rims.
    bookmat=mat('Bookcloth | olive','#4d5241'); pages=mat('Book paper','#d5c8ac')
    book=cube('Bound volume',(.12,-.75,.411),(.34,.26,.043),bookmat,.002);book.rotation_euler.z=.08
    book=cube('Second volume',(.14,-.76,.444),(.31,.245,.028),pages,.002);book.rotation_euler.z=-.05
    clay=mineral('Hand-thrown ironstone','#5c4837')
    bowl=lathe('Open thrown bowl',[(0,0),(.08,.012),(.137,.048),(.15,.062),(.144,.068),(.129,.051),(.076,.023),(0,.019)],clay);bowl.location=(.50,-.87,.388)
    brass=mat('Bronze catchlight','#75664f',.35,.65)
    # Sun shafts and window-frame shadows come from actual occluders.
    data=bpy.data.lights.new('Late afternoon sun','SUN');data.energy=.9;data.angle=.065;data.color=(1,.87,.68)
    sun=bpy.data.objects.new('Late afternoon sun',data);bpy.context.collection.objects.link(sun)
    sun.rotation_euler=(math.radians(26),math.radians(-24),math.radians(-28))
    light('Tall window',(-3.2,-2.0,3.1),(0,.4,.65),660,2.8)
    light('Gentle room fill',(3,-4,3.4),(0,.3,.7),110,3.0,(.8,.87,1))
    for x in(-3.1,-2.45,-1.8):
        o=cube('Window vertical shadow caster',(x,-1.75,3.2),(.052,.045,1.8),dark,.001);o.visible_camera=False
    camera((3.45,-6.6,2.45),(-.10,.35,1.03),48,args.width,round(args.width*.85))
    arc.render('atelier-hero.png')
    camera((3.5,-7.4,2.65),(-.05,.20,.95),46,args.width,round(args.width*.625))
    arc.render('atelier-room.png')
    bpy.ops.file.pack_all();bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'tools/Atelier-master.blend'))


def products():
    for name,make in [('vale-lounge-chair',vale),('monolith-coffee-table',monolith),('lumen-floor-lamp',lumen)]:
        arc.reset();root=make();objects=list(root.children);arc.studio(objects,args.width)
        scene=bpy.context.scene;scene.render.resolution_y=args.width
        arc.render(name+'.png')
        # Companion glTFs are review assets; only Arc has storefront configuration.
        bpy.ops.object.select_all(action='DESELECT')
        for o in objects:o.select_set(True)
        bpy.context.view_layer.objects.active=objects[0]
        bpy.ops.export_scene.gltf(filepath=str(OUT/('atelier-'+name+'.glb')),export_format='GLB',use_selection=True,export_apply=True,export_yup=True)


if __name__=='__main__':
    if args.mode in ('all','room'):room()
    if args.mode in ('all','products'):products()
    print('ATELIER_COMPLETE',args.mode)
