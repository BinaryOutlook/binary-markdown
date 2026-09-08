export type ExportFormat = 'html' | 'pdf' | 'docx' | 'epub';
export type ExportStage = 'checking' | 'dependencies' | 'resources' | 'rendering' | 'converting' | 'saving';

export interface ExportWarning {
    code: string;
    message: string;
}

/** Owned by one job; never re-read the live document during conversion. */
export interface SavedExportDocument {
    sourcePath: string;
    markdown: string;
    version: number;
    theme: string;
    fontSize: number;
}

export interface PreparedExportDocument {
    html: string;
    theme: string;
    fontSize: number;
    diagrams: Array<{ source: string; svg: string }>;
    warnings: ExportWarning[];
}

export interface ExportResource {
    bytes: Buffer;
    mime: string;
}

export interface ExportOperations {
    signal: AbortSignal;
    report(stage: ExportStage): void;
    warnings: ExportWarning[];
    loadResource(reference: string, base: string): Promise<ExportResource>;
}

export interface ToolStatus {
    kind: 'pandoc' | 'browser';
    available: boolean;
    path?: string;
    version?: string;
    error?: string;
}

export interface ExportResult {
    outputPath: string;
    reused: boolean;
    warnings: ExportWarning[];
}

export function checkCancelled(signal: AbortSignal): void {
    if (signal.aborted) {
        const error = new Error('Export cancelled');
        error.name = 'AbortError';
        throw error;
    }
}
