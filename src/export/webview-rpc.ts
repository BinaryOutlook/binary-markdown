import { randomUUID } from 'crypto';

type Reply = Record<string, any>;
const replyTypes: Record<string, string> = {
    captureExportSnapshot: 'exportSnapshot',
    prepareExport: 'exportPrepared',
    validateExportImage: 'exportImageValidated'
};

function asError(error: unknown): Error {
    return error instanceof Error ? error : new Error(String(error));
}

/** Correlate replies to their originating panel and dispose them with that panel. */
export class ExportWebviewChannel {
    private pending = new Map<string, { expected: string; resolve(reply: Reply): void; reject(error: Error): void }>();
    private disposed = false;

    constructor(private readonly post: (message: Reply) => Thenable<boolean>) {}

    request(type: string, payload: Reply = {}, signal?: AbortSignal): Promise<Reply> {
        if (this.disposed) { return Promise.reject(new Error('The document editor was closed.')); }
        const expected = replyTypes[type];
        if (!expected) { return Promise.reject(new Error('Unsupported export editor request.')); }
        const requestId = randomUUID();
        return new Promise((resolve, reject) => {
            let settled = false;
            let timer: ReturnType<typeof setTimeout> | undefined;
            const finish = (reply?: Reply, error?: Error) => {
                if (settled) { return; }
                settled = true;
                clearTimeout(timer);
                signal?.removeEventListener('abort', abort);
                this.pending.delete(requestId);
                if (error) { reject(error); } else { resolve(reply!); }
            };
            const abort = () => {
                // Closing a panel can make this best-effort notification throw
                // synchronously or reject. Neither should hide cancellation.
                try {
                    void Promise.resolve(this.post({ type: 'cancelExportPreparation', requestId })).catch(() => undefined);
                } catch { /* The pending request is still cancelled below. */ }
                const error = new Error('Export cancelled');
                error.name = 'AbortError';
                finish(undefined, error);
            };
            // Detect a missing editor bridge; rendering itself has no duration target.
            timer = type === 'captureExportSnapshot' ? setTimeout(
                () => finish(undefined, new Error('The editor did not respond. Reopen it and retry.')), 15000
            ) : undefined;
            this.pending.set(requestId, { expected, resolve: reply => finish(reply), reject: error => finish(undefined, error) });
            signal?.addEventListener('abort', abort, { once: true });
            if (signal?.aborted) { abort(); return; }
            try {
                Promise.resolve(this.post({ ...payload, type, requestId })).then(sent => {
                    if (!sent) { finish(undefined, new Error('The document editor is unavailable.')); }
                }, error => finish(undefined, asError(error)));
            } catch (error) { finish(undefined, asError(error)); }
        });
    }

    receive(message: Reply): boolean {
        if (![...Object.values(replyTypes), 'exportError'].includes(message.type)) { return false; }
        const pending = this.pending.get(message.requestId);
        if (pending) {
            if (message.type === 'exportError') { pending.reject(new Error(String(message.error))); }
            else if (message.type !== pending.expected) { pending.reject(new Error('The editor returned a response for the wrong export operation.')); }
            else if ((message.type === 'exportSnapshot' && typeof message.content !== 'string') ||
                (message.type === 'exportPrepared' && (typeof message.html !== 'string' || !Array.isArray(message.warnings))) ||
                (message.type === 'exportImageValidated' && typeof message.valid !== 'boolean')) {
                pending.reject(new Error('The editor returned an invalid export response.'));
            } else { pending.resolve(message); }
        }
        return true;
    }

    dispose(): void {
        this.disposed = true;
        for (const pending of this.pending.values()) { pending.reject(new Error('The document editor was closed.')); }
        this.pending.clear();
    }
}
