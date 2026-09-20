'use strict';

// Shared #36/#37/#39 expectations. A closing-fence separator is not a line.
// Explicit counts deliberately do not derive from the exporter under test.
module.exports = [
    { name: 'empty', language: '', count: 0, lines: [] },
    { name: 'one-blank', language: '', count: 1, lines: [''] },
    { name: 'two-blanks', language: 'text', count: 2, lines: ['', ''] },
    { name: 'highlighted', language: 'python', count: 6, lines: [
        '', '\tmessage = "λ & <text>"  ', '', '    print(message)', '', ''] },
    { name: 'plain', language: '', count: 5, lines: ['PLAIN_FIRST\tvalue', '  spaces  ', '', 'PLAIN_LAST', ''] },
    { name: 'unknown', language: 'custom_' + 'LongName'.repeat(12), count: 2, lines: ['UNKNOWN_FIRST = 1', '\tUNKNOWN_LAST = 2'] },
    { name: 'wrapping', language: 'javascript', count: 3, lines: [
        'const WRAP_FIRST = "' + 'wrapped_word '.repeat(65) + 'WRAP_END";', '', 'const WRAP_LAST = 2;'] },
    { name: 'multi-page', language: 'python', count: 150,
        lines: Array.from({ length: 150 }, (_, i) => (i + 1) % 19 === 0 ? '' : 'print("CODE_LINE_' + String(i + 1).padStart(3, '0') + '")') }
];
