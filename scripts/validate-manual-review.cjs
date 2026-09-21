'use strict';

// This checks fixture integrity and exact source bytes, not editor or reader behavior.
const fs = require('node:fs');
const path = require('node:path');

const defaultFixture = path.resolve(__dirname, '../test/fixtures/manual/editor-export-demonstrator.md');
const expectedSamples = [
    [36, 'Empty code (0 lines)', 0],
    [36, 'One blank line (1 line)', 1],
    [36, 'Trailing blank line (2 lines)', 2],
    [37, 'Wrapped code (1 line)', 1],
    [39, 'Multi-page code (150 lines)', 150],
];

function validateDemonstrator(source) {
    const errors = [];
    const sections = new Map();
    let section;
    let subsection;
    let fence;
    const lines = source.replace(/\r\n?/g, '\n').split('\n');

    for (let index = 0; index < lines.length; index++) {
        const line = lines[index];
        if (fence) {
            const closing = /^ {0,3}(`{3,}|~{3,})[ \t]*$/.exec(line);
            if (closing && closing[1][0] === fence.marker[0] && closing[1].length >= fence.marker.length) {
                if (fence.subsection) fence.subsection.samples.push(fence.lines);
                fence = undefined;
            } else {
                fence.lines.push(line);
            }
            continue;
        }

        const opening = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
        if (opening && !(opening[1][0] === '`' && opening[2].includes('`'))) {
            fence = { marker: opening[1], lines: [], line: index + 1, subsection };
            if (section) section.hasContent = true;
            continue;
        }

        const heading = /^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/.exec(line);
        if (heading) {
            const level = heading[1].length;
            if (level <= 2) {
                section = undefined;
                subsection = undefined;
                const demonstrator = /^D(\d+)\b/.exec(heading[2]);
                if (level === 2 && demonstrator) {
                    const number = Number(demonstrator[1]);
                    section = { number, hasContent: false, subsections: [] };
                    if (number < 19 || number > 41) errors.push(`Line ${index + 1}: unexpected demonstrator number.`);
                    if (sections.has(number)) errors.push(`D${number}: duplicate section.`);
                    else sections.set(number, section);
                }
            } else if (level === 3 && section) {
                subsection = { title: heading[2], samples: [] };
                section.subsections.push(subsection);
            }
            continue;
        }
        if (section && line.trim() && !/^\s*<!--.*-->\s*$/.test(line)) section.hasContent = true;
    }

    if (fence) errors.push(`Line ${fence.line}: unclosed code fence.`);
    for (let number = 19; number <= 41; number++) {
        const entry = sections.get(number);
        if (!entry) errors.push(`D${number}: missing section.`);
        else if (!entry.hasContent) errors.push(`D${number}: section has no demonstrator content.`);
    }
    for (const [number, title, expected] of expectedSamples) {
        const entry = sections.get(number);
        if (!entry) continue;
        const candidates = entry.subsections.filter(item => item.title === title);
        if (candidates.length !== 1) {
            errors.push(`D${number}: expected one "${title}" subsection.`);
        } else if (candidates[0].samples.length !== 1) {
            errors.push(`D${number}: "${title}" requires exactly one fenced sample.`);
        } else if (candidates[0].samples[0].length !== expected) {
            errors.push(`D${number}: "${title}" must contain ${expected} logical code lines; found ${candidates[0].samples[0].length}.`);
        }
    }
    return errors;
}

function main(args, output = console.log, errorOutput = console.error) {
    if (args.length === 1 && args[0] === '--help') {
        output('Usage: node scripts/validate-manual-review.cjs [DEMONSTRATOR.md]\n' +
            '       node scripts/validate-manual-review.cjs --compare BEFORE AFTER\n\n' +
            'Without arguments, checks test/fixtures/manual/editor-export-demonstrator.md.\n' +
            'Checks unique D19-D41 sections, nonempty content, closed fences, and the five named code-line samples.\n' +
            '--compare reads both files without changing them and compares exact bytes, including whitespace and line endings.\n' +
            'It prints no document content or supplied paths. Use copies before and after a view-only or add-then-delete test.\n' +
            'Exit codes: 0 = fixture valid or bytes unchanged; 1 = fixture invalid or bytes changed; 2 = usage/read error.\n' +
            'A successful check does not establish editor, export, accessibility, or reader acceptance.');
        return 0;
    }
    if (args[0] === '--compare' && args.length === 3) {
        try {
            const before = fs.readFileSync(args[1]);
            const after = fs.readFileSync(args[2]);
            const equal = before.equals(after);
            output(equal ? 'Source bytes unchanged.' : 'Source bytes changed. Inspect the diff locally.');
            return equal ? 0 : 1;
        } catch {
            errorOutput('Could not read both comparison files. Check the paths and read permissions.');
            return 2;
        }
    }
    if (args.length > 1 || (args.length === 1 && args[0].startsWith('--'))) {
        errorOutput('Invalid arguments. Use --help for usage.');
        return 2;
    }
    let source;
    try {
        source = fs.readFileSync(args[0] || defaultFixture, 'utf8');
    } catch {
        errorOutput('Could not read the demonstrator. Check the path and read permissions.');
        return 2;
    }
    const errors = validateDemonstrator(source);
    if (errors.length) {
        errorOutput(errors.join('\n'));
        return 1;
    }
    output('Demonstrator integrity passed: 23 sections and 5 code-line samples. Product behavior still requires manual validation.');
    return 0;
}

if (require.main === module) process.exitCode = main(process.argv.slice(2));
module.exports = { validateDemonstrator, main };
