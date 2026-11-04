"""Own synthetic documents only. Not copied into production output."""
from pathlib import Path
import os
from io import BytesIO
from reportlab.pdfgen import canvas
from reportlab.lib.utils import ImageReader
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from PIL import Image, ImageDraw, ImageFont
from pypdf import PdfReader, PdfWriter

OUT=Path(__file__).parent/'fixtures'; OUT.mkdir(exist_ok=True)
FONT=os.environ.get('TEST_FONT') or next((p for p in ['/System/Library/Fonts/Supplemental/Arial.ttf','/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf'] if Path(p).exists()),None)
if not FONT: raise RuntimeError('Instala Arial/DejaVu Sans o configura TEST_FONT con una fuente de prueba autorizada.')
pdfmetrics.registerFont(TTFont('TestUnicode',FONT))
W,H=612,792
def start(name,title='Libro de prueba propio'):
 c=canvas.Canvas(str(OUT/(name+'.pdf')),pagesize=(W,H));c.setTitle(title);c.setAuthor('Get an Epub · pruebas sintéticas');return c
def line(c,text,y=700,x=54,font='Helvetica',size=12): c.setFont(font,size);c.drawString(x,y,text)
def finish(c):c.showPage();c.save()

c=start('simple','Lectura sencilla');line(c,'Capítulo uno',size=24);line(c,'El jardín está abierto. Una historia para leer sin hacer zoom.',665);line(c,'Este párrafo conserva acentos: á é í ó ú ñ ü.',644);line(c,'Cada palabra sigue siendo texto seleccionable.',623);line(c,'• Primer elemento',580);line(c,'• Segundo elemento',560);finish(c)
c=start('columns','Dos columnas');line(c,'Capítulo de dos columnas',size=23)
for i in range(7):
 line(c,f'IZQUIERDA {i+1}: primera lectura.',650-i*22,x=48,size=10)
 line(c,f'DERECHA {i+1}: segunda lectura.',650-i*22,x=328,size=10)
finish(c)
c=start('table','Tabla regular');line(c,'Datos del jardín',size=23)
for y in [640,610,580,550]:c.line(55,y,530,y)
for x in [55,280,530]:c.line(x,550,x,640)
line(c,'Especie',620,x=65,font='Helvetica-Bold');line(c,'Cantidad',620,x=290,font='Helvetica-Bold')
line(c,'Roble',590,x=65);line(c,'12',590,x=290);line(c,'Pino',560,x=65);line(c,'24',560,x=290)
line(c,'Después de la tabla continúa el libro.',510);finish(c)
c=start('formula','Fórmula conservada');line(c,'Capítulo de física',size=23);line(c,'La relación original debe conservarse.',660);line(c,'E = mc',610,size=19);line(c,'2',619,x=116,size=11);line(c,'El texto alrededor se puede adaptar.',560);finish(c)
image=Image.new('RGB',(520,220),'white');d=ImageDraw.Draw(image);d.rectangle((30,30,490,190),outline='black',width=5);d.ellipse((75,65,175,165),outline='black',width=6);d.line((210,160,300,65,435,160),fill='black',width=5)
c=start('image','Una ilustración');line(c,'Ilustraciones del jardín',size=23);line(c,'El dibujo acompaña a este párrafo.',660);c.drawImage(ImageReader(image),70,420,width=450,height=190);line(c,'Figura 1. Formas del jardín.',397);line(c,'El relato sigue después del dibujo.',355);finish(c)
def scan_image():
 im=Image.new('RGB',(1224,1584),'white');d=ImageDraw.Draw(im);font=ImageFont.truetype(FONT,35);title=ImageFont.truetype(FONT,56)
 d.text((100,130),'Lectura escaneada',font=title,fill='black')
 for i,t in enumerate(['El libro vive en esta imagen.','Estas palabras necesitan reconocimiento local.','Un jardín tranquilo para leer en español.','Las páginas deben conservar su contenido.','Fin del texto de prueba escaneado.']):d.text((100,250+i*76),t,font=font,fill='black')
 return im
scan=scan_image();c=start('scan','Escaneo propio');c.drawImage(ImageReader(scan),0,0,width=W,height=H);finish(c)
c=start('partial-scan','Escaneo con texto parcial');c.drawImage(ImageReader(scan),0,0,width=W,height=H);line(c,'Archivo parcial',770);finish(c)
c=start('mixed','Libro mixto');line(c,'Primera página digital',size=23);line(c,'TEXTO DIGITAL NO DUPLICADO.',650);c.showPage();c.drawImage(ImageReader(scan),0,0,width=W,height=H);finish(c)
c=start('links','Notas y enlaces');c.bookmarkPage('inicio');c.addOutlineEntry('Inicio de la historia','inicio',0);line(c,'Inicio de la historia',size=24);line(c,'Referencia externa segura',650);c.linkURL('https://example.org/referencia',(50,646,240,665));line(c,'Ir a la segunda página',610);c.linkRect('Ver final','final',(50,605,250,625));line(c,'Un enlace inseguro se descarta',570);c.linkURL('javascript:alert(1)',(50,565,300,585));line(c,'1. Nota conservada como texto.',80,size=8);c.showPage();c.bookmarkPage('final');c.addOutlineEntry('Final','final',0);line(c,'Final de la historia',size=24);line(c,'La nota y la referencia no desaparecen.',650);finish(c)
c=start('unicode','Alfabetos y signos');line(c,'Capítulo Unicode',size=23);line(c,'Español: pingüino, acción, corazón. € & < >',650,font='TestUnicode');line(c,'Ελληνικά: Καλημέρα κόσμε.',620,font='TestUnicode');line(c,'Русский: Привет мир.',590,font='TestUnicode');finish(c)
c=start('long','Lectura larga')
for i in range(40):
 line(c,f'Capítulo {i+1}',size=23)
 for j in range(20):line(c,f'Página {i+1}, línea {j+1}. Una lectura continua y verificable.',650-j*23)
 c.showPage()
c.save()
c=start('too-many')
for i in range(151):line(c,f'Página {i+1}');c.showPage()
c.save()
c=start('blank');finish(c)
(OUT/'empty.pdf').write_bytes(b'')
(OUT/'damaged.pdf').write_bytes(b'%PDF-1.7\nthis is not a valid document\n%%EOF')
(OUT/'fake.pdf').write_text('not a PDF')
reader=PdfReader(OUT/'simple.pdf');w=PdfWriter();w.append(reader);w.encrypt('secret');w.write(OUT/'encrypted.pdf')
from pypdf.constants import UserAccessPermissions
w=PdfWriter();w.append(reader);w.encrypt('',owner_password='owner',permissions_flag=UserAccessPermissions.PRINT);w.write(OUT/'restricted.pdf')
c=start('rotated');c.translate(100,100);c.rotate(90);line(c,'Texto girado',200);finish(c)
print(f'{len(list(OUT.glob("*.pdf")))} documentos sintéticos creados en tests/fixtures.')
