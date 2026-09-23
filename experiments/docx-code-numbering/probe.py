#!/usr/bin/env python3
"""Isolated #38 investigation. Requires Python 3 and Pandoc; no runtime imports.

Run from the repository root. Outputs are synthetic, disposable review artifacts.
This deliberately does not modify the exporter, its settings, or reference asset.
"""
import argparse
from copy import deepcopy
import hashlib
import json
from pathlib import Path
import subprocess
from xml.etree import ElementTree as ET
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
NS = {'w': W}
ET.register_namespace('w', W)
ROOT = Path(__file__).resolve().parents[2]


def element(tag, **attrs):
    return ET.Element(f'{{{W}}}{tag}', {f'{{{W}}}{k}': str(v) for k, v in attrs.items()})


def add(parent, tag, **attrs):
    child = element(tag, **attrs)
    parent.append(child)
    return child


def fixtures():
    # Lines are explicit: the newline before a closing fence is a delimiter,
    # while an empty final entry here is an intentional blank code line.
    return [
        {'name': 'highlighted-whitespace', 'language': 'python', 'lines': [
            '', '\tmessage = "λ & <text>"  ', '', '    print(message)', '', '']},
        {'name': 'plain-whitespace', 'language': '', 'lines': [
            'PLAIN_FIRST\tvalue', '  spaces  ', '', 'PLAIN_LAST', '']},
        {'name': 'unknown-language', 'language': 'mydsl', 'lines': [
            'UNKNOWN_FIRST = 1', '\tUNKNOWN_LAST = 2']},
        {'name': 'wrapping', 'language': 'javascript', 'lines': [
            'const WRAP_FIRST = "' + 'wrapped_word ' * 65 + 'WRAP_END";',
            '', 'const WRAP_LAST = 2;']},
        {'name': 'multi-page', 'language': 'python', 'lines': [
            '' if i % 19 == 0 else f'print("CODE_LINE_{i:03d}")' for i in range(1, 151)]},
        {'name': 'single-blank-line', 'language': '', 'lines': ['']},
        {'name': 'empty-block', 'language': '', 'lines': []},
    ]


def payload(node):
    parts = []
    for run in node.iter(f'{{{W}}}r'):
        for child in run:
            if child.tag == f'{{{W}}}t':
                parts.append(child.text or '')
            elif child.tag == f'{{{W}}}tab':
                parts.append('\t')
            elif child.tag == f'{{{W}}}br':
                parts.append('\n')
    return ''.join(parts)


def split_runs(paragraph, expected):
    """Keep Pandoc's whole-block token styles; restore only omitted blank tails.

    Unsupported/mismatching writer output fails the probe, rather than silently
    rewriting code. This is intentionally narrower than a production adapter.
    """
    lines = [[]]
    for run in paragraph.findall('w:r', NS):
        props = run.find('w:rPr', NS)
        for child in run:
            if child.tag == f'{{{W}}}rPr':
                continue
            if child.tag == f'{{{W}}}br':
                lines.append([])
                continue
            assert child.tag in (f'{{{W}}}t', f'{{{W}}}tab'), child.tag
            value = '\t' if child.tag == f'{{{W}}}tab' else child.text or ''
            # Use Word's tab element, not a literal tab inside w:t.
            for index, part in enumerate(value.split('\t')):
                if index:
                    tab_run = element('r')
                    if props is not None:
                        tab_run.append(deepcopy(props))
                    add(tab_run, 'tab')
                    lines[-1].append(tab_run)
                if part:
                    text_run = element('r')
                    if props is not None:
                        text_run.append(deepcopy(props))
                    text = add(text_run, 't')
                    text.set('{http://www.w3.org/XML/1998/namespace}space', 'preserve')
                    text.text = part
                    lines[-1].append(text_run)
    if not expected and len(lines) == 1 and not lines[0]:
        return []
    actual = [''.join(payload(run) for run in line) for line in lines]
    assert actual == expected[:len(actual)], (actual, expected)
    assert all(line == '' for line in expected[len(actual):]), (actual, expected)
    return lines + [[] for _ in expected[len(actual):]]


