'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');

const PLAN = 'reports/plans/2026-10-01-ui-ux-visual-fidelity';
const OUTPUT = '.vscode-test/visual-review';
const MAX_JSON = 1024 * 1024;
const MAX_PNG = 20 * 1024 * 1024;
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
    ? Object.fromEntries(Object.keys(item).sort().map(key => [key, item[key]])) : item);
const digest = packet => hash(canonical(Object.fromEntries(Object.entries(packet).filter(([key]) => key !== 'packetDigest'))));
const git = (root, ...args) => execFileSync('git', args, { cwd: root, maxBuffer: 24 * 1024 * 1024 });

// Both existing files and new output paths must stay below the real checkout.
// Reject every symlink on the path, including a redirected output directory.
function safePath(root, relative) {
    if (typeof relative !== 'string' || !relative || path.isAbsolute(relative) || relative.includes('\\') || relative.includes('\0')
        || relative.split('/').some(part => !part || part === '..' || part === '.')) throw new Error('Unsafe repository-relative path');
    const base = fs.realpathSync(root);
    let current = base;
    for (const part of relative.split('/')) {
        current = path.join(current, part);
        if (fs.existsSync(current) || (() => { try { return fs.lstatSync(current).isSymbolicLink(); } catch { return false; } })()) {
            if (fs.lstatSync(current).isSymbolicLink()) throw new Error('Symlink in evidence path');
        }
    }
    return current;
}
function readJson(root, relative) {
    const file = safePath(root, relative);
    if (fs.statSync(file).size > MAX_JSON) throw new Error('JSON exceeds evidence limit');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}
