import re,sys
from PIL import Image
src=open('src/art/sprites.ts',encoding='utf8').read()
pal=dict(re.findall(r"^\s+(\w): '(#[0-9a-f]{6})'",open('src/art/palette.ts',encoding='utf8').read(),re.M))
def arr(name):
    m=re.search(r"const "+name+r" = \[(.*?)\n\];",src,re.S); return re.findall(r"'([^']*)'",m.group(1))
head,torso=arr('SKEL_HEAD'),arr('SKEL_TORSO')
legs0=['.....kwkkwk.....', '....kwk..kwk....', '....kbk..kbk....', '....kkk..kkk....']
rows=[list(r) for r in head+torso+legs0]
sw={7:'w',8:'m',9:'m',10:'m',11:'m',12:'m',13:'m'}
for r,c in sw.items(): rows[r][14]=c
rows[14][13]='y';rows[14][14]='M';rows[14][15]='y';rows[15][14]='N'
im=Image.new('RGBA',(16,22))
for y,r in enumerate(rows):
    for x,c in enumerate(r):
        if c!='.': im.putpixel((x,y),tuple(int(pal[c][i:i+2],16) for i in (1,3,5))+(255,))
im.resize((32,44),Image.NEAREST).save('art-work/skel-old-32x44.png')
im.resize((512,704),Image.NEAREST).save('art-work/skel-old-big.png')