def line_paragraph(runs, first, last, num_id=None, in_table=False):
    paragraph = element('p')
    props = add(paragraph, 'pPr')
    add(props, 'pStyle', val='SourceCode')
    add(props, 'keepNext', val='1' if last else '0')
    add(props, 'keepLines', val='0')
    add(props, 'widowControl', val='0')
    if num_id is not None:
        number = add(props, 'numPr')
        add(number, 'ilvl', val='0')
        add(number, 'numId', val=num_id)
    borders = add(props, 'pBdr')
    for edge in ('top', 'left', 'bottom', 'right'):
        add(borders, edge, val='nil' if in_table else 'single', sz='4', space='6', color='D0D7DE')
    add(borders, 'between', val='nil')
    tabs = add(props, 'tabs')
    add(tabs, 'tab', val='left', pos='720' if not in_table else '0')
    add(props, 'spacing', before='140' if first and not in_table else '0', after='0', line='240', lineRule='auto')
    add(props, 'ind', left='0' if in_table else '720', right='0' if in_table else '180', hanging='0' if in_table else '540')
    paragraph.extend(deepcopy(runs))
    return paragraph


def add_numbering(numbering, block_index):
    abstract_id = 1000 + block_index
    num_id = 2000 + block_index
    abstract = element('abstractNum', abstractNumId=abstract_id)
    add(abstract, 'multiLevelType', val='singleLevel')
    level = add(abstract, 'lvl', ilvl='0')
    add(level, 'start', val='1')
    add(level, 'numFmt', val='decimal')
    add(level, 'suff', val='tab')
    add(level, 'lvlText', val='%1')
    add(level, 'lvlJc', val='right')
    props = add(level, 'pPr')
    tabs = add(props, 'tabs')
    add(tabs, 'tab', val='num', pos='720')
    add(props, 'ind', left='720', hanging='540')
    text_props = add(level, 'rPr')
    add(text_props, 'rFonts', ascii='Consolas', hAnsi='Consolas')
    add(text_props, 'color', val='57606A')
    add(text_props, 'sz', val='18')
    # Abstract definitions must precede numbering instances in the part.
    first_num = next((i for i, child in enumerate(numbering) if child.tag == f'{{{W}}}num'), len(numbering))
    numbering.insert(first_num, abstract)
    instance = add(numbering, 'num', numId=num_id)
    add(instance, 'abstractNumId', val=abstract_id)
    override = add(instance, 'lvlOverride', ilvl='0')
    add(override, 'startOverride', val='1')
    return num_id


def table_block(lines):
    table = element('tbl')
    props = add(table, 'tblPr')
    add(props, 'tblW', type='pct', w='5000')
    borders = add(props, 'tblBorders')
    for edge in ('top', 'left', 'bottom', 'right'):
        add(borders, edge, val='single', sz='4', color='D0D7DE')
    add(props, 'shd', val='clear', fill='F6F8FA')
    add(props, 'tblLayout', type='fixed')
    add(props, 'tblDescription', val='Code with one source line per row; first column contains line numbers.')
    grid = add(table, 'tblGrid')
    for width in ('540', '8100'):
        add(grid, 'gridCol', w=width)
    for index, runs in enumerate(lines):
        row = add(table, 'tr')
        gutter = add(row, 'tc')
        add(add(gutter, 'tcPr'), 'tcW', type='dxa', w='540')
        p = add(gutter, 'p')
        pp = add(p, 'pPr')
        add(pp, 'jc', val='right')
        add(pp, 'spacing', before='0', after='0')
        add(add(p, 'r'), 't').text = str(index + 1)
        cell = add(row, 'tc')
        add(add(cell, 'tcPr'), 'tcW', type='dxa', w='8100')
        cell.append(line_paragraph(runs, index == 0, index == len(lines) - 1, in_table=True))
    return table


