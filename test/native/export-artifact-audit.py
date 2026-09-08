#!/usr/bin/env python3
"""Audit native export receipts against frozen fixture bytes.

Requires Python, pypdf, Pillow, and Poppler's pdftotext/pdfinfo tools.
Uses only receipt-selected outputs; old collision-named files are not evidence.
JSON results describe observations, not full native-viewer acceptance.
"""
import argparse
import base64
import hashlib
import json
import re
import subprocess
import xml.etree.ElementTree as ET
import zipfile
from html.parser import HTMLParser
from io import BytesIO
from pathlib import Path

from PIL import Image
from pypdf import PdfReader


class HTMLInventory(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.text = []
        self.images = []
        self.svg_count = 0
        self.katex_count = 0
        self.scripts = 0
        self.hidden = []
        self.links = []

    def handle_starttag(self, tag, attributes):
        attrs = dict(attributes)
        if tag in ('script', 'style'):
            self.hidden.append(tag)
        if tag == 'script':
            self.scripts += 1
        if tag == 'img':
            self.images.append(attrs)
        if tag == 'svg':
            self.svg_count += 1
        if 'katex' in attrs.get('class', '').split():
            self.katex_count += 1
        if tag == 'a':
            self.links.append(attrs.get('href', ''))

    def handle_endtag(self, tag):
        if self.hidden and self.hidden[-1] == tag:
            self.hidden.pop()

    def handle_data(self, value):
        if not self.hidden:
            self.text.append(value)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def compact(text):
    return re.sub(r'\s+', '', text)


def bitmap_details(data):
    try:
        with Image.open(BytesIO(data)) as image:
            return {
                'width': image.width, 'height': image.height,
                'rgb_sha256': digest(image.convert('RGB').tobytes()),
            }
    except (OSError, ValueError):
        return None


def markers_for(source, entry):
    markers = list(entry['required_markers'])
    if source == 'w30-report.md':
        markers += [f'OBS-{i:04d}' for i in range(2, 160)]
        markers += [f'CAT-{i:03d}' for i in range(2, 96)]
    elif source == 'pagination.md':
        markers += [f'CODE-LINE-{i:03d}' for i in range(2, 160)]
        markers += [f'TABLE-ROW-{i:03d}' for i in range(2, 96)]
    return markers


def xml_text(archive, names):
    texts = []
    math = 0
    links = 0
    tables = 0
    alternatives = []
    for name in names:
        tree = ET.fromstring(archive.read(name))
        texts.extend(tree.itertext())
        for element in tree.iter():
            alternatives.extend(value for key, value in element.attrib.items() if key.rsplit('}', 1)[-1] in ('alt', 'descr'))
            local = element.tag.rsplit('}', 1)[-1]
            if local in ('oMath', 'math'):
                math += 1
            if local in ('hyperlink', 'a'):
                links += 1
            if local in ('tbl', 'table'):
                tables += 1
    return '\n'.join(texts), math, links, tables, alternatives


def inspect_pdf(path, markers, source_images):
    reader = PdfReader(path)
    # Raw reading order retains wrapped table-cell markers together; -layout
    # interleaves neighbouring cells on the same visual line.
    text = subprocess.check_output(['pdftotext', '-raw', str(path), '-'], text=True)
    page_text = text.split('\f')[:len(reader.pages)]
    marker_pages = {}
    for marker in markers:
        pages = [index + 1 for index, content in enumerate(page_text) if marker in compact(content)]
        if pages:
            marker_pages[marker] = pages
    images = []
    fonts = set()
    annotations = 0
    alternatives = []

    def read_alternatives(item):
        if hasattr(item, 'get_object'):
            item = item.get_object()
        if isinstance(item, list):
            for child in item:
                read_alternatives(child)
        elif isinstance(item, dict):
            if '/Alt' in item:
                alternatives.append(str(item['/Alt']))
            if '/K' in item:
                read_alternatives(item['/K'])

    read_alternatives(reader.trailer['/Root'].get('/StructTreeRoot'))
    for index, page in enumerate(reader.pages):
        annotations += len(page.get('/Annots', []))
        resources = page.get('/Resources', {})
        for font in resources.get('/Font', {}).values():
            fonts.add(str(font.get_object().get('/BaseFont', 'unknown')))
        for image in page.images:
            details = bitmap_details(image.data)
            if details:
                details.update({'page': index + 1, 'name': image.name})
                details['original_matches'] = [name for name, original in source_images.items() if details['rgb_sha256'] == original['rgb_sha256']]
                images.append(details)
        xobjects = resources.get('/XObject', {})

        def before(operator, operands, cm, tm):
            if operator != b'Do' or not operands or operands[0] not in xobjects:
                return
            obj = xobjects[operands[0]].get_object()
            if obj.get('/Subtype') != '/Image':
                return
            width = (cm[0] ** 2 + cm[1] ** 2) ** 0.5
            height = (cm[2] ** 2 + cm[3] ** 2) ** 0.5
            for details in images:
                if details['page'] == index + 1 and details['width'] == obj.get('/Width') and details['height'] == obj.get('/Height'):
                    details['display_points'] = [round(width, 4), round(height, 4)]
                    details['bottom_left_points'] = [round(cm[4], 4), round(cm[5], 4)]
                    details['relative_aspect_ratio_error'] = round(abs((width / height) / (details['width'] / details['height']) - 1), 6)

        page.extract_text(visitor_operand_before=before)
    return text, {
        'pages': len(reader.pages),
        'page_points': [float(reader.pages[0].mediabox.width), float(reader.pages[0].mediabox.height)],
        'metadata': {key: str(value) for key, value in reader.metadata.items()},
        'fonts': sorted(fonts),
        'annotations': annotations,
        'marker_pages': marker_pages,
        'images': images,
        'image_alternatives': alternatives,
    }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--receipts', type=Path, default=Path('.vscode-test/export-native/evidence/formats.json'))
    parser.add_argument('--fixtures', type=Path, default=Path('test/fixtures/exports'))
    parser.add_argument('--output', type=Path, default=Path('.vscode-test/export-native/evidence/artifact-audit/audit.json'))
    args = parser.parse_args()
    manifest = json.loads((args.fixtures / 'manifest.json').read_text())
    entries = {entry['path']: entry for entry in manifest['files']}
    for name, entry in entries.items():
        assert digest((args.fixtures / name).read_bytes()) == entry['sha256'], 'Frozen fixture changed: ' + name
    originals = {name: bitmap_details((args.fixtures / name).read_bytes()) for name, entry in entries.items() if entry['kind'] == 'png'}
    results = []
    for receipt in json.loads(args.receipts.read_text()):
        path = Path(receipt['outputPath'])
        source = receipt['file']
        form = receipt['format']
        data = path.read_bytes()
        markers = markers_for(source, entries[source])
        result = {
            'source': source, 'format': form, 'output': path.name,
            'source_sha256': entries[source]['sha256'],
            'workspace_source_matches_frozen': digest((path.parent / source).read_bytes()) == entries[source]['sha256'],
            'bytes': len(data), 'sha256': digest(data),
            'receipt_state': receipt['state'],
            'warning_codes': [item['code'] for item in receipt.get('warnings', [])],
        }
        if form == 'html':
            html = HTMLInventory()
            html.feed(data.decode())
            text = '\n'.join(html.text)
            media = []
            for image in html.images:
                match = re.fullmatch(r'data:([^;,]+);base64,(.*)', image.get('src', ''), re.S)
                if match:
                    raw = base64.b64decode(match[2])
                    media.append({
                        'mime': match[1], 'sha256': digest(raw), 'bitmap': bitmap_details(raw),
                        'original_matches': [name for name, entry in entries.items() if entry['kind'] != 'markdown' and digest(raw) == entry['sha256']],
                    })
            result.update({'embedded_images': media, 'svg_count': html.svg_count, 'katex_count': html.katex_count, 'active_script_elements': html.scripts, 'links': html.links, 'image_alternatives': [item.get('alt', '') for item in html.images]})
        elif form in ('docx', 'epub'):
            with zipfile.ZipFile(path) as archive:
                assert archive.testzip() is None
                names = archive.namelist()
                required = ['[Content_Types].xml', '_rels/.rels', 'word/document.xml'] if form == 'docx' else ['mimetype', 'META-INF/container.xml']
                assert all(name in names for name in required)
                content_names = [name for name in names if name in ('word/document.xml', 'word/footnotes.xml') or name.endswith('.xhtml')]
                text, math, links, tables, alternatives = xml_text(archive, content_names)
                media = []
                for name in names:
                    raw = archive.read(name)
                    matched = [source_name for source_name, entry in entries.items() if entry['kind'] != 'markdown' and digest(raw) == entry['sha256']]
                    if '/media/' in name or re.search(r'\.(?:png|svg|jpg|jpeg|gif|webp)$', name):
                        media.append({'name': name, 'bytes': len(raw), 'sha256': digest(raw), 'bitmap': bitmap_details(raw), 'original_matches': matched})
                result.update({'zip_crc': 'pass', 'entry_count': len(names), 'content_entries': content_names, 'native_math_count': math, 'link_count': links, 'table_count': tables, 'media': media, 'image_alternatives': alternatives})
                if form == 'epub':
                    container = ET.fromstring(archive.read('META-INF/container.xml'))
                    package_paths = [item.attrib['full-path'] for item in container.iter() if item.tag.rsplit('}', 1)[-1] == 'rootfile']
                    for package in package_paths:
                        ET.fromstring(archive.read(package))
                    result['package_paths'] = package_paths
                    result['mimetype'] = archive.read('mimetype').decode()
        else:
            text, pdf = inspect_pdf(path, markers, originals)
            result.update(pdf)
        flattened = compact(text)
        result['markers_checked'] = len(markers)
        result['missing_text_markers'] = [marker for marker in markers if marker not in flattened]
        alternative_text = compact(' '.join(result.get('image_alternatives', [])))
        result['markers_present_in_image_alternatives'] = [marker for marker in result['missing_text_markers'] if marker in alternative_text]
        result['literal_dollar_delimiters'] = text.count('$$')
        result['unsupported_math_source_present'] = 'BinaryMarkdownUnsupportedMacro' in text
        result['trailing_editor_directive_visible'] = bool(re.search(r'^\s*(?:IMAGE_DIR:\s*assets|FORCE_RELATIVE_PATH:\s*true)\s*$', text, re.M))
        results.append(result)
        print(source, form, 'pages=' + str(result.get('pages', '-')), 'missing=' + str(result['missing_text_markers']), 'math=' + str(result.get('native_math_count', result.get('katex_count', '-'))))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({'scope': 'Receipt-selected artifact/container audit; independent target-viewer/native UI checks remain required.', 'fixture_revision': manifest['fixture_revision'], 'results': results}, indent=2, ensure_ascii=False) + '\n')
    print('Audit saved:', args.output)


if __name__ == '__main__':
    main()
