import * as vscode from 'vscode';
import { ExportWebviewChannel } from './webview-rpc';
import { discoverTool } from './tools';
import { convertPandoc } from './pandoc';
import { convertPdf } from './pdf';
import { prepareStandaloneHtml } from './html';
import { createResourceLoader, dataUri } from './resources';
import { validateArtifact } from './validate';
import { finalizeExport } from './output';
import { getExportMessages } from './messages';
import { checkCancelled, ExportFormat, ExportOperations, PreparedExportDocument, SavedExportDocument, ToolStatus } from './types';

const normalize = (value: string) => value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

function exportAvailabilityError(): string | undefined {
    const messages = getExportMessages();
    if (vscode.env.remoteName) { return messages.unsupportedRemote; }
    if (vscode.env.uiKind !== vscode.UIKind.Desktop ||
        (process.platform !== 'darwin' && process.platform !== 'linux')) { return messages.unsupportedHost; }
    if (!vscode.workspace.isTrusted) { return messages.trustRequired; }
    return undefined;
}

export class ExportController implements vscode.Disposable {
    readonly channel: ExportWebviewChannel;
    private running?: AbortController;
    private capabilities?: Promise<{ pandoc: ToolStatus; browser: ToolStatus }>;
    private capabilityRefresh = 0;
    private disposed = false;

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly document: vscode.TextDocument,
        private readonly panel: vscode.WebviewPanel,
        private readonly waitForSave: (signal?: AbortSignal) => Promise<void>,
        private readonly displayContent: (markdown: string) => string
    ) {
        this.channel = new ExportWebviewChannel(message => panel.webview.postMessage(message));
    }

    async getCapabilities(refresh = false) {
        if (refresh) { this.capabilities = undefined; }
        const unavailable = exportAvailabilityError();
        if (unavailable) {
            return {
                host: { available: false, error: unavailable },
                pandoc: { kind: 'pandoc' as const, available: false, error: unavailable },
                browser: { kind: 'browser' as const, available: false, error: unavailable }
            };
        }
        if (!this.capabilities) {
            const config = vscode.workspace.getConfiguration('binary-markdown');
            this.capabilities = Promise.all([
                discoverTool('pandoc', config.get<string>('export.pandocPath', '')),
                discoverTool('browser', config.get<string>('export.browserPath', ''))
            ]).then(([pandoc, browser]) => ({ pandoc, browser }));
        }
        return { host: { available: true }, ...await this.capabilities };
    }

    refreshCapabilities(): void {
        if (this.disposed) { return; }
        const refresh = ++this.capabilityRefresh;
        void this.getCapabilities(true).then(capabilities => {
            if (this.disposed || refresh !== this.capabilityRefresh) { return; }
            return this.postStatus({ type: 'exportCapabilities', ...capabilities });
        }).catch(() => { /* A closed editor no longer needs capability labels. */ });
    }

    private async postStatus(message: Record<string, unknown>): Promise<void> {
        try { await this.panel.webview.postMessage(message); }
        catch { /* Notifications are best effort after the panel closes. RPC has its own failure handling. */ }
    }

    handleMessage(message: Record<string, any>): boolean {
        if (this.channel.receive(message)) { return true; }
        if (message.type === 'export') {
            if (['html', 'pdf', 'docx', 'epub'].includes(message.format)) { void this.export(message.format); }
            return true;
        }
        if (message.type === 'cancelExport') { this.running?.abort(); return true; }
        if (message.type === 'exportCapabilities') { this.refreshCapabilities(); return true; }
        if (message.type === 'exportSettings') {
            if (message.tool === 'pandoc' || message.tool === 'browser') {
                void vscode.commands.executeCommand('workbench.action.openSettings', 'binary-markdown.export.' + message.tool + 'Path');
            } else {
                void vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.joinPath(this.context.extensionUri, 'media/export-help.md'));
            }
            return true;
        }
        return false;
    }

    async captureForSave(): Promise<string> {
        const snapshot = await this.channel.request('captureExportSnapshot');
        if (typeof snapshot.content !== 'string') { throw new Error('Invalid editor snapshot.'); }
        return snapshot.content;
    }

    async export(format: ExportFormat): Promise<void> {
        const messages = getExportMessages();
        if (this.running) { void vscode.window.showInformationMessage(messages.busy); return; }
        const abort = new AbortController();
        this.running = abort;
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification, title: messages.title + ': ' + format.toUpperCase(), cancellable: true
        }, async (progress, cancellation) => {
            const subscription = cancellation.onCancellationRequested(() => abort.abort());
            const warnings: ExportOperations['warnings'] = [];
            const loadResource = createResourceLoader(abort.signal);
            const checkedImages = new Map<string, Promise<void>>();
            const operations: ExportOperations = {
                signal: abort.signal, warnings,
                loadResource: async (reference, base) => {
                    const resource = await loadResource(reference, base);
                    if (resource.mime.startsWith('image/')) {
                        const uri = dataUri(resource);
                        let validation = checkedImages.get(uri);
                        if (!validation) {
                            validation = this.channel.request('validateExportImage', { dataUri: uri }, abort.signal).then(reply => {
                                if (!reply.valid) { throw new Error('Image could not be decoded: ' + reference); }
                            });
                            checkedImages.set(uri, validation);
                        }
                        await validation;
                    }
                    return resource;
                },
                report: stage => {
                    checkCancelled(abort.signal);
                    const message = messages[stage];
                    progress.report({ message });
                    void this.postStatus({ type: 'exportStatus', state: 'running', stage, message });
                }
            };
            try {
                operations.report('checking');
                const unavailable = exportAvailabilityError();
                if (unavailable) { throw new Error(unavailable); }
                await this.waitForSave(abort.signal);
                checkCancelled(abort.signal);
                if (this.document.isClosed || this.document.isUntitled || this.document.uri.scheme !== 'file' || this.document.isDirty) {
                    throw new Error(messages.saveRequired);
                }
                const raw = this.document.getText();
                const version = this.document.version;
                const snapshot = await this.channel.request('captureExportSnapshot', {}, abort.signal);
                if (typeof snapshot.content !== 'string' || normalize(snapshot.content) !== normalize(this.displayContent(raw)) ||
                    this.document.version !== version || this.document.isDirty) {
                    throw new Error(messages.saveRequired);
                }
                const config = vscode.workspace.getConfiguration('binary-markdown');
                const source: SavedExportDocument = Object.freeze({
                    sourcePath: this.document.uri.fsPath, markdown: raw, version,
                    theme: format === 'pdf' && config.get<boolean>('export.pdfWhiteBackground', true)
                        ? 'github' : config.get<string>('theme', 'github'),
                    fontSize: config.get<number>('fontSize', 16)
                });
                let executable = '';
                if (format !== 'html') {
                    operations.report('dependencies');
                    // Per-job probes are cancellable; capability labels remain independently refreshable.
                    const kind = format === 'pdf' ? 'browser' : 'pandoc';
                    const tool = await discoverTool(kind, config.get<string>('export.' + kind + 'Path', ''), abort.signal);
                    if (!tool.available || !tool.path) {
                        throw new Error((tool.error || messages.unavailable) + '\n' +
                            (kind === 'pandoc' ? messages.pandocInstall : messages.browserInstall));
                    }
                    executable = tool.path;
                }
                operations.report('rendering');
                const rendered = await this.channel.request('prepareExport', {
                    markdown: raw, theme: source.theme, fontSize: source.fontSize
                }, abort.signal);
                if (typeof rendered.html !== 'string' || !Array.isArray(rendered.warnings)) {
                    throw new Error('The document renderer returned an invalid export response.');
                }
                const prepared: PreparedExportDocument = {
                    html: rendered.html, theme: source.theme, fontSize: source.fontSize,
                    warnings: rendered.warnings, diagrams: Array.isArray(rendered.diagrams) ? rendered.diagrams : []
                };
                warnings.push(...prepared.warnings.filter(warning =>
                    format === 'html' || format === 'pdf' || ![
                        'renderer-math-source', 'renderer-toc-source', 'renderer-footnote-source'
                    ].includes(warning.code)));
                let bytes: Buffer;
                if (format === 'html' || format === 'pdf') {
                    const html = await prepareStandaloneHtml(source, prepared, this.context.extensionPath, operations);
                    bytes = format === 'html' ? Buffer.from(html, 'utf8') : await convertPdf(html, executable, operations);
                } else {
                    bytes = await convertPandoc(format, source, prepared, executable, operations);
                }
                checkCancelled(abort.signal);
                validateArtifact(format, bytes);
                operations.report('saving');
                const result = await finalizeExport(source.sourcePath, format, bytes, abort.signal);
                const message = (result.reused ? messages.reused : messages.completed) + ': ' + result.outputPath;
                await this.postStatus({ type: 'exportStatus', state: 'complete', message, outputPath: result.outputPath, warnings });
                const detail = warnings.length ? '\n' + messages.warnings + ':\n' + warnings.map(warning => warning.message).join('\n') : '';
                void (warnings.length ? vscode.window.showWarningMessage : vscode.window.showInformationMessage)(
                    message + detail, messages.openOutput
                ).then(choice => {
                    if (choice === messages.openOutput) { void vscode.env.openExternal(vscode.Uri.file(result.outputPath)); }
                });
            } catch (error) {
                const cancelled = abort.signal.aborted || (error as Error).name === 'AbortError';
                const message = cancelled ? messages.cancelled : messages.failed + ': ' + String((error as Error).message || error);
                await this.postStatus({ type: 'exportStatus', state: cancelled ? 'cancelled' : 'failed', message, warnings });
                if (!cancelled) { void vscode.window.showErrorMessage(message, messages.setup).then(choice => {
                    if (choice === messages.setup) { this.handleMessage({ type: 'exportSettings' }); }
                }); }
            } finally {
                subscription.dispose();
                this.running = undefined;
            }
        });
    }

    dispose(): void {
        this.disposed = true;
        this.capabilityRefresh++;
        this.running?.abort();
        this.channel.dispose();
    }
}
