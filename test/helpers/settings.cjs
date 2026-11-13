'use strict';

// VS Code accepts one configuration object or an ordered array of groups.
function configurationProperties(manifest) {
    return Object.assign({}, ...[manifest.contributes.configuration].flat().map(group => group.properties));
}

module.exports = { configurationProperties };
