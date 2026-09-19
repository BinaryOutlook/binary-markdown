#!/usr/bin/env python3
"""Audit the probe's LibreOffice PDF and DOCX save-round-trip artifacts."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
from xml.etree import ElementTree as ET
from zipfile import ZipFile

from probe import NS, W, fixtures, payload


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('directory', type=Path)
    args = parser.parse_args()
    expected_cases = fixtures()
    expected_numbers = [n for case in expected_cases for n in range(1, len(case['lines']) + 1)]
    expected_markers = [f'CODE_LINE_{n:03d}' for n in range(1, 151) if n % 19]
    result = {}
    for mode in ('paragraph-numbering', 'table-gutter'):
        docx = args.directory / 'libreoffice-roundtrip' / f'{mode}.docx'
        with ZipFile(docx) as archive:
            document = ET.fromstring(archive.read('word/document.xml'))
        groups, current = [], []
        for child in document.find('w:body', NS):
            if child.tag == f'{{{W}}}p':
                text = payload(child)
                if text.startswith('END_'):
                    groups.append(current)
                    current = []
                else:
                    style = child.find('w:pPr/w:pStyle', NS)
                    if style is not None and style.get(f'{{{W}}}val') == 'SourceCode':
                        current.append(text)
            elif child.tag == f'{{{W}}}tbl':
                current.extend(payload(row.findall('w:tc', NS)[1]) for row in child.findall('w:tr', NS))
        assert len(groups) == len(expected_cases)
        for case, actual in zip(expected_cases, groups):
            assert actual == (case['lines'] or ['']), (mode, case['name'])
        pdf = args.directory / 'libreoffice' / f'{mode}.pdf'
        text = subprocess.check_output(['pdftotext', '-layout', str(pdf), '-'], text=True)
        numbers = [int(n) for n in re.findall(r'^\s*(\d+)(?:\s|$)', text, re.MULTILINE)]
        assert numbers == expected_numbers, mode
        assert re.findall(r'CODE_LINE_\d{3}', text) == expected_markers, mode
        info = subprocess.check_output(['pdfinfo', str(pdf)], text=True)
        result[mode] = {
            'roundtripCodeExact': True, 'verifiedBlocks': len(groups),
            'visibleNumbersInOrder': len(numbers), 'codeMarkersInOrder': len(expected_markers),
            'pdfPages': int(re.search(r'Pages:\s+(\d+)', info).group(1)),
            'docxSha256': hashlib.sha256(docx.read_bytes()).hexdigest(),
            'pdfSha256': hashlib.sha256(pdf.read_bytes()).hexdigest(),
        }
    destination = args.directory / 'reader-receipt.json'
    destination.write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps(result, indent=2))


if __name__ == '__main__':
    main()
