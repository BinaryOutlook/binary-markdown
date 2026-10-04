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

function githubActionsIdentity(environment) {
    if (environment.GITHUB_ACTIONS !== 'true') return null;
    const integer = key => {
        const value = environment[key];
        if (!/^[1-9]\d*$/.test(value || '') || !Number.isSafeInteger(Number(value))) {
            throw new Error('GitHub Actions identity requires a positive safe integer: ' + key);
        }
        return Number(value);
    };
    const runId = integer('GITHUB_RUN_ID');
    const runNumber = integer('GITHUB_RUN_NUMBER');
    const runAttempt = integer('GITHUB_RUN_ATTEMPT');
    const repository = environment.GITHUB_REPOSITORY || '';
    if (!/^[a-zA-Z0-9_-]+\/[a-zA-Z0-9_.-]+$/.test(repository) || ['.', '..'].includes(repository.split('/')[1])) {
        throw new Error('GitHub Actions identity requires an owner/repository name.');
    }
    const server = new URL(environment.GITHUB_SERVER_URL || 'https://github.com');
    if (server.protocol !== 'https:' || server.username || server.password || server.search || server.hash || server.pathname !== '/') {
        throw new Error('GitHub Actions identity requires a credential-free HTTPS server origin.');
    }
    const ref = environment.GITHUB_REF || '';
    if (!/^refs\/[^\u0000-\u0020\u007f]+$/.test(ref)) throw new Error('GitHub Actions identity requires a complete Git ref.');
    return {
        provider: 'github-actions', repository, runId, runNumber, runAttempt,
        runUrl: server.origin + '/' + repository + '/actions/runs/' + runId,
        event: environment.GITHUB_EVENT_NAME || 'unknown', ref,
    };
}

function buildIdentity(root, environment = process.env) {
    const manifest = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
    const top = git(root, ['rev-parse', '--show-toplevel']);
    // Git and Windows APIs can spell the same directory with different drive
    // casing. Compare directory identities without accepting an archive nested
    // inside another checkout or folding distinct case-sensitive paths together.
    const topStat = top && fs.statSync(top, { bigint: true });
    const rootStat = fs.statSync(root, { bigint: true });
    const checkout = topStat && topStat.dev === rootStat.dev && topStat.ino === rootStat.ino;
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
        buildNode: process.versions.node, ci: githubActionsIdentity(environment),
    };
}

function assertReleaseIdentity(info) {
    if (!/^\d+\.\d+\.\d+$/.test(info.version)) throw new Error('Release version must use major.minor.patch.');
    if (info.sourceKind !== 'git' || !/^[0-9a-f]{40}$/.test(info.sourceCommit || '') || info.dirty !== false) {
        throw new Error('Release packaging requires an identified, clean Git checkout.');
    }
    if (!info.repository) throw new Error('Release packaging requires a source repository URL.');
}

module.exports = { buildIdentity, assertReleaseIdentity, sourceRepository, githubActionsIdentity };
