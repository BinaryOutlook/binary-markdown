'use strict';

const editorValueMarkers = /__(?:SEARCH_WORKER|MATH_BACKSLASH|DEBUG_MODE|I18N|DOCUMENT_BASE_URI|CONTENT)__/g;

// Values are complete JavaScript expressions, supplied under their full marker names.
// A single replacement pass keeps marker-like text inside data unchanged.
function substituteEditorScript(script, values) {
    return script.replace(editorValueMarkers, marker => {
        if (!values || !Object.prototype.hasOwnProperty.call(values, marker)) {
            throw new Error('Missing editor script value: ' + marker);
        }
        const encoded = JSON.stringify(values[marker]);
        if (typeof encoded !== 'string') {
            throw new Error('Editor script value cannot be encoded: ' + marker);
        }
        // Prevent data from closing the surrounding inline HTML script element.
        return encoded.replace(/</g, '\\u003c');
    });
}

module.exports = { substituteEditorScript };
