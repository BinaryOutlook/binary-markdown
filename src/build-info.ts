import * as vscode from 'vscode';
import * as fs from 'fs/promises';
import * as os from 'os';

interface BuildIdentity {
    name?: string;
    version?: string;
    sourceCommit?: string | null;
    sourceTree?: string | null;
    sourceKind?: string;
    dirty?: boolean | null;
    sourceUrl?: string | null;
    buildNode?: string;
    ci?: {
        runId?: number;
        runNumber?: number;
        runAttempt?: number;
        runUrl?: string;
        ref?: string;
    } | null;
}

export function formatBuildInformation(info: BuildIdentity): string {
    return [
        'Binary Markdown ' + (info.version || 'unknown'),
        'Source commit: ' + (info.sourceCommit || 'unknown'),
        'Source tree: ' + (info.sourceTree || 'unknown'),
        'Source identification: ' + (info.sourceKind || 'unknown'),
        'Local source changes: ' + (info.dirty === true ? 'yes' : info.dirty === false ? 'no' : 'unknown'),
        'Source URL: ' + (info.sourceUrl || 'unknown'),
        'Build Node: ' + (info.buildNode || 'unknown'),
        'CI build number: ' + (info.ci?.runNumber || 'not recorded'),
        'CI run ID: ' + (info.ci?.runId || 'not recorded'),
        'CI run attempt: ' + (info.ci?.runAttempt || 'not recorded'),
        'CI run URL: ' + (info.ci?.runUrl || 'not recorded'),
        'CI ref: ' + (info.ci?.ref || 'not recorded'),
        'VS Code: ' + vscode.version,
        'Host: ' + os.platform() + ' ' + os.arch(),
        'Extension host: ' + (vscode.env.remoteName || 'local'),
    ].join('\n');
}

export async function copyBuildInformation(context: vscode.ExtensionContext): Promise<void> {
    let info: BuildIdentity = { version: context.extension.packageJSON.version };
    try {
        const stored = JSON.parse(await fs.readFile(context.asAbsolutePath('build-info.json'), 'utf8'));
        if (stored && typeof stored === 'object' && !Array.isArray(stored)) { info = { ...info, ...stored }; }
    } catch {
        // A development host or unpacked source archive may have no build stamp.
    }
    await vscode.env.clipboard.writeText(formatBuildInformation(info));
    vscode.window.showInformationMessage(vscode.l10n.t('Build information copied.'));
}
