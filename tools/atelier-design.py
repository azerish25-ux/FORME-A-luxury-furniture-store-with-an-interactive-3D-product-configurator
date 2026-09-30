"""Generate editable SVG design boards and a token handoff from authored assets.
Texts and controls are SVG elements, never a screenshot of the interface. Only
furniture CGI is embedded as a raster content image. No font bytes are embedded.
"""
import base64
import html
import json
import re
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'design'; OUT.mkdir(exist_ok=True)
INK='#292d27'; STONE='#f5f2eb'; OLIVE='#384d40'; MUTED='#625f56'; LINE='#d6d2c7'
class Board:
    def __init__(self,w,h,title):
        self.w=w;self.h=h;self.parts=[f'<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img"><title>{html.escape(title)}</title><desc>Editable layout study. Furniture images are original Blender CGI. Text, surfaces and controls remain separate SVG elements. Live Liquid code is authoritative for responsive behaviour.</desc>']
        self.box(0,0,w,h,STONE)
    def box(self,x,y,w,h,fill=STONE,r=0,stroke='none'):
        self.parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}"/>')
    def text(self,x,y,value,size=16,fill=INK,serif=False,weight=400):
        family='Instrument Serif, Georgia, serif' if serif else 'DM Sans, Arial, sans-serif'
        self.parts.append(f'<text x="{x}" y="{y}" font-family="{family}" font-size="{size}" font-weight="{weight}" fill="{fill}">{html.escape(value)}</text>')
    def image(self,name,x,y,w,h,r=18):
        data=base64.b64encode((ROOT/'assets'/name).read_bytes()).decode()
        key=f'clip{len(self.parts)}'
        self.parts.append(f'<defs><clipPath id="{key}"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}"/></clipPath></defs><image x="{x}" y="{y}" width="{w}" height="{h}" preserveAspectRatio="xMidYMid slice" clip-path="url(#{key})" xlink:href="data:image/webp;base64,{data}"/>')
    def button(self,x,y,w,label,selected=True):
        self.box(x,y,w,48,OLIVE if selected else STONE,24, 'none' if selected else LINE)
        self.text(x+22,y+30,label,14,'#ffffff' if selected else INK)
    def line(self,x,y,w):self.box(x,y,w,1,LINE)
    def save(self,name):
        (OUT/name).write_text(''.join(self.parts)+'</svg>')
    def nav(self,mobile=False):
        self.box(0,0,self.w,34,OLIVE)
        self.text(22 if mobile else 56,22,'Thoughtful pieces. Made for the everyday.',11,'#ffffff')
        self.text(22 if mobile else 56,98,'FORME.',42,weight=500)
        if not mobile:
            self.text(380,91,'The collection',14);self.text(530,91,'Our materials',14);self.text(674,91,'The journal',14)
            self.button(1080,61,194,'Design your sofa  ↗',False)
            self.text(1314,91,'Bag (0)',14)
        else:self.text(305,91,'Bag (0)',14)
        self.line(0,132,self.w)

b=Board(1440,2000,'FORME / Atelier — desktop composition')
b.nav();b.text(64,229,'CONSIDERED DESIGN, EVERY DAY',12)
b.text(64,375,'Quiet forms.',98,serif=True);b.text(64,473,'Full lives.',98,serif=True)
b.text(64,540,'Sculptural furniture. Honest materials.',18,MUTED);b.text(64,571,'Pieces that settle into your life, beautifully.',18,MUTED)
b.button(64,612,226,'Explore the collection  →');b.text(315,644,'Design your Arc  ↗',14)
b.text(64,777,'Natural materials.',14,MUTED);b.text(64,800,'Room to be yourself.',14,MUTED)
b.image('atelier-hero.webp',637,174,739,668,24)
b.box(665,737,683,78,STONE,16);b.text(687,761,'IN THE ROOM',10);b.text(687,789,'Arc modular sofa',20);b.text(1053,784,'Linen / Moss · Generous  ↗',12,MUTED)
b.line(64,920,1312);b.text(64,972,'THE FORME PHILOSOPHY',11)
b.text(536,980,'Less, but more considered.',48,serif=True)
b.text(536,1023,'Materials with character. Objects that feel at home.',17,MUTED)
b.text(64,1140,'A few things to come home to.',54,serif=True)
for x,name,title,sub in [(64,'vale-lounge-chair.webp','Vale lounge chair','Sculpted bouclé / walnut'),(512,'monolith-coffee-table.webp','Monolith coffee table','Bullnose travertine'),(960,'lumen-floor-lamp.webp','Lumen floor lamp','Pleated linen / bronze')]:
    b.image(name,x,1180,416,375,20);b.text(x,1596,title,22);b.text(x,1627,sub,14,MUTED)
b.box(64,1690,1312,248,OLIVE,24);b.text(104,1750,'THE INTERACTIVE DESIGN STUDIO',11,'#dbe3d7')
b.text(104,1831,'Your space. Your sofa.',62,'#ffffff',True)
b.text(104,1875,'Three sizes. Three upholstery families. Four natural tones.',16,'#e2e6dc')
b.button(1060,1790,264,'Design your sofa  ↗',False)
b.save('atelier-home-desktop.svg')

