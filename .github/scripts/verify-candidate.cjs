'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { verifyCandidate } = require('../../scripts/release-candidate');
const candidate = verifyCandidate('dist', require('../../package.json'), process.env.VALIDATION_SOURCE);
fs.appendFileSync(process.env.GITHUB_ENV, 'EXPORT_VSIX_PATH=' + path.resolve('dist', candidate.name) + '\n');
console.log('Verified shared candidate: ' + candidate.name + ' SHA-256 ' + candidate.sha256);
