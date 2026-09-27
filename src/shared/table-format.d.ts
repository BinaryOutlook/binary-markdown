export type TableSourceFormat = 'aligned' | 'compact';
export function normalize(value: unknown): TableSourceFormat;
export function format(rows: string[][], alignments?: string[], style?: TableSourceFormat, explicitLeft?: boolean[]): string;
