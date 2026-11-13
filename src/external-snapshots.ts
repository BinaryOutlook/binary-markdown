import * as vscode from 'vscode';

/**
 * Read-only copies of revisions written by another program. Compare shows one
 * beside the live document, so a conflict can be reviewed without loading it.
 */
export const EXTERNAL_SNAPSHOT_SCHEME = 'binary-markdown-external';
const RETAINED_SNAPSHOTS = 16;

export class ExternalSnapshotStore implements vscode.TextDocumentContentProvider {
    private readonly snapshots = new Map<string, string>();
    private registration: vscode.Disposable | undefined;
    private next = 0;

    constructor(private readonly subscriptions: vscode.Disposable[]) {}

    /** Retain content and return a unique URI that opens it read-only. */
    add(source: vscode.Uri, content: string): vscode.Uri {
        if (!this.registration) {
            this.registration = vscode.workspace.registerTextDocumentContentProvider(EXTERNAL_SNAPSHOT_SCHEME, this);
            this.subscriptions.push(this.registration);
        }
        // The source path keeps the file name and Markdown language mode; the
        // query makes each snapshot distinct so VS Code never shows a stale one.
        const uri = vscode.Uri.from({ scheme: EXTERNAL_SNAPSHOT_SCHEME, path: source.path, query: String(++this.next) });
        this.snapshots.set(uri.toString(), content);
        while (this.snapshots.size > RETAINED_SNAPSHOTS) {
            this.snapshots.delete(this.snapshots.keys().next().value as string);
        }
        return uri;
    }

    provideTextDocumentContent(uri: vscode.Uri): string {
        return this.snapshots.get(uri.toString()) ?? '';
    }
}
