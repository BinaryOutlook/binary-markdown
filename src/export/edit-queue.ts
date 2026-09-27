/** Debounced host edits with an explicit save barrier and observable failure. */
export class EditQueue {
    private pending: { content: string; shouldApply?: () => boolean } | undefined;
    private timer: NodeJS.Timeout | undefined;
    private tail: Promise<void> = Promise.resolve();
    private failure: unknown;
    private disposed = false;

    constructor(private readonly apply: (content: string) => Promise<void>, private readonly delay = 100) {}

    schedule(content: string, shouldApply?: () => boolean): void {
        if (this.disposed) { return; }
        this.pending = { content, shouldApply };
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.enqueue(), this.delay);
    }

    private enqueue(): void {
        clearTimeout(this.timer);
        this.timer = undefined;
        const edit = this.pending;
        this.pending = undefined;
        if (edit === undefined) { return; }
        this.tail = this.tail.then(async () => {
            if (this.disposed) { return; }
            try {
                if (edit.shouldApply && !edit.shouldApply()) { return; }
                await this.apply(edit.content);
                this.failure = undefined;
            } catch (error) {
                this.failure = error;
            }
        });
    }

    async flush(): Promise<void> {
        this.enqueue();
        await this.tail;
        if (this.failure) { throw this.failure; }
    }

    dispose(): void {
        this.disposed = true;
        clearTimeout(this.timer);
        this.pending = undefined;
    }
}