b=Board(390,2020,'FORME / Atelier — mobile composition')
b.nav(True);b.text(22,188,'CONSIDERED DESIGN, EVERY DAY',10)
b.text(22,277,'Quiet forms.',65,serif=True);b.text(22,342,'Full lives.',65,serif=True)
b.text(22,397,'Sculptural furniture. Honest materials.',15,MUTED);b.text(22,423,'Pieces that settle into your life, beautifully.',15,MUTED)
b.button(22,460,220,'Explore the collection  →');b.text(259,491,'Design Arc ↗',13)
b.image('atelier-hero.webp',22,547,346,386,22);b.box(38,838,314,77,STONE,16);b.text(53,859,'IN THE ROOM',9);b.text(53,885,'Arc modular sofa',19);b.text(53,905,'Linen / Moss · Generous  ↗',11,MUTED)
b.line(22,987,346);b.text(22,1032,'THE FORME PHILOSOPHY',10);b.text(22,1096,'Less, but more',44,serif=True);b.text(22,1143,'considered.',44,serif=True)
b.text(22,1190,'Materials with character.',16,MUTED);b.text(22,1217,'Objects that feel at home.',16,MUTED)
b.image('vale-lounge-chair.webp',22,1270,346,343);b.text(22,1650,'Vale lounge chair',23);b.text(22,1679,'Sculpted bouclé / walnut',13,MUTED)
b.box(22,1725,346,237,OLIVE,22);b.text(44,1764,'MAKE IT YOUR OWN',10,'#e2e6dc');b.text(44,1820,'Your space.',46,'#ffffff',True);b.text(44,1868,'Your sofa.',46,'#ffffff',True);b.button(44,1895,240,'Design your sofa  ↗',False)
b.save('atelier-home-mobile.svg')

b=Board(1440,1130,'FORME / Atelier — product configuration composition')
b.nav();b.text(64,191,'Home / The collection / Arc modular sofa',12,MUTED)
b.image('arc-v2-compact-linen-oat.webp',64,231,742,544,22)
b.button(86,700,115,'Gallery');b.button(209,700,182,'Explore in 3D',False)
b.text(64,814,'Compact / Linen / Oat',14,MUTED)
for i,(name,title) in enumerate([('arc-v2-compact-linen-oat.webp','Your selection'),('arc-v2-profile.webp','Side profile'),('arc-v2-seam.webp','Tailoring'),('arc-v2-walnut.webp','Walnut frame')]):
    b.image(name,64+i*190,838,170,116,12);b.text(69+i*190,979,title,12,MUTED)
b.box(850,231,526,810,'#eeebe3',22)
b.text(882,275,'THE ARC COLLECTION',11,MUTED);b.text(882,343,'Arc modular sofa',48,serif=True);b.text(882,389,'A generous pause.',25,MUTED,True);b.text(882,440,'$3,400 CAD',26)
b.text(882,474,'A low, generous silhouette. Made for living.',14,MUTED)
for y,label,options in [(520,'01 / Size',['Compact','Generous','Chaise']),(624,'02 / Upholstery',['Linen','Bouclé','Wool'])]:
    b.text(882,y,label,13)
    for i,label in enumerate(options):b.button(882+i*150,y+18,140,label,i==0)
b.text(882,734,'03 / Colour',13)
for i,(label,c) in enumerate([('Oat','#c3b7a5'),('Moss','#757a61'),('Clay','#a67e62'),('Ink','#454844')]):
    b.box(882+i*116,754,106,70,'#e0e7dc' if i==0 else STONE,12,OLIVE if i==0 else LINE)
    b.parts.append(f'<circle cx="{935+i*116}" cy="776" r="10" fill="{c}"/>');b.text(915+i*116,811,label,12)
b.text(882,863,'224 × 103 × 83 cm',13,MUTED);b.text(1190,863,'Measurements ↗',12)
b.button(882,892,450,'Add to bag                                     →')
b.text(882,976,'Estimated dispatch: 6–8 weeks',13,MUTED);b.text(882,1006,'Order material samples        Share your design',12,MUTED)
b.text(64,1050,'Daylight / Warm light are presentation controls — never purchasable options.',16,MUTED)
b.save('atelier-product-desktop.svg')

css=(ROOT/'assets/atelier.css').read_text()
properties=dict(re.findall(r'(--md-[\w-]+)\s*:\s*([^;]+);',css))
(OUT/'atelier-tokens.json').write_text(json.dumps({'name':'FORME Atelier','source':'assets/atelier.css','cssCustomProperties':properties,'typefaces':{'brand':'Instrument Serif','plain':'DM Sans'},'fontsEmbedded':False,'figmaStatus':'Editable SVG handoff; live canvas blocked by Starter MCP quota. The Figma file created for this revision is blank.','breakpoints':[360,390,768,900,1440]},indent=2)+'\n')
print('Three semantic SVG boards and token handoff generated in design/.')
