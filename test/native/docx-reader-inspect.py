#!/usr/bin/env python3
"""Check generated DOCX fixtures through headless LibreOffice, not interactive UI."""

import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import tempfile
from xml.etree import ElementTree as ET
import zipfile

W = '{http://schemas.openxmlformats.org/wordprocessingml/2006/main}'
CONFIGURATIONS = {'top-left', 'top-right', 'bottom-left', 'bottom-right', 'hidden',
                  'default-off', 'numbers-only', 'counts-only', 'editing'}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def sha256(file):
    return hashlib.sha256(file.read_bytes()).hexdigest()


def payload(node):
    if node.tag in (W + 'pPr', W + 'rPr'):
        return ''
    if node.tag == W + 't':
        return node.text or ''
    if node.tag == W + 'tab':
        return '\t'
    if node.tag == W + 'br':
        return '\n'
    return ''.join(payload(child) for child in node)


def inspect_docx(file, configuration, fixtures):
    enabled = configuration['options'].get('showCodeLineNumbers', False)
    with zipfile.ZipFile(file) as archive:
        document = ET.fromstring(archive.read('word/document.xml'))
    blocks, current, counts = [], [], []
    numbered, highlighted = 0, False
    for paragraph in document.iter(W + 'p'):
        style = paragraph.find('./' + W + 'pPr/' + W + 'pStyle')
        style = style.get(W + 'val') if style is not None else ''
        if style == 'SourceCode':
            current.append(payload(paragraph))
            numbered += paragraph.find('./' + W + 'pPr/' + W + 'numPr/' + W + 'numId') is not None
            highlighted |= any(run.get(W + 'val') == 'StringTok' for run in paragraph.iter(W + 'rStyle'))
        elif current:
            blocks.append(current)
            current = []
        if style == 'CodeLineCount':
            counts.append(payload(paragraph))
    if current:
        blocks.append(current)
    expected = [(fixture['lines'] or ['']) if enabled else ['\n'.join(fixture['lines'])]
                for fixture in fixtures]
    require(blocks == expected, file.name + ': code payloads differ from exact source lines.')
    require(numbered == (sum(fixture['count'] for fixture in fixtures) if enabled else 0),
            file.name + ': unexpected native numbered-paragraph count.')
    expected_counts = ['Lines: ' + str(fixture['count']) for fixture in fixtures]
    require(counts == (expected_counts if configuration['options'].get('showCodeLineCount', False) else []),
            file.name + ': incorrect or unexpected total metadata.')
    require(highlighted, file.name + ': expected StringTok highlighting is absent.')
    return {'exactBlocks': len(blocks), 'nativeNumberedParagraphs': numbered,
            'highlightedStringRuns': True, 'counts': counts, 'sha256': sha256(file)}


