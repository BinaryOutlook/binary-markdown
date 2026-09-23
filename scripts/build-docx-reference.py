#!/usr/bin/env python3
"""Regenerate the checked-in DOCX reference; not needed for builds or exports.

Requires Python 3 (standard library only) and Pandoc. Initially generated using
Pandoc 3.8.3. Retains default document parts and defines code/metadata styles for both edges.
Usage: python3 scripts/build-docx-reference.py [--pandoc /path/to/pandoc]
"""
import argparse
from io import BytesIO
from pathlib import Path
import subprocess
from xml.dom import minidom
from zipfile import ZIP_DEFLATED, ZipFile, ZipInfo

WORD_NS = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main'
# Keep the formatting definition in readable source alongside the binary asset.
# Keep the footer attached to the code. Word/LibreOffice may move the block to a
# fresh page first; keepLines=0 still permits blocks longer than a page to split.
# wordWrap=off permits character-level breaking in WordprocessingML.
# Zero paragraph spacing joins the tab to the code. Its right inset is 3 pt
# (60 twips): the code's 9 pt inset minus its 6 pt paragraph-border padding.
# The inline language shape has no external wrap margins.
CODE_STYLES = f'''<w:styles xmlns:w="{WORD_NS}">
  <w:style w:type="paragraph" w:customStyle="1" w:styleId="SourceCode">
    <w:name w:val="Source Code"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="BodyText"/>
    <w:link w:val="VerbatimChar"/>
    <w:pPr>
      <w:keepNext/>
      <w:keepLines w:val="0"/>
      <w:widowControl w:val="0"/>
      <w:pBdr>
        <w:top w:val="single" w:sz="4" w:space="6" w:color="D0D7DE"/>
        <w:left w:val="single" w:sz="4" w:space="6" w:color="D0D7DE"/>
        <w:bottom w:val="single" w:sz="4" w:space="6" w:color="D0D7DE"/>
        <w:right w:val="single" w:sz="4" w:space="6" w:color="D0D7DE"/>
        <w:between w:val="single" w:sz="4" w:space="6" w:color="D0D7DE"/>
      </w:pBdr>
      <w:shd w:val="clear" w:color="auto" w:fill="F6F8FA"/>
      <w:suppressAutoHyphens/>
      <w:wordWrap w:val="off"/>
      <w:spacing w:before="140" w:after="0" w:line="240" w:lineRule="auto"/>
      <w:ind w:left="180" w:right="180"/>
    </w:pPr>
    <w:rPr><w:noProof/></w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:customStyle="1" w:styleId="CodeLanguage">
    <w:name w:val="Code Language"/>
    <w:basedOn w:val="Normal"/>
    <w:next w:val="BodyText"/>
    <w:pPr>
      <w:keepNext w:val="0"/>
      <w:keepLines/>
      <w:spacing w:before="0" w:after="180" w:line="240" w:lineRule="auto"/>
      <w:ind w:left="180" w:right="60"/>
      <w:jc w:val="right"/>
    </w:pPr>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:noProof/>
      <w:color w:val="57606A"/>
      <w:sz w:val="18"/>
      <w:szCs w:val="18"/>
    </w:rPr>
  </w:style>
  <w:style w:type="character" w:customStyle="1" w:styleId="CodeLanguageBadge">
    <w:name w:val="Code Language Badge"/>
    <w:basedOn w:val="DefaultParagraphFont"/>
    <w:rPr>
      <w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/>
      <w:i/>
      <w:iCs/>
      <w:noProof/>
      <w:color w:val="57606A"/>
      <w:sz w:val="18"/>
      <w:szCs w:val="18"/>
    </w:rPr>
  </w:style>
</w:styles>'''


