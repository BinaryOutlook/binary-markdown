'use strict';

const assert = require('node:assert/strict');
const DAY = 24 * 60 * 60 * 1000;
const VERSION = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

function versionParts(version) {
    assert.match(version, VERSION, 'Release versions must contain three nonnegative integers');
    const parts = version.split('.').map(Number);
    assert.ok(parts.every(Number.isSafeInteger), 'Version components must be safe integers');
    return parts;
}

function compareVersions(left, right) {
    const a = versionParts(left), b = versionParts(right);
    for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return Math.sign(a[i] - b[i]);
    return 0;
}

function nextPatch(version) {
    const parts = versionParts(version);
    parts[2]++;
    assert.ok(Number.isSafeInteger(parts[2]));
    return parts.join('.');
}

// Use publication time, not GitHub's "latest" ordering or the commit date.
function latestOfficialRelease(releases) {
    return releases.filter(release => {
        const version = release.tag_name?.replace(/^v/, '');
        return !release.draft && !release.prerelease && release.tag_name === 'v' + version &&
            VERSION.test(version) && Number.isFinite(Date.parse(release.published_at)) &&
            release.assets?.some(asset => asset.name === `binary-markdown-${version}.vsix` &&
                asset.state === 'uploaded' && asset.size > 0);
    }).sort((a, b) => Date.parse(b.published_at) - Date.parse(a.published_at))[0] || null;
}

// Documentation, tests, release bookkeeping and Electron-only work do not by
// themselves justify distributing a new VSIX. Unknown runtime commit types
// remain visible in the plan and require a maintainer's version decision.
function isReleaseRelevant(file) {
    return /^(src\/|media\/|LICENSES\/|package(?:\.nls(?:\.[\w-]+)?\.json|\.json|-lock\.json)$|LICENSE$|NOTICE$|\.node-version$|\.vscodeignore$|tsconfig\.json$|build-locales\.js$|scripts\/(?:package-vsix|build-identity|bundle-mermaid|copy-vendor|copy-webview)\.(?:c?js)$)/.test(file);
}

function patchEligible(change) {
    if (/BREAKING[ -]CHANGE:/i.test(change.message)) return false;
    const lines = change.message.split('\n').filter(line => line.trim());
    const title = /^Merge pull request #\d+ /.test(lines[0]) ? lines[1] || '' : lines[0];
    if (/^[\w-]+(?:\([^)]*\))?!:/.test(title) || /^feat(?:\([^)]*\))?:/.test(title)) return false;
    return /^(?:fix|perf|revert)(?:\([^)]*\))?:\s+/.test(title) || /^chore\(deps\):\s+/.test(title);
}

function planRelease({ config, releases, version, hasNotes, changes, now = Date.now() }) {
    assert.equal(config.branch, 'main');
    assert.equal(typeof config.enabled, 'boolean');
    assert.ok(Number.isSafeInteger(config.minimumDays) && config.minimumDays >= 1);
    assert.ok(Number.isFinite(now));
    versionParts(version);
    const latest = latestOfficialRelease(releases);
    const result = { eligible: false, version, latestTag: latest?.tag_name || null,
        latestReleaseId: latest?.id || null, minimumDays: config.minimumDays };
    const stop = reason => ({ ...result, reason });
    if (!config.enabled) return stop('Automatic releases are disabled in the policy file.');
    if (!latest) return stop('Publish the first official VSIX manually to establish a release baseline.');
    result.eligibleAt = new Date(Date.parse(latest.published_at) + config.minimumDays * DAY).toISOString();
    if (now < Date.parse(result.eligibleAt)) return stop('The minimum interval has not elapsed.');
    const relevant = changes.filter(change => change.files.some(isReleaseRelevant));
    if (!relevant.length) return stop('No unreleased VSIX changes.');
    const compared = compareVersions(version, latest.tag_name.slice(1));
    if (compared < 0) return stop('The main version is older than the latest official release.');
    if (compared > 0) {
        if (!hasNotes) return stop('The selected version needs matching release notes.');
        return { ...result, eligible: true, action: 'publish', reason: 'A maintainer-selected version is ready for validation.' };
    }
    if (relevant.some(change => !patchEligible(change))) {
        return stop('Pending runtime changes include a feature, breaking change or unclassified commit; choose a version and add release notes.');
    }
    const target = nextPatch(version);
    if (releases.some(release => release.tag_name === 'v' + target)) {
        return stop('The next patch already has a release or draft; inspect it instead of replacing it.');
    }
    return { ...result, eligible: true, action: 'bump', version: target,
        reason: 'Only classified patch changes are pending.', changes: relevant };
}

function assertSameReleasePlan(expected, actual) {
    assert.equal(actual.eligible, true, actual.reason);
    for (const key of ['source', 'version', 'latestReleaseId', 'action']) {
        assert.equal(actual[key], expected[key], 'Release eligibility changed: ' + key);
    }
}

function patchFiles(files, fromVersion, toVersion, changes) {
    assert.equal(toVersion, nextPatch(fromVersion), 'Automation may only increment the patch component');
    const updated = {};
    for (const file of ['package.json', 'package-lock.json', 'electron/package.json', 'electron/package-lock.json']) {
        const text = files[file];
        const value = JSON.parse(text);
        assert.equal(value.version, fromVersion, file + ' version is not aligned');
        value.version = toVersion;
        if (file.endsWith('package-lock.json')) {
            assert.equal(value.packages[''].version, fromVersion, file + ' root package is not aligned');
            value.packages[''].version = toVersion;
        }
        const indent = text.match(/^([ \t]+)"/m)?.[1] || '  ';
        updated[file] = JSON.stringify(value, null, indent) + '\n';
    }
    const entries = changes.map(change => {
        assert.match(change.sha, /^[0-9a-f]{40}$/);
        const title = change.message.split('\n').filter(Boolean).filter(line => !/^Merge pull request #/.test(line))[0];
        const plain = title.replace(/[\\`*_[\]<>]/g, '\\$&');
        return `- [${plain}](https://github.com/BinaryOutlook/binary-markdown/commit/${change.sha})`;
    }).join('\n');
    updated[`release-notes/${toVersion}.md`] = `# Binary Markdown ${toVersion}\n\nAutomatic patch release following version ${fromVersion}.\n\n## Changes\n\n${entries}\n\n## Validation and limitations\n\nThe release attaches the exact VSIX validated on Ubuntu, macOS, Windows and\nminimum VS Code, with matching source, checksums and validation evidence.\nExisting [export limitations](../media/export-help.md) and\n[supported platforms](../docs/releases-and-support.md) continue to apply.\n`;
    updated['CHANGELOG.md'] = files['CHANGELOG.md'].replace(/^(# [^\n]+\n)/,
        `$1\n## ${toVersion}\n\nAutomatic patch release. See the [version notes](release-notes/${toVersion}.md).\n`);
    updated['release-notes/README.md'] = files['release-notes/README.md'] +
        `\n- [${toVersion}](${toVersion}.md): automatic patch release.\n`;
    return updated;
}

module.exports = { latestOfficialRelease, isReleaseRelevant, patchEligible, planRelease, patchFiles, nextPatch, assertSameReleasePlan };