function writeJson(root, relative, value, exclusive = false) {
    const file = safePath(root, relative);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n', { flag: exclusive ? 'wx' : 'w', mode: 0o600 });
}
function png(root, relative) {
    const file = safePath(root, relative);
    const stat = fs.statSync(file);
    if (!stat.isFile() || stat.size < 33 || stat.size > MAX_PNG) throw new Error('Invalid PNG size');
    const bytes = fs.readFileSync(file);
    if (!bytes.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) || bytes.toString('ascii', 12, 16) !== 'IHDR') throw new Error('Invalid PNG header');
    const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20);
    if (!width || !height || width > 10000 || height > 10000 || width * height > 50000000) throw new Error('Invalid PNG dimensions');
    return { path: relative, sha256: hash(bytes), width, height, bytes: stat.size };
}
function walk(root, relative, result) {
    const file = safePath(root, relative);
    if (!fs.existsSync(file)) return;
    if (fs.statSync(file).isDirectory()) {
        for (const entry of fs.readdirSync(file).sort()) walk(root, relative + '/' + entry, result);
    } else result.push([relative, hash(fs.readFileSync(file))]);
}
function sourceIdentity(root) {
    const files = [];
    for (const relative of ['src', 'vendor', 'package.json', 'package-lock.json', '.node-version', 'test/build-standalone.js', 'scripts/build-locales.cjs', 'scripts/copy-webview.js']) walk(root, relative, files);
    return { commit: git(root, 'rev-parse', 'HEAD').toString().trim(), dirty: Boolean(git(root, 'status', '--porcelain').length), productHash: hash(canonical(files)) };
}
function contract(root) {
    const manifest = readJson(root, PLAN + '/references.json');
    const registry = readJson(root, 'scripts/visual-review/sections.json');
    const files = [];
    walk(root, 'scripts/visual-review', files);
    files.push([PLAN + '/references.json', hash(canonical(manifest))]);
    return { manifest, registry, hash: hash(canonical(files)) };
}
function sectionContract(root, id) {
    const current = contract(root);
    const design = current.manifest.sections.find(section => section.id === id);
    const recipe = current.registry.sections.find(section => section.id === id);
    if (!design || !recipe) throw new Error('Unknown section');
    return { ...current, design, recipe };
}
function extractReferences(root, design) {
    const manifest = readJson(root, PLAN + '/references.json');
    if (!/^[a-f0-9]{40}$/.test(manifest.designCommit)) throw new Error('Invalid design revision');
    return design.references.map(reference => {
        if (!/^[a-f0-9]{64}$/.test(reference.sha256)) throw new Error('Invalid reference hash');
        safePath(root, reference.sourcePath);
        const destination = safePath(root, reference.localPath);
        if (!fs.existsSync(destination)) {
            const bytes = git(root, 'show', manifest.designCommit + ':' + reference.sourcePath);
            if (hash(bytes) !== reference.sha256) throw new Error('Reference hash mismatch');
            fs.mkdirSync(path.dirname(destination), { recursive: true });
            fs.writeFileSync(destination, bytes, { flag: 'wx', mode: 0o600 });
        }
        const image = png(root, reference.localPath);
        if (image.sha256 !== reference.sha256 || image.width !== reference.width || image.height !== reference.height) throw new Error('Reference identity mismatch');
        return { ...image, level: reference.level, intent: reference.writtenIntent, annotations: reference.annotations };
    });
}
function iterations(root, section) {
    const directory = safePath(root, OUTPUT + '/' + section);
    return fs.existsSync(directory) ? fs.readdirSync(directory).filter(name => /^iteration-\d{3}$/.test(name)).sort() : [];
}
function newIteration(root, section) {
    const names = iterations(root, section);
    const next = names.length ? Number(names.at(-1).slice(-3)) + 1 : 1;
    if (next > 999) throw new Error('Iteration limit reached');
    const relative = OUTPUT + '/' + section + '/iteration-' + String(next).padStart(3, '0');
    fs.mkdirSync(safePath(root, relative), { recursive: true });
    return relative;
}
function priorFailures(root, section) {
    const failures = new Map();
    for (const name of iterations(root, section)) {
        const relative = OUTPUT + '/' + section + '/' + name + '/receipt.json';
        if (!fs.existsSync(safePath(root, relative))) continue;
        const receipt = readJson(root, relative);
        const packet = readJson(root, OUTPUT + '/' + section + '/' + name + '/packet.json');
        validateReceipt(packet, receipt);
        if (!receipt.evaluation) continue;
        for (const resolution of receipt.evaluation.priorResolutions) if (resolution.status === 'fixed') failures.delete(resolution.id);
        for (const item of receipt.evaluation.discrepancies) if (item.severity !== 'Minor') failures.set(item.id, item);
    }
    return [...failures.values()];
}
function seal(root, directory, captured) {
    const { design, recipe, manifest, hash: contractHash } = sectionContract(root, captured.sectionId);
    const packet = {
        schemaVersion: 1, sectionId: design.id, title: design.title,
        designCommit: manifest.designCommit, contractHash,
        designBrief: manifest.designBrief, ownerAdjustments: design.ownerScopeAdjustments,
        targetRegions: recipe.targetRegions, excludedRegions: recipe.excludedRegions,
        obstructionException: 'Excluded UI matters only if it clips or obstructs this target. Never grade its independent design.',
        criteria: design.visualRequirements.map((description, index) => ({ id: 'C' + (index + 1), description })),
        requiredStates: design.requiredStates,
        references: extractReferences(root, design),
        source: sourceIdentity(root), capture: captured.capture,
        cases: captured.cases.map(item => ({ ...item, images: item.images.map(relative => png(root, relative)) })),
        priorFailures: priorFailures(root, design.id),
    };
    packet.packetDigest = digest(packet);
    writeJson(root, directory + '/packet.json', packet, true);
    return packet;
}
function loadPacket(root, relative, checkSource = true) {
    if (!new RegExp('^' + OUTPUT.replace('.', '\\.') + '/[a-z0-9-]+/iteration-\\d{3}/packet\\.json$').test(relative)) throw new Error('Packet must be in an iteration directory');
    const packet = readJson(root, relative);
    if (packet.packetDigest !== digest(packet)) throw new Error('Packet digest mismatch');
    const { design, recipe, hash: currentContractHash } = sectionContract(root, packet.sectionId);
    if (packet.contractHash !== currentContractHash || canonical(packet.targetRegions) !== canonical(recipe.targetRegions)
        || canonical(packet.excludedRegions) !== canonical(recipe.excludedRegions)
        || canonical(packet.ownerAdjustments) !== canonical(design.ownerScopeAdjustments)
        || canonical(packet.criteria) !== canonical(design.visualRequirements.map((description, index) => ({ id: 'C' + (index + 1), description })))) throw new Error('Review contract changed');
    if (!packet.cases.length || packet.cases.length > 16) throw new Error('Invalid case count');
    const caseIds = new Set();
    for (const item of packet.cases) {
        const defined = recipe.cases.find(c => c.id === item.id);
        if (caseIds.has(item.id) || !defined) throw new Error('Unknown or duplicate capture case');
        if (item.state !== defined.state || item.comparison !== defined.comparison) throw new Error('Capture state contract changed');
        caseIds.add(item.id);
        if (item.images.length !== 2) throw new Error('Full view and component evidence required');
        for (const image of item.images) {
            if (!image.path.startsWith(path.posix.dirname(relative) + '/')) throw new Error('Image outside iteration');
            if (canonical(png(root, image.path)) !== canonical(image)) throw new Error('Application image changed');
        }
    }
    const references = extractReferences(root, design);
    if (canonical(references) !== canonical(packet.references)) throw new Error('References changed');
    if (checkSource && sourceIdentity(root).productHash !== packet.source.productHash) throw new Error('Stale product source');
    return packet;
}
function exactKeys(value, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).sort().join('|') !== [...keys].sort().join('|')) throw new Error('Malformed evaluator fields');
}
function sentence(value) {
    if (typeof value !== 'string' || !value.trim() || value.length > 4000 || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) throw new Error('Invalid evaluator text');
}
function validateVerdict(packet, verdict) {
    exactKeys(verdict, ['packetDigest','sectionId','verdict','summary','openedImages','caseAssessments','discrepancies','priorResolutions','missingEvidence']);
    if (verdict.packetDigest !== packet.packetDigest || verdict.sectionId !== packet.sectionId) throw new Error('Evaluator identity mismatch');
    if (!['PASS','FAIL','BLOCKED'].includes(verdict.verdict)) throw new Error('Invalid verdict');
    sentence(verdict.summary);
    const images = [...packet.references, ...packet.cases.flatMap(c => c.images)].map(i => i.sha256).sort();
    if (!Array.isArray(verdict.openedImages) || canonical([...verdict.openedImages].sort()) !== canonical(images)) throw new Error('Incomplete image acknowledgement');
    const caseIds = packet.cases.map(c => c.id), criteria = packet.criteria.map(c => c.id), regions = packet.targetRegions.map(r => r.id);
    if (!Array.isArray(verdict.caseAssessments) || verdict.caseAssessments.length !== caseIds.length) throw new Error('Missing case assessment');
    const seen = new Set();
    let unmet = false, unassessable = false;
    for (const item of verdict.caseAssessments) {
        exactKeys(item, ['caseId','assessable','criteria']);
        if (!caseIds.includes(item.caseId) || seen.has(item.caseId) || typeof item.assessable !== 'boolean') throw new Error('Unknown or duplicate case');
        seen.add(item.caseId); unassessable ||= !item.assessable;
        if (!Array.isArray(item.criteria) || item.criteria.length !== criteria.length) throw new Error('Missing criterion');
        const checked = new Set();
        for (const check of item.criteria) {
            exactKeys(check, ['criterionId','result','evidence']);
            if (!criteria.includes(check.criterionId) || checked.has(check.criterionId) || !['met','unmet','unassessable'].includes(check.result)) throw new Error('Invalid criterion assessment');
            checked.add(check.criterionId); sentence(check.evidence);
            unmet ||= check.result === 'unmet'; unassessable ||= check.result === 'unassessable';
        }
    }
    if (!Array.isArray(verdict.discrepancies) || verdict.discrepancies.length > 64) throw new Error('Invalid discrepancy list');
    const discrepancyIds = new Set();
    let major = false;
    for (const item of verdict.discrepancies) {
        exactKeys(item, ['id','caseId','criterionId','regionId','severity','expected','observed','correction','nextRender']);
        if (!/^[A-Z0-9-]{2,40}$/.test(item.id) || discrepancyIds.has(item.id) || !caseIds.includes(item.caseId) || !criteria.includes(item.criterionId)
            || !regions.includes(item.regionId) || !['Critical','Major','Minor'].includes(item.severity)) throw new Error('Out-of-scope or malformed discrepancy');
        discrepancyIds.add(item.id); major ||= item.severity !== 'Minor';
        for (const key of ['expected','observed','correction','nextRender']) sentence(item[key]);
    }
    if (!Array.isArray(verdict.priorResolutions) || verdict.priorResolutions.length !== packet.priorFailures.length) throw new Error('Missing prior failure resolution');
    const resolved = new Set();
    for (const item of verdict.priorResolutions) {
        exactKeys(item, ['id','status','evidence']);
        if (!packet.priorFailures.some(p => p.id === item.id) || resolved.has(item.id) || !['fixed','remaining','unassessable'].includes(item.status)) throw new Error('Invalid prior resolution');
        resolved.add(item.id); sentence(item.evidence);
        major ||= item.status === 'remaining'; unassessable ||= item.status === 'unassessable';
    }
    if (!Array.isArray(verdict.missingEvidence) || verdict.missingEvidence.length > 32) throw new Error('Invalid missing evidence list');
    verdict.missingEvidence.forEach(sentence);
    if (verdict.verdict === 'PASS' && (major || unmet || unassessable || verdict.missingEvidence.length)) throw new Error('Unsupported PASS');
    if (verdict.verdict === 'FAIL' && (!major || !unmet)) throw new Error('FAIL needs an actionable unmet visual criterion');
    if (verdict.verdict === 'BLOCKED' && !unassessable && !verdict.missingEvidence.length) throw new Error('BLOCKED needs missing evidence');
    return verdict;
}
const escapeMd = value => String(value).replace(/[&<>|`\[\]\\*_]/g, char => '&#' + char.charCodeAt(0) + ';').replace(/\r?\n/g, ' ');
function saveVerdict(root, relative, evaluation, failure) {
    const packet = loadPacket(root, relative);
    if (evaluation) validateVerdict(packet, evaluation);
    const directory = path.posix.dirname(relative);
    const receipt = { schemaVersion: 1, sectionId: packet.sectionId, packetDigest: packet.packetDigest,
        source: packet.source, verdict: evaluation ? evaluation.verdict : 'BLOCKED',
        evaluation: evaluation || null, error: failure || null };
    writeJson(root, directory + '/receipt.json', receipt, true);
    let text = '# Builder handoff: ' + packet.sectionId + '\n\nVerdict: **' + receipt.verdict + '**. Packet: `' + packet.packetDigest + '`.\n\n';
    if (evaluation) {
        text += escapeMd(evaluation.summary) + '\n\n';
        if (evaluation.discrepancies.length) {
            text += '| ID | Severity | Expected / observed | Correction | Next render |\n| --- | --- | --- | --- | --- |\n';
            for (const item of evaluation.discrepancies) text += '| ' + [item.id,item.severity,item.expected + ' / ' + item.observed,item.correction,item.nextRender].map(escapeMd).join(' | ') + ' |\n';
        }
        if (evaluation.missingEvidence.length) text += '\nMissing evidence: ' + evaluation.missingEvidence.map(escapeMd).join('; ') + '\n';
    } else text += 'Evaluation could not be accepted: ' + escapeMd(failure) + '. No visual pass is established.\n';
    text += '\nBefore further edits, reopen this packet, its fixed references and current renders. On FAIL, fix the listed differences, preserve this iteration, and capture/review a new iteration. Never weaken the scope or replace the reference to clear a failure. A PASS applies only to these states and source inputs; final owner acceptance is separate.\n';
    fs.writeFileSync(safePath(root, directory + '/next.md'), text, { flag: 'wx', mode: 0o600 });
    return receipt;
}
function validateReceipt(packet, receipt) {
    exactKeys(receipt, ['schemaVersion','sectionId','packetDigest','source','verdict','evaluation','error']);
    if (packet.packetDigest !== digest(packet) || receipt.packetDigest !== packet.packetDigest || receipt.sectionId !== packet.sectionId
        || canonical(receipt.source) !== canonical(packet.source) || receipt.schemaVersion !== 1) throw new Error('Receipt identity mismatch');
    if (receipt.evaluation) {
        validateVerdict(packet, receipt.evaluation);
        if (receipt.verdict !== receipt.evaluation.verdict || receipt.error !== null) throw new Error('Receipt verdict mismatch');
    } else if (receipt.verdict !== 'BLOCKED' || !receipt.error) throw new Error('Unsupported receipt');
    return receipt;
}
module.exports = { PLAN, OUTPUT, MAX_JSON, hash, canonical, digest, safePath, readJson, writeJson, png, sourceIdentity, contract, sectionContract, extractReferences, iterations, newIteration, seal, loadPacket, validateVerdict, validateReceipt, saveVerdict, escapeMd };
