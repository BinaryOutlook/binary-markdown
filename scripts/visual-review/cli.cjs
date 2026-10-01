#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const core = require('./core.cjs');

async function main() {
    const root = path.resolve(__dirname, '../..');
    const [command, argument, ...extra] = process.argv.slice(2);
    if (command === 'capture') {
        const { capture } = require('./capture.cjs');
        const result = await capture(root, argument, extra.length ? extra : undefined);
        console.log(result.path);
    } else if (command === 'review') {
        const receipt = await require('./review.cjs').review(root, argument);
        console.log(receipt.sectionId + ': ' + receipt.verdict + '\nBuilder handoff: ' + path.posix.dirname(argument) + '/next.md');
        process.exitCode = receipt.verdict === 'PASS' ? 0 : receipt.verdict === 'FAIL' ? 2 : 3;
    } else if (command === 'import') {
        if (extra.length !== 1) throw new Error('Import requires packet and verdict repository-relative paths');
        const receipt = core.saveVerdict(root, argument, core.readJson(root, extra[0]));
        console.log(receipt.sectionId + ': ' + receipt.verdict);
        process.exitCode = receipt.verdict === 'PASS' ? 0 : receipt.verdict === 'FAIL' ? 2 : 3;
    } else if (command === 'status') {
        const { manifest } = core.contract(root);
        for (const section of manifest.sections) {
            const records = core.iterations(root, section.id);
            const passedCases = new Set();
            let verdict = 'PENDING';
            for (const name of records) {
                const directory = core.OUTPUT + '/' + section.id + '/' + name;
                if (!fs.existsSync(core.safePath(root, directory + '/packet.json'))) continue;
                try {
                    const packet = core.loadPacket(root, directory + '/packet.json');
                    verdict = 'PENDING';
                    if (fs.existsSync(core.safePath(root, directory + '/receipt.json'))) {
                        const receipt = core.readJson(root, directory + '/receipt.json');
                        core.validateReceipt(packet, receipt);
                        verdict = receipt.verdict;
                        for (const assessment of receipt.evaluation?.caseAssessments || []) {
                            if (assessment.assessable && assessment.criteria.every(c => c.result === 'met')) passedCases.add(assessment.caseId);
                            else passedCases.delete(assessment.caseId);
                        }
                    }
                } catch { verdict = 'STALE/BLOCKED'; }
            }
            const recipe = core.contract(root).registry.sections.find(s => s.id === section.id);
            const completed = section.requiredStates.filter(state => {
                const expected = recipe?.cases.filter(c => c.state === state) || [];
                return expected.length && expected.every(c => passedCases.has(c.id));
            });
            console.log(section.id + ': ' + verdict + ' — ' + completed.length + '/' + section.requiredStates.length + ' state groups have current AI evidence');
        }
    } else {
        console.log('Visual review (from repository root):\n  node scripts/visual-review/cli.cjs capture SECTION [CASE ...]\n  node scripts/visual-review/cli.cjs review PACKET\n  node scripts/visual-review/cli.cjs import PACKET VERDICT\n  node scripts/visual-review/cli.cjs status\n\nCapture is offline. Review explicitly uses installed Codex authentication/account usage. Exit codes: 0 PASS, 2 FAIL, 3 BLOCKED; setup errors 1.');
    }
}
main().catch(error => { console.error('Visual review blocked: ' + error.message); process.exitCode = 1; });