# A metadata row is independent of code text. Headers keep the following code;
# footers rely on the code's keepNext. No label is duplicated across pages.
for edge, side in [('Top', 'Left'), ('Top', 'Right'), ('Bottom', 'Left')]:
    before, after = ('140', '0') if edge == 'Top' else ('0', '180')
    style = f'''<w:style w:type="paragraph" w:customStyle="1" w:styleId="CodeLanguage{edge}{side}">
      <w:name w:val="Code Language {edge} {side}"/><w:basedOn w:val="CodeLanguage"/>
      <w:pPr><w:keepNext w:val="{1 if edge == 'Top' else 0}"/>
        <w:spacing w:before="{before}" w:after="{after}" w:line="240" w:lineRule="auto"/>
        <w:ind w:left="60" w:right="60"/><w:jc w:val="{side.lower()}"/>
      </w:pPr></w:style>'''
    CODE_STYLES = CODE_STYLES.replace('</w:styles>', style + '</w:styles>')

for suffix in ['', ' Bottom Left']:
    style_id = 'CodeLanguage' + suffix.replace(' ', '') + 'WithCount'
    style = f'''<w:style w:type="paragraph" w:customStyle="1" w:styleId="{style_id}">
      <w:name w:val="Code Language{suffix} With Count"/><w:basedOn w:val="CodeLanguage{suffix.replace(' ', '')}"/>
      <w:pPr><w:keepNext/><w:spacing w:before="0" w:after="0"/></w:pPr></w:style>'''
    CODE_STYLES = CODE_STYLES.replace('</w:styles>', style + '</w:styles>')

CODE_STYLES = CODE_STYLES.replace('</w:styles>', '''<w:style w:type="paragraph" w:customStyle="1" w:styleId="CodeLineCount">
  <w:name w:val="Code Line Count"/><w:basedOn w:val="CodeLanguage"/>
  <w:pPr><w:keepNext w:val="0"/><w:jc w:val="left"/><w:ind w:left="60" w:right="60"/>
    <w:spacing w:before="0" w:after="180"/></w:pPr></w:style></w:styles>''')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pandoc', default='pandoc')
    args = parser.parse_args()
    reference = subprocess.run([args.pandoc, '--print-default-data-file=reference.docx'],
                               check=True, capture_output=True).stdout
    output = Path(__file__).resolve().parent.parent / 'media' / 'export-reference.docx'
    for top in (False, True):
        build(reference, output.with_name('export-reference-top.docx') if top else output, top)
    build(reference, output.with_name('export-reference-top-footer.docx'), True, footer=True)


def build(reference, output, top, footer=False):
    custom = minidom.parseString(CODE_STYLES)
    if top:
        code = custom.getElementsByTagNameNS(WORD_NS, 'style')[0]
        code.getElementsByTagNameNS(WORD_NS, 'keepNext')[0].setAttribute('w:val', '1' if footer else '0')
        spacing = code.getElementsByTagNameNS(WORD_NS, 'spacing')[0]
        spacing.setAttribute('w:before', '0')
        spacing.setAttribute('w:after', '0' if footer else '180')
    custom_ids = {style.getAttributeNS(WORD_NS, 'styleId') for style in custom.getElementsByTagNameNS(WORD_NS, 'style')}
    with ZipFile(BytesIO(reference)) as source, ZipFile(output, 'w') as target:
        for name in sorted(source.namelist()):
            data = source.read(name)
            if name == 'word/styles.xml':
                styles = minidom.parseString(data)
                for style in list(styles.getElementsByTagNameNS(WORD_NS, 'style')):
                    if style.getAttributeNS(WORD_NS, 'styleId') in custom_ids:
                        style.parentNode.removeChild(style)
                for style in custom.getElementsByTagNameNS(WORD_NS, 'style'):
                    styles.documentElement.appendChild(styles.importNode(style, deep=True))
                data = styles.toxml(encoding='UTF-8')
            entry = ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
            entry.compress_type = ZIP_DEFLATED
            entry.external_attr = 0o100644 << 16
            target.writestr(entry, data)
    print(f'Generated {output.name}')


if __name__ == '__main__':
    main()
