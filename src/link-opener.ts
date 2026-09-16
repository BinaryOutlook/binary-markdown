import * as vscode from 'vscode';
import { t, Messages } from './i18n/messages';

/** Resolve local links without changing the existing workspace-relative contract. */
export function resolveLocalLink(
    href: string, document: vscode.Uri, workspace?: vscode.Uri, platform = process.platform
): vscode.Uri | undefined {
    const windows = platform === 'win32';
    const drive = /^[a-z]:[\\/]/i.test(href);
    const unc = /^\\\\/.test(href);

    if (/^file:/i.test(href)) {
        // Explicit file URIs refer to this host, not an arbitrary remote filesystem.
        if (document.scheme !== 'file' || !/^file:\//i.test(href)) { return; }
        const uri = vscode.Uri.parse(href, true).with({ scheme: 'file' });
        const windowsDrive = /^\/[a-z]:\//i.test(uri.path);
        if ((!windows && windowsDrive) || (windows && !windowsDrive && !uri.authority)) { return; }
        return uri;
    }
    if (drive || unc || href.startsWith('/')) {
        if (document.scheme !== 'file') { return; }
        // Do not reinterpret a path from a different OS as a workspace-relative path.
        if (!windows && (drive || unc)) { return; }
        if (windows && !drive && !unc && !/^\/\/[^/]+\/[^/]+/.test(href)) { return; }
        return vscode.Uri.file(href);
    }
    // Keep unknown URI schemes (including command:) out of the opening command.
    if (/^[a-z][a-z\d+.-]*:/i.test(href)) { return; }
    return workspace ? vscode.Uri.joinPath(workspace, href) : undefined;
}

/** Shared by the unavailable-target action and a future link context-menu command. */
export async function copyLinkAddress(href: string): Promise<void> {
    try {
        await vscode.env.clipboard.writeText(href);
    } catch {
        await vscode.window.showErrorMessage(t('linkCopyFailed'));
    }
}

async function offerCopy(href: string, reason: keyof Messages): Promise<void> {
    const copy = t('copyLinkAddress');
    if (await vscode.window.showWarningMessage(t(reason), copy) === copy) {
        await copyLinkAddress(href);
    }
}

/** Open a verified resource through VS Code's existing file/folder behavior. */
export async function openLocalLink(href: string, document: vscode.Uri): Promise<void> {
    let uri: vscode.Uri | undefined;
    try {
        uri = resolveLocalLink(href, document, vscode.workspace.getWorkspaceFolder(document)?.uri);
    } catch {
        // Do not show raw exception text, which can contain private paths.
        await offerCopy(href, 'linkUnavailable');
        return;
    }
    if (!uri) {
        await offerCopy(href, 'linkUnavailable');
        return;
    }
    try {
        // Some editor-opening failures resolve normally after showing an error pane.
        // Preflight prevents missing resources from reaching that pane in the first place.
        await vscode.workspace.fs.stat(uri);
    } catch (error) {
        const code = (error as { code?: string } | undefined)?.code;
        await offerCopy(href, code === 'FileNotFound' ? 'linkNotFound'
            : code === 'NoPermissions' ? 'linkNoPermissions' : 'linkOpenFailed');
        return;
    }
    try {
        await vscode.commands.executeCommand('vscode.open', uri);
    } catch {
        await offerCopy(href, 'linkOpenFailed');
    }
}
