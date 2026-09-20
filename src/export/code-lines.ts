/** A payload has no fence separator or editor display sentinel. Never trim it. */
export function logicalCodeLines(payload: string, emptyLineCount = 0): string[] {
    if (payload !== '') { return payload.split('\n'); }
    if (emptyLineCount !== 0 && emptyLineCount !== 1) {
        throw new Error('An empty code payload must represent zero or one authored line.');
    }
    return emptyLineCount ? [''] : [];
}

/** Pandoc's payload distinguishes every case except zero lines versus one blank.
 * Use its final source range (nested lists can carry more than one data-pos).
 * Positions refer to the exact normalized input given to the reader.
 */
export function pandocCodeLines(payload: string, markdown: string, positions: readonly string[]): string[] {
    const position = positions.at(-1);
    const start = position && /^(\d+):(\d+)-/.exec(position);
    if (!start) { return logicalCodeLines(payload); }
    const lines = markdown.split('\n');
    const first = Number(start[1]) - 1;
    const opening = lines[first]?.slice(Number(start[2]) - 1).match(/^ {0,3}(`{3,}|~{3,})/);
    if (!opening) { return logicalCodeLines(payload); }
    const ranges = [...position.matchAll(/(\d+):(\d+)-(\d+):(\d+)/g)];
    const end = ranges.at(-1)!;
    const last = Math.min(Number(end[3]) - (Number(end[4]) === 1 ? 2 : 1),
        lines.length - (markdown.endsWith('\n') ? 2 : 1));
    // A closing fence may have quote/list prefixes before its recorded column.
    const closing = lines[last]?.slice(Number(end[2]) - 1).match(/^ {0,3}(`{3,}|~{3,})[ \t]*$/);
    const closed = closing && closing[1][0] === opening[1][0] && closing[1].length >= opening[1].length;
    const count = Math.max(0, last - first - (closed ? 1 : 0));
    // The CommonMark reader appends an EOF newline to an unclosed fence. Remove
    // only that proven parser delimiter, never an authored trailing blank line.
    if (!closed && payload.endsWith('\n') && payload.split('\n').length === count + 1) {
        payload = payload.slice(0, -1);
    }
    const result = logicalCodeLines(payload, payload === '' ? count : 0);
    if (result.length !== count) { throw new Error('Code source positions disagree with the code payload.'); }
    return result;
}
