'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createRequire } = require('node:module');

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
