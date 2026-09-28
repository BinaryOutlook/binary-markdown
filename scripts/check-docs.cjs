'use strict';

const path = require('node:path');
const { checkDocumentation } = require('./doc-checks.cjs');
const result = checkDocumentation(path.resolve(__dirname, '..'));
if (result.errors.length) {
    console.error(result.errors.join('\n'));
    process.exitCode = 1;
} else {
    console.log(`Documentation checks passed: ${result.files.length} text files, ${result.links} local links; no common private-data patterns found.`);
}
