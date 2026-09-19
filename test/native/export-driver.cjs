'use strict';

// Test-only extension copied into an explicitly owned native harness directory.
const vscode = require('vscode');
const fs = require('node:fs');
const path = require('node:path');
const { sameDirectory } = require('./directory-identity.cjs');
const { replaceFile } = require('./replace-file.cjs');
const sentinelName = '.binary-markdown-native-export.json';
const inside = (base, target) => {
    const relative = path.relative(base, target);
    return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
};

exports.activate = async function activate(context) {
    if (!['darwin', 'linux', 'win32'].includes(process.platform) || vscode.env.uiKind !== vscode.UIKind.Desktop || vscode.env.remoteName) return;
    const folders = vscode.workspace.workspaceFolders || [];
    if (folders.length !== 1 || folders[0].uri.scheme !== 'file') return;
    const workspace = fs.realpathSync(folders[0].uri.fsPath);
    const sentinelPath = path.join(workspace, sentinelName);
    if (!fs.existsSync(sentinelPath)) return;
    const owner = JSON.parse(fs.readFileSync(sentinelPath, 'utf8'));
    if (owner.kind !== 'binary-markdown-native-export-v1' || !sameDirectory(owner.workspace, workspace) || !owner.token) return;
    const rootOwner = JSON.parse(fs.readFileSync(path.join(owner.base, sentinelName), 'utf8'));
    if (rootOwner.token !== owner.token || rootOwner.profile !== owner.profile) return;
    const profileOwner = JSON.parse(fs.readFileSync(path.join(owner.profile, sentinelName), 'utf8'));
    if (profileOwner.token !== owner.token || profileOwner.base !== owner.base) return;
    // A driver accidentally loaded in the user's normal profile must do nothing.
    if (!inside(fs.realpathSync(owner.profile), path.resolve(context.globalStorageUri.fsPath))) return;
    const extension = vscode.extensions.getExtension('BinaryOutlook.binary-markdown');
    if (!extension || !inside(fs.realpathSync(owner.extensions), fs.realpathSync(extension.extensionPath))) return;

    const inspect = () => vscode.workspace.textDocuments.filter(document =>
        document.uri.scheme === 'file' && inside(workspace, document.uri.fsPath)
    ).map(document => ({ path: document.uri.fsPath, text: document.getText(), dirty: document.isDirty, version: document.version }));
    const identity = () => ({
        token: owner.token, workspace, profile: owner.profile, extensionPath: extension.extensionPath,
        extensionVersion: extension.packageJSON.version, vscodeVersion: vscode.version, nativeLanguage: vscode.env.language,
        platform: process.platform, arch: process.arch, nodeVersion: process.version,
        uiKind: vscode.env.uiKind, remoteName: vscode.env.remoteName ?? null,
        trusted: vscode.workspace.isTrusted,
        appearance: Object.fromEntries(['language', 'toolbarMode', 'tableToolbarPosition', 'theme', 'export.pdfWhiteBackground'].map(key =>
            [key, vscode.workspace.getConfiguration('binary-markdown').get(key)])),
        toolbarModeScopes: (() => {
            const setting = vscode.workspace.getConfiguration('binary-markdown').inspect('toolbarMode');
            return { global: setting.globalValue, workspace: setting.workspaceValue };
        })(),
        tablePositionScopes: (() => {
            const setting = vscode.workspace.getConfiguration('binary-markdown').inspect('tableToolbarPosition');
            return { global: setting.globalValue, workspace: setting.workspaceValue };
        })()
    });
    const respond = value => {
        const temporary = path.join(workspace, 'response.json.tmp');
        fs.writeFileSync(temporary, JSON.stringify({ ...identity(), ...value }, null, 2));
        replaceFile(temporary, path.join(workspace, 'response.json'));
    };
    const localFile = (name, suffix) => {
        const file = path.resolve(workspace, name);
        if (!inside(workspace, file) || !file.endsWith(suffix) || !inside(workspace, fs.realpathSync(file))) {
            throw new Error('The test driver only opens permitted files inside its owned workspace.');
        }
        return file;
    };
    let last = '';
    try { last = JSON.parse(fs.readFileSync(path.join(workspace, 'request.json'), 'utf8')).id; } catch { /* Fresh workspace. */ }
    let linkClipboardBefore;
    const execute = async request => {
        if (request.token !== owner.token) throw new Error('Test workspace ownership token mismatch.');
        let buildInformation;
        let linkClipboardMatches;
        switch (request.action) {
            case 'linkClipboard': {
                if (request.phase === 'snapshot') {
                    if (linkClipboardBefore !== undefined) throw new Error('Clipboard snapshot already active');
                    linkClipboardBefore = await vscode.env.clipboard.readText();
                } else if (request.phase === 'verify') {
                    if (linkClipboardBefore === undefined) throw new Error('Clipboard snapshot required');
                    // Compare with the fixture writer's exact spelling. VS Code's fsPath
                    // can lowercase a Windows drive letter in the canonical workspace.
                    linkClipboardMatches = await vscode.env.clipboard.readText() === path.join(owner.workspace, 'Link targets', 'Missing folder');
                } else if (request.phase === 'restore' && linkClipboardBefore !== undefined) {
                    await vscode.env.clipboard.writeText(linkClipboardBefore);
                    linkClipboardBefore = undefined;
                } else { throw new Error('Unsupported clipboard test phase'); }
                break;
            }
            case 'inspect': break;
            case 'buildInformation': {
                const previous = await vscode.env.clipboard.readText();
                try {
                    await vscode.commands.executeCommand('binary-markdown.copyBuildInformation');
                    buildInformation = await vscode.env.clipboard.readText();
                } finally { await vscode.env.clipboard.writeText(previous); }
                break;
            }
            case 'open':
                await vscode.commands.executeCommand('vscode.openWith', vscode.Uri.file(localFile(request.file, '.md')), 'binary-markdown.editor');
                break;
            case 'text': await vscode.window.showTextDocument(vscode.Uri.file(localFile(request.file, '.txt'))); break;
            case 'save': await vscode.commands.executeCommand('workbench.action.files.save'); break;
            case 'export': {
                const suffix = { html: 'Html', pdf: 'Pdf', docx: 'Docx', epub: 'Epub' }[request.format];
                if (!suffix) throw new Error('Unknown test export format.');
                await vscode.commands.executeCommand('binary-markdown.exportTo' + suffix);
                break;
            }
            case 'config': {
                // Scope regressions remain inside the sentinel-owned profile/workspace.
                if (request.scope !== undefined && (request.scope !== 'workspace' || !['tableToolbarPosition', 'toolbarMode'].includes(request.key))) {
                    throw new Error('Only the toolbar preferences permit an isolated workspace override.');
                }
                const clearSetting = request.value === null && (request.scope === 'workspace' || request.key === 'toolbarMode');
                const allowed = {
                    'export.pandocPath': value => typeof value === 'string',
                    'export.browserPath': value => typeof value === 'string',
                    'export.pdfWhiteBackground': value => typeof value === 'boolean',
                    'math.backslashDelimiters': value => typeof value === 'boolean',
                    toolbarMode: value => ['simple', 'full'].includes(value),
                    tableToolbarPosition: value => ['auto', 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'left', 'right', 'top-bar'].includes(value),
                    language: value => ['en', 'zh-CN'].includes(value),
                    theme: value => ['github', 'sepia', 'night', 'dark', 'minimal', 'perplexity', 'things'].includes(value)
                };
                if (!Object.hasOwn(allowed, request.key) || (!clearSetting && !allowed[request.key](request.value))) {
                    throw new Error('The driver only changes bounded export/appearance test settings in its isolated profile.');
                }
                await vscode.workspace.getConfiguration('binary-markdown').update(request.key, clearSetting ? undefined : request.value,
                    request.scope === 'workspace' ? vscode.ConfigurationTarget.Workspace : vscode.ConfigurationTarget.Global);
                break;
            }
            case 'autoSave': {
                if (!['off', 'afterDelay'].includes(request.value)) throw new Error('Invalid isolated Auto Save mode.');
                await vscode.workspace.getConfiguration('files').update('autoSaveDelay', 200, vscode.ConfigurationTarget.Global);
                await vscode.workspace.getConfiguration('files').update('autoSave', request.value, vscode.ConfigurationTarget.Global);
                break;
            }
            case 'untitled': {
                const document = await vscode.workspace.openTextDocument({ language: 'markdown', content: 'Untitled test' });
                await vscode.commands.executeCommand('vscode.openWith', document.uri, 'binary-markdown.editor');
                break;
            }
            case 'close': await vscode.commands.executeCommand('workbench.action.closeActiveEditor'); break;
            default: throw new Error('Unsupported test-driver action.');
        }
        return { id: request.id, ok: true, documents: inspect(), ...(buildInformation ? { buildInformation } : {}),
            ...(linkClipboardMatches !== undefined ? { linkClipboardMatches } : {}) };
    };
    const poll = async () => {
        let request;
        try { request = JSON.parse(fs.readFileSync(path.join(workspace, 'request.json'), 'utf8')); }
        catch { return; }
        if (request.id === last) return;
        last = request.id;
        try { respond(await execute(request)); }
        catch (error) { respond({ id: request.id, ok: false, error: String(error) }); }
    };
    const timer = setInterval(poll, 100);
    context.subscriptions.push({ dispose: () => clearInterval(timer) });
    respond({ ready: true, documents: inspect() });
};
