export interface Heading { level: number; label: string; id: string; start: number; }
export interface SourceBlock { start: number; end: number; source: string; }
export const START: string;
export const END: string;
export function splitFrontMatter(source: string): { raw: string; body: string };
export function headingText(source: string): string;
export function headingSlug(label: string): string;
export function scan(source: string): {
    front: { raw: string; body: string }; headings: Heading[]; tocs: SourceBlock[];
    markers: { start: number; end: number }[];
};
export function generateToc(headings: Heading[], eol?: string): string;
export function refreshTocs(source: string): string;
export function assertFreshToc(source: string): void;
