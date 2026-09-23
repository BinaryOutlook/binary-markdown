'use strict';

// Prepare synthetic reader inputs. Successful conversion is not reader acceptance.
const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fixtures = require('../fixtures/export-code-lines.cjs');
const { convertPandoc } = require('../../out/export/pandoc');
const { discoverTool } = require('../../out/export/tools');
const { validateArtifact } = require('../../out/export/validate');

const root = path.resolve(__dirname, '../..');
const directory = path.resolve(root, process.env.DOCX_READER_OUTPUT_DIR || '.vscode-test/docx-reader-checkpoint');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const markdown = blocks => '# DOCX reader checkpoint\n\n' + blocks.map(block =>
    '## ' + block.name + '\n\n```' + block.language + '\n' +
    (block.lines.length ? block.lines.join('\n') + '\n' : '') + '```\n').join('\n') + '\nEND_MARKER\n';
const editing = [
    { name: 'Editing block', language: 'python', count: 3, lines: [
        'def greet(name):', '\tmessage = "Hello " + name  ', '    return message'] },
    { name: 'Independent block', language: 'python', count: 2, lines: ['SECOND_FIRST = 1', 'SECOND_LAST = 2'] }
];
const [first, middle, last] = editing[0].lines;
// Each operation starts from its own unchanged editing.docx copy.
const edits = [
    { name: 'replace-text', operation: 'Replace Hello with Welcome in the second paragraph.',
        paragraphs: [first, '\tmessage = "Welcome " + name  ', last] },
    { name: 'enter-within-line', operation: 'Place the caret immediately before greet in the first paragraph and press Enter.',
        paragraphs: ['def ', 'greet(name):', middle, last] },
    { name: 'enter-at-line-end', operation: 'At the end of the first paragraph, press Enter and type # INSERTED.',
        paragraphs: [first, '# INSERTED', middle, last] },
    { name: 'insert-blank', operation: 'At the start of the second paragraph, press Enter once; leave the new preceding paragraph empty.',
        paragraphs: [first, '', middle, last] },
    { name: 'enter-on-blank', operation: 'At the start of the second paragraph, press Enter. Move into the new blank paragraph, press Enter again, and type # AFTER_BLANK.',
        paragraphs: [first, '', '# AFTER_BLANK', middle, last] },
    { name: 'delete-line', operation: 'Delete the second paragraph including its paragraph mark, preserving the first and last paragraphs.',
        paragraphs: [first, last] },
    { name: 'soft-break', operation: 'Immediately before message in the last paragraph, press Shift+Enter once.',
        paragraphs: [first, middle, '    return \nmessage'] }
].map(edit => ({ ...edit, numbers: edit.paragraphs.map((_, index) => index + 1),
    unchangedSecondBlock: editing[1].lines, secondBlockNumbers: [1, 2], exportTimeCounts: [3, 2] }));

async function main() {
    const pandoc = await discoverTool('pandoc', process.env.EXPORT_PANDOC_PATH || '');
    if (!pandoc.available) { throw new Error(pandoc.error || 'Pandoc is unavailable.'); }
    await fs.mkdir(path.dirname(directory), { recursive: true });
    // Refuse reuse so a new run cannot replace reader edits or their baseline.
    await fs.mkdir(directory);
    const files = [];
    const write = async (name, bytes) => {
        await fs.writeFile(path.join(directory, name), bytes, { flag: 'wx' });
        files.push({ name, sha256: hash(bytes) });
    };
    const writeJson = (name, value) => write(name, JSON.stringify(value, null, 2) + '\n');
    await write('source.md', markdown(fixtures));
    await write('editing-source.md', markdown(editing));
    await writeJson('expectations.json', { fixtures, editing, edits });
    const configurations = ['top-left', 'top-right', 'bottom-left', 'bottom-right', 'hidden'].map(name => ({
        name, options: { showCodeLineNumbers: true, showCodeLineCount: true, showCodeLanguage: name !== 'hidden',
            codeLanguagePosition: name === 'hidden' ? 'top-left' : name }
    })).concat([
        { name: 'default-off', options: {} },
        { name: 'numbers-only', options: { showCodeLineNumbers: true, showCodeLineCount: false, showCodeLanguage: false } },
        { name: 'counts-only', options: { showCodeLineNumbers: false, showCodeLineCount: true, showCodeLanguage: false } },
        { name: 'editing', options: { showCodeLineNumbers: true, showCodeLineCount: true, codeLanguagePosition: 'top-left' } }
    ]);
    for (const configuration of configurations) {
        const source = configuration.name === 'editing' ? 'editing-source.md' : 'source.md';
        const warnings = [];
        const bytes = await convertPandoc('docx', {
            sourcePath: path.join(directory, source), markdown: await fs.readFile(path.join(directory, source), 'utf8'),
            version: 1, theme: 'github', fontSize: 16
        }, { html: '', theme: 'github', fontSize: 16, diagrams: [], warnings: [] }, pandoc.path, {
            signal: new AbortController().signal, report: () => {}, warnings,
            loadResource: async () => { throw new Error('Synthetic code fixtures have no resources.'); }
        }, configuration.options);
        validateArtifact('docx', bytes);
        await write(configuration.name + '.docx', bytes);
        configuration.source = source;
        configuration.warnings = warnings;
    }
    const git = args => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
    await writeJson('receipt.json', {
        sourceCommit: git(['rev-parse', 'HEAD']), sourceTree: git(['rev-parse', 'HEAD^{tree}']),
        sourceDirty: git(['status', '--porcelain', '--untracked-files=normal']) !== '',
        generatorSha256: hash(await fs.readFile(__filename)),
        node: process.version, pandocVersion: pandoc.version, configurations, files: [...files],
        readerAcceptance: 'Pending: generation does not open, edit, save or reopen these documents in a reader.'
    });
    console.log('Prepared 9 DOCX fixtures. Reader acceptance remains pending.');
    console.log(path.relative(root, directory));
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