def write_docx(parts, destination):
    with ZipFile(destination, 'w') as archive:
        for name, data in sorted(parts.items()):
            entry = ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            archive.writestr(entry, data)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pandoc', default='pandoc')
    parser.add_argument('--out', type=Path, default=ROOT / '.vscode-test/docx-numbering')
    args = parser.parse_args()
    args.out.mkdir(parents=True, exist_ok=True)
    cases = fixtures()
    markdown = '\n'.join(f'## {case["name"]}\n\n```{case["language"]}\n' +
                         ('\n'.join(case['lines']) + '\n' if case['lines'] else '') +
                         '```\n\nEND_' + case['name'] + '\n' for case in cases)
    (args.out / 'source.md').write_text(markdown)
    reader_args = [args.pandoc, '--from=commonmark_x+tex_math_gfm-smart', '--to=json']
    ordinary = json.loads(subprocess.check_output(reader_args, input=markdown.encode()))
    ast = json.loads(subprocess.check_output(reader_args + ['--preserve-tabs'], input=markdown.encode()))
    code_blocks = [block for block in ast['blocks'] if block['t'] == 'CodeBlock']
    assert [b['c'][1] for b in code_blocks] == ['\n'.join(c['lines']) for c in cases]
    for block in code_blocks:
        block['c'][0][1].append('numberLines')
    control = args.out / 'pandoc-numberLines.docx'
    subprocess.run([args.pandoc, '--from=json', '--to=docx', '--reference-doc=' + str(ROOT / 'media/export-reference.docx'),
                    '--output=' + str(control)], input=json.dumps(ast).encode(), check=True)
    with ZipFile(control) as archive:
        parts = {name: archive.read(name) for name in archive.namelist()}
    document = ET.fromstring(parts['word/document.xml'])
    body = document.find('w:body', NS)
    originals = [p for p in body.findall('w:p', NS) if p.find('w:pPr/w:pStyle', NS) is not None and
                 p.find('w:pPr/w:pStyle', NS).get(f'{{{W}}}val') == 'SourceCode']
    assert len(originals) == len(cases)
    blocks = [split_runs(p, case['lines']) for p, case in zip(originals, cases)]
    receipt = {'pandoc': subprocess.check_output([args.pandoc, '--version'], text=True).splitlines()[0],
               'referenceSha256': hashlib.sha256((ROOT / 'media/export-reference.docx').read_bytes()).hexdigest(),
               'sourceSha256': hashlib.sha256(markdown.encode()).hexdigest(),
               'ordinaryReaderPreservesTabs': [b['c'][1] for b in ordinary['blocks'] if b['t'] == 'CodeBlock'] == [b['c'][1] for b in code_blocks],
               'preserveTabsReaderExact': True,
               'control': {'numPrCount': len(document.findall('.//w:numPr', NS)),
                           'blocks': [{'name': c['name'], 'expectedLines': len(c['lines']),
                                       'writerPayloadExact': payload(p) == '\n'.join(c['lines'])}
                                      for c, p in zip(cases, originals)]}, 'candidates': {}}
    for mode in ('paragraph-numbering', 'table-gutter'):
        candidate = ET.fromstring(parts['word/document.xml'])
        target_body = candidate.find('w:body', NS)
        numbering = ET.fromstring(parts['word/numbering.xml'])
        index = 0
        verified = []
        for child in list(target_body):
            style = child.find('w:pPr/w:pStyle', NS)
            if style is None or style.get(f'{{{W}}}val') != 'SourceCode':
                continue
            lines = blocks[index]
            position = list(target_body).index(child)
            target_body.remove(child)
            if not lines:
                replacement = [line_paragraph([], True, True)]
                reconstructed = []
            elif mode == 'paragraph-numbering':
                number_id = add_numbering(numbering, index)
                replacement = [line_paragraph(runs, j == 0, j == len(lines) - 1, number_id)
                               for j, runs in enumerate(lines)]
                reconstructed = [payload(p) for p in replacement]
            else:
                table = table_block(lines)
                replacement = [table]
                reconstructed = [payload(row.findall('w:tc', NS)[1]) for row in table.findall('w:tr', NS)]
            assert reconstructed == cases[index]['lines'], cases[index]['name']
            for offset, item in enumerate(replacement):
                target_body.insert(position + offset, item)
            verified.append({'name': cases[index]['name'], 'lineCount': len(lines), 'codeExact': True})
            index += 1
        output_parts = dict(parts)
        output_parts['word/document.xml'] = ET.tostring(candidate, encoding='utf-8', xml_declaration=True)
        output_parts['word/numbering.xml'] = ET.tostring(numbering, encoding='utf-8', xml_declaration=True)
        destination = args.out / f'{mode}.docx'
        write_docx(output_parts, destination)
        receipt['candidates'][mode] = {'sha256': hashlib.sha256(destination.read_bytes()).hexdigest(), 'blocks': verified,
                                      'nativeNumberedParagraphs': len(candidate.findall('.//w:numPr', NS)),
                                      'codeTables': len(candidate.findall('.//w:tbl', NS)),
                                      'images': len(candidate.findall('.//w:drawing', NS))}
    (args.out / 'receipt.json').write_text(json.dumps(receipt, indent=2) + '\n')
    print(json.dumps(receipt, indent=2))


if __name__ == '__main__':
    main()