def inspect_pdf(file, configuration, fixtures, pdftotext):
    name = configuration['name']
    layout = subprocess.check_output([pdftotext, '-layout', str(file), '-'], encoding='utf-8', timeout=30)
    text_file = file.with_suffix('.txt')
    text_file.write_text(layout, encoding='utf-8')
    numbers = [int(match.group(1)) for match in re.finditer(r'^\s*(\d+)(?:\s|$)', layout, re.M)]
    expected = ([number for fixture in fixtures for number in range(1, fixture['count'] + 1)]
                if configuration['options'].get('showCodeLineNumbers', False) else [])
    require(numbers == expected, name + ': rendered line numbers differ from source-line sequence.')
    if name != 'editing':
        require(all(layout.count('CODE_LINE_' + str(number).zfill(3)) == 1
                    for number in range(1, 151) if number % 19),
                name + ': a multi-page code marker is missing or repeated.')
    pages = [page for page in layout.split('\f') if page.strip()]
    result = {'pages': len(pages), 'correctNumbers': len(numbers),
              'multiPageMarkers': 143 if name != 'editing' else 0,
              'sha256': sha256(file), 'layoutTextSha256': sha256(text_file)}
    if configuration['options'].get('showCodeLineCount', False) and name != 'editing':
        # Preserve this as an observation: unnumbered footer attachment has a known limitation.
        count_pages = [index for index, page in enumerate(pages) if 'Lines: 150' in page]
        code_pages = [index for index, page in enumerate(pages) if 'CODE_LINE_150' in page]
        require(len(count_pages) == len(code_pages) == 1, name + ': final code/count marker is missing or repeated.')
        result['lastCountOnLastCodePage'] = count_pages == code_pages
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--soffice', required=True, type=Path, help='LibreOffice soffice executable')
    parser.add_argument('--fixtures', required=True, type=Path, help='Generated fixture directory')
    parser.add_argument('--output', required=True, type=Path, help='New directory; existing directories are refused')
    parser.add_argument('--pdftotext', default='pdftotext', help='Poppler executable, default: pdftotext on PATH')
    args = parser.parse_args()
    soffice, inputs, output = args.soffice.resolve(), args.fixtures.resolve(), args.output.resolve()
    specification = json.loads((inputs / 'expectations.json').read_text(encoding='utf-8'))
    receipt = json.loads((inputs / 'receipt.json').read_text(encoding='utf-8'))
    configurations = receipt['configurations']
    require(len(configurations) == len(CONFIGURATIONS) and
            {item['name'] for item in configurations} == CONFIGURATIONS,
            'Expected all nine generated fixture configurations.')
    require(next(item for item in configurations if item['name'] == 'default-off')['options'] == {},
            'The default-off control must omit every option.')
    for item in receipt['files']:
        require(Path(item['name']).name == item['name'], 'Receipt names must be plain filenames.')
        require(sha256(inputs / item['name']) == item['sha256'], 'A generated input differs from its receipt.')
    version = subprocess.check_output([str(soffice), '--version'], text=True, timeout=30).strip()
    poppler = subprocess.run([args.pdftotext, '-v'], capture_output=True, text=True, check=True, timeout=30)
    output.mkdir(parents=True, exist_ok=False)
    rendered, resaved, resaved_rendered = output / 'rendered', output / 'resaved', output / 'resaved-rendered'
    rendered.mkdir()
    resaved.mkdir()
    resaved_rendered.mkdir()
    results = {}
    for configuration in configurations:
        name = configuration['name']
        fixtures = specification['editing'] if name == 'editing' else specification['fixtures']
        file = inputs / (name + '.docx')
        with tempfile.TemporaryDirectory(prefix='bm-docx-reader-') as profile:
            for source, format_name, destination in [(file, 'pdf', rendered), (file, 'docx', resaved),
                                                      (resaved / file.name, 'pdf', resaved_rendered)]:
                converted = subprocess.run([
                    str(soffice), '-env:UserInstallation=' + Path(profile).as_uri(), '--headless',
                    '--convert-to', format_name, '--outdir', str(destination), str(source)
                ], capture_output=True, text=True, timeout=90)
                require(converted.returncode == 0 and (destination / (name + '.' + format_name)).is_file(),
                        name + ': headless ' + format_name + ' conversion failed; no acceptance receipt written.')
        original = inspect_docx(file, configuration, fixtures)
        saved = inspect_docx(resaved / file.name, configuration, fixtures)
        results[name] = {
            'original': original, 'headlessResaved': saved,
            'headlessPdf': inspect_pdf(rendered / (name + '.pdf'), configuration, fixtures, args.pdftotext),
            'headlessResavedPdf': inspect_pdf(resaved_rendered / (name + '.pdf'), configuration, fixtures, args.pdftotext)
        }
        print(name + ': original and resaved headless payload/numbering checks passed; StringTok runs retained.')
    for item in receipt['files']:
        require(sha256(inputs / item['name']) == item['sha256'], 'Reader processing changed a fixture input.')
    record = {
        'mode': 'HEADLESS_ONLY', 'sourceCommit': receipt['sourceCommit'],
        'sourceTree': receipt['sourceTree'], 'sourceDirty': receipt['sourceDirty'],
        'inputHashes': {name: sha256(inputs / name) for name in
                        ['source.md', 'editing-source.md', 'expectations.json', 'receipt.json']},
        'checkerSha256': sha256(Path(__file__)),
        'reader': {'version': version, 'executableSha256': sha256(soffice)},
        'pdftotextVersion': (poppler.stderr or poppler.stdout).splitlines()[0],
        'results': results, 'interactiveAcceptance': 'UNVERIFIED: no UI opening, editing or save/reopen was exercised.'
    }
    (output / 'inspection.json').write_text(json.dumps(record, indent=2) + '\n', encoding='utf-8')
    print('HEADLESS_ONLY: all 9 configurations passed structural and rendered-number checks; interactive acceptance is unverified.')


if __name__ == '__main__':
    main()
