#!/usr/bin/env python3
"""PDF -> fixed-layout EPUB 3. SVG preserves vectors; PNG offers broad compatibility."""
import argparse
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4
from zipfile import ZipFile, ZIP_STORED, ZIP_DEFLATED
from xml.sax.saxutils import escape
import fitz


def convert(source, target, mode='svg', dpi=216, language='en'):
    doc = fitz.open(source)
    if doc.needs_pass:
        raise ValueError('El PDF requiere contraseña. Usa una copia desbloqueada.')
    title = doc.metadata.get('title') or Path(source).stem
    author = doc.metadata.get('author') or ''
    manifest, spine, pages = [], [], []
    target = Path(target)
    target.parent.mkdir(parents=True, exist_ok=True)
    # Exclusive output: never replace an existing book.
    with ZipFile(target, 'x', compression=ZIP_DEFLATED, compresslevel=6) as z:
        z.writestr('mimetype', 'application/epub+zip', compress_type=ZIP_STORED)
        z.writestr('META-INF/container.xml', '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>')
        for index, page in enumerate(doc):
            n = index + 1
            w, h = page.rect.width, page.rect.height
            if mode == 'svg':
                image = page.get_svg_image(text_as_path=True).encode()
                mime = 'image/svg+xml'
            else:
                pix = page.get_pixmap(matrix=fitz.Matrix(dpi / 72, dpi / 72), alpha=False)
                image = pix.tobytes('png')
                mime = 'image/png'
            z.writestr(f'EPUB/images/p{n}.{mode}', image)
            body = f'<img xmlns="http://www.w3.org/1999/xhtml" src="../images/p{n}.{mode}" alt="Page {n}" style="display:block;width:100%;height:100%"/>'
            html = f'<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xml:lang="{language}" lang="{language}"><head><title>Page {n}</title><meta name="viewport" content="width={w:.2f}, height={h:.2f}"/><style>html,body{{margin:0;padding:0;width:100%;height:100%;overflow:hidden;background:white}}</style></head><body>{body}</body></html>'
            z.writestr(f'EPUB/pages/p{n}.xhtml', html)
            manifest.extend([f'<item id="p{n}" href="pages/p{n}.xhtml" media-type="application/xhtml+xml"/>', f'<item id="i{n}" href="images/p{n}.{mode}" media-type="{mime}"/>'])
            spine.append(f'<itemref idref="p{n}"/>')
            pages.append(f'<li><a href="pages/p{n}.xhtml">Page {n}</a></li>')
            if n % 20 == 0:
                print(f'{n}/{len(doc)}', flush=True)
        toc = []
        for level, label, page_num in sorted(doc.get_toc(), key=lambda entry: entry[2]):
            if 1 <= page_num <= len(doc):
                toc.append(f'<li><a href="pages/p{page_num}.xhtml">{escape(label)}</a></li>')
        nav = f'<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="{language}" lang="{language}"><head><title>Contents</title></head><body><nav epub:type="toc" id="toc"><h1>Contents</h1><ol>{"".join(toc or pages)}</ol></nav><nav epub:type="page-list" hidden="hidden"><h2>Pages</h2><ol>{"".join(pages)}</ol></nav></body></html>'
        z.writestr('EPUB/nav.xhtml', nav)
        modified = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
        opf = f'<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="uid">urn:uuid:{uuid4()}</dc:identifier><dc:title>{escape(title)}</dc:title><dc:creator>{escape(author)}</dc:creator><dc:language>{language}</dc:language><meta property="dcterms:modified">{modified}</meta><meta property="rendition:layout">pre-paginated</meta><meta property="rendition:orientation">auto</meta><meta property="rendition:spread">none</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>{"".join(manifest)}</manifest><spine>{"".join(spine)}</spine></package>'
        z.writestr('EPUB/package.opf', opf)
    print(f'Created: {target} ({target.stat().st_size / 1024 / 1024:.1f} MB), {len(doc)} pages, {mode}')
    doc.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('pdf')
    parser.add_argument('epub')
    parser.add_argument('--mode', choices=['svg', 'png'], default='svg')
    parser.add_argument('--dpi', type=int, default=216)
    parser.add_argument('--language', default='en')
    args = parser.parse_args()
    convert(args.pdf, args.epub, args.mode, args.dpi, args.language)
