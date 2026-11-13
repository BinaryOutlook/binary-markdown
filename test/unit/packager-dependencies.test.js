'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');

test('patched glob matching preserves packaging and TypeScript project matching', () => {
    for (const parent of ['@vscode/vsce/package.json', '@typescript-eslint/typescript-estree/package.json']) {
        const parentRequire = createRequire(require.resolve(parent));
        const { minimatch } = parentRequire('minimatch');
        assert.equal(parentRequire('minimatch/package.json').version, '11.0.1');
        for (const [file, pattern, matches] of [
            ['out/webview/editor.js', 'out/**', true],
            ['out/webview/editor.js', '**/*.ts', false],
            ['src/i18n/locales/en.ts', '**/*.ts', true],
            ['.vscode/settings.json', '.vscode/**', true],
            ['vendor/katex.min.js', 'vendor/**', true],
            ['test/nested/spec.js', 'test/*.js', false],
        ]) assert.equal(minimatch(file, pattern, { dot: true }), matches, parent + ': ' + pattern);
    }
});

test('packager credential dependencies load and generate UUIDs through their scoped overrides', () => {
    const packagerRequire = createRequire(require.resolve('@vscode/vsce/package.json'));
    const identityRequire = createRequire(packagerRequire.resolve('@azure/identity'));
    const { CryptoProvider } = identityRequire('@azure/msal-node');
    const identity = packagerRequire('@azure/identity');

    // Exercise the credential chain used by vsce without requesting any tokens.
    const credentials = new identity.ChainedTokenCredential(
        new identity.EnvironmentCredential(),
        new identity.AzureCliCredential(),
        new identity.ManagedIdentityCredential(),
        new identity.AzurePowerShellCredential(),
        new identity.AzureDeveloperCliCredential()
    );
    assert.equal(typeof credentials.getToken, 'function');
    // MSAL's GUID helper exercises the CommonJS UUID API across the security override.
    assert.match(new CryptoProvider().createNewGuid(),
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
});
