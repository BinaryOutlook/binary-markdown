'use strict';
const assert = require('node:assert/strict');

function assertArtifactAudit(audit, manifest) {
    const formats = ['html', 'pdf', 'docx', 'epub'];
    const sources = manifest.files.filter(entry => entry.kind === 'markdown');
    assert.equal(audit.results.length, sources.length * formats.length);
    let markers = 0;
    for (const source of sources) for (const format of formats) {
        const matches = audit.results.filter(result => result.source === source.path && result.format === format);
        assert.equal(matches.length, 1, 'Exactly one receipt for ' + source.path + ' ' + format);
        const result = matches[0];
        const label = source.path + ' ' + format;
        assert.equal(result.receipt_state, 'complete', label);
        assert.equal(result.workspace_source_matches_frozen, true, label);
        assert.equal(result.source_sha256, source.sha256, label);
        assert.ok(result.markers_checked >= source.required_markers.length, label);
        assert.deepEqual(result.missing_text_markers.filter(marker => !result.markers_present_in_image_alternatives.includes(marker)), [], label + ' lost content');
        assert.equal(result.trailing_editor_directive_visible, false, label);
        if (format === 'html') assert.equal(result.active_script_elements, 0, label);
        if (format === 'docx' || format === 'epub') assert.equal(result.zip_crc, 'pass', label);
        const media = result.embedded_images || result.media || result.images || [];
        const originals = new Set(media.flatMap(item => item.original_matches || []));
        for (const reference of source.inventory.image_references) {
            const name = decodeURIComponent(reference);
            const entry = manifest.files.find(file => file.path === name && file.kind !== 'markdown');
            // PDF retains raster pixels; original SVG source bytes are not a PDF contract.
            if (entry && (format !== 'pdf' || entry.kind === 'png')) assert.ok(originals.has(name), label + ' lost original image ' + name);
        }
        markers += result.markers_checked;
    }
    console.log('Artifact gate passed: ' + audit.results.length + ' outputs; ' + markers + ' markers accounted for.');
}

module.exports = { assertArtifactAudit };
