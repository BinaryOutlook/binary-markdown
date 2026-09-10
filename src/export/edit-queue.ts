/** Debounced host edits with an explicit save barrier and observable failure. */
export class EditQueue {
    private pending: string | undefined;
    private timer: NodeJS.Timeout | undefined;
    private tail: Promise<void> = Promise.resolve();
    private failure: unknown;
    private disposed = false;

    constructor(private readonly apply: (content: string) => Promise<void>, private readonly delay = 100) {}

    schedule(content: string): void {
        if (this.disposed) { return; }
        this.pending = content;
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.enqueue(), this.delay);
    }

    private enqueue(): void {
        clearTimeout(this.timer);
        this.timer = undefined;
        const content = this.pending;
        this.pending = undefined;
        if (content === undefined) { return; }
        this.tail = this.tail.then(async () => {
            if (this.disposed) { return; }
            try {
                await this.apply(content);
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
