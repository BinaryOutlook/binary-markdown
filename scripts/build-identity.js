'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function git(root, args) {
    try { return execFileSync('git', args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); }
    catch { return null; }
}

function sourceRepository(value) {
    if (!value) return null;
    if (/^[^@\s]+@[^:\s]+:.+/.test(value)) value = 'https://' + value.replace(/^[^@]+@/, '').replace(':', '/');
    try {
        const url = new URL(value.replace(/\.git$/, ''));
        if (!['https:', 'http:'].includes(url.protocol)) return null;
        url.username = ''; url.password = ''; url.search = ''; url.hash = '';
        return url.toString().replace(/\/$/, '');
    } catch { return null; }
}

function buildIdentity(root, environment = process.env) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const top = git(root, ['rev-parse', '--show-toplevel']);
    const checkout = top && fs.realpathSync(top) === fs.realpathSync(root);
    const provided = environment.BINARY_MARKDOWN_SOURCE_COMMIT || null;
    if (provided && !/^[0-9a-f]{40}$/.test(provided)) throw new Error('Source commit must be a full lowercase Git SHA.');
    const sourceCommit = checkout ? git(root, ['rev-parse', 'HEAD']) : provided;
    const status = checkout ? git(root, ['status', '--porcelain', '--untracked-files=normal']) : null;
    const repository = sourceRepository(environment.BINARY_MARKDOWN_SOURCE_REPOSITORY ||
        (checkout && git(root, ['remote', 'get-url', 'origin'])) || manifest.repository?.url);
    return {
        schemaVersion: 1, name: manifest.name, version: manifest.version, license: manifest.license,
        sourceCommit, sourceTree: checkout ? git(root, ['rev-parse', 'HEAD^{tree}']) : null,
        sourceKind: checkout ? 'git' : provided ? 'provided' : 'unknown',
        dirty: status === null ? null : status.length > 0,
        repository, sourceUrl: repository && sourceCommit ? repository + '/tree/' + sourceCommit : null,
        buildNode: process.versions.node,
    };
}

function assertReleaseIdentity(info) {
    if (!/^\d+\.\d+\.\d+$/.test(info.version)) throw new Error('Release version must use major.minor.patch.');
    if (info.sourceKind !== 'git' || !/^[0-9a-f]{40}$/.test(info.sourceCommit || '') || info.dirty !== false) {
        throw new Error('Release packaging requires an identified, clean Git checkout.');
    }
    if (!info.repository) throw new Error('Release packaging requires a source repository URL.');
}

module.exports = { buildIdentity, assertReleaseIdentity, sourceRepository };
