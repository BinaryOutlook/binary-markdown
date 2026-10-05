'use strict';
const fs = require('node:fs');
const { verifyGate } = require('../../scripts/ci-validation.cjs');
const { code } = require('../../scripts/ci-vsix-summary.cjs');
let failure;
try {
    verifyGate({ mode: process.env.VALIDATION_MODE, scope: process.env.SCOPE_RESULT,
        package: process.env.PACKAGE_RESULT, native: process.env.NATIVE_RESULT, browser: process.env.BROWSER_RESULT });
} catch (error) { failure = error; }
const result = failure ? 'VSIX validation did not pass. This run does not establish a validated package.'
    : process.env.VALIDATION_MODE === 'full'
        ? 'VSIX validation passed. All native platforms and browser shards passed for the shared source and candidate.'
        : 'VSIX validation passed for documentation only: documentation checks, clean packaging and unit/package checks. This is not full release validation.';
const lines = [result, '', '| Identity | Value |', '| --- | --- |', ...Object.entries({
    'Development package': process.env.PACKAGE_FILE,
    Source: process.env.SOURCE,
    'Artifact bundle': process.env.CANDIDATE,
    'VSIX SHA-256': process.env.SHA256,
}).map(([label, value]) => `| ${label} | ${code(value || 'unavailable')} |`), ''];
// The package job already verifies this URL against its exact run identity.
if (/^https:\/\/github\.com\/[^/]+\/[^/]+\/actions\/runs\/\d+\/artifacts\/\d+$/.test(process.env.ARTIFACT_URL || '')) {
    lines.push(`[Download the development package](${process.env.ARTIFACT_URL})`, '');
}
lines.push('Downloads require GitHub sign-in and expire seven days after upload. Official release eligibility is checked separately.', '');
fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, lines.join('\n'));
if (failure) throw failure;
