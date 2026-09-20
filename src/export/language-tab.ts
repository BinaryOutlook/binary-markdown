/** Open outline of a tab with a sloped left edge and vertical right edge, in CSS pixels.
 * The code block supplies the straight top edge. Keep this function self-contained:
 * the PDF exporter also evaluates it in its isolated print document.
 */
export function languageTabPath(width: number, height: number, position = 'bottom-right'): string {
    const edge = 0.5;
    const bottom = height - edge;
    const inset = Math.min(9, height * 0.36, width / 4);
    const radius = Math.min(3, inset / 2);
    const bendY = bottom - radius;
    const corner = edge + inset;
    const bendX = edge + inset * bendY / bottom;
    const controlX = bendX + (corner - bendX) * 2 / 3;
    const controlY = bendY + radius * 2 / 3;
    const point = (...values: number[]) => values.map((value, index) => {
        if (index % 2 === 0 && position.endsWith('left')) value = width - value;
        if (index % 2 === 1 && position.startsWith('top')) value = height - value;
        return Number(value.toFixed(3));
    }).join(' ');
    const right = width - edge;
    return `M ${point(edge, 0)} L ${point(bendX, bendY)} ` +
        `C ${point(controlX, controlY, corner + radius / 3, bottom, corner + radius, bottom)} ` +
        `L ${point(right - radius, bottom)} ` +
        `C ${point(right - radius / 3, bottom, right, bottom - radius / 3, right, bottom - radius)} ` +
        `L ${point(right, 0)}`;
}

/** Trusted, inline Word shape. The label remains ordinary editable Word text. */
export function docxLanguageTab(label: string, id: number, position = 'bottom-right'): string {
    // Conservative 9 pt glyph widths keep ordinary names compact while reserving
    // enough wrapped lines for long/custom names. Avoid VML auto-fit: some readers
    // detach the text from the shape when that flag is enabled.
    const textWidth = [...label].reduce((total, char) => total +
        (/[WM@%&]/.test(char) || char.codePointAt(0)! > 255 ? 12 :
            /[A-Zmw]/.test(char) ? 9 : /[iljtfrI.,:;!'| ]/.test(char) ? 4.5 : 7), 0);
    const width = Math.min(216, Math.max(52, textWidth + 26));
    const height = Math.max(24, Math.ceil(textWidth / (width - 24)) * 16 + 4);
    const vmlPath = languageTabPath(width, height, position)
        .replace(/([MLC])\s*([^MLC]+)/g, (_match, command: string, values: string) =>
            command.toLowerCase() + values.trim().split(/\s+/).map(number => Math.round(Number(number) * 100)).join(',')) + 'xe';
    // XML 1.0 cannot represent these code points, even as character references.
    // eslint-disable-next-line no-control-regex
    const text = label.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uD800-\uDFFF\uFFFE\uFFFF]/gu, '\uFFFD')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // VML is the native shape format supported by transitional DOCX readers.
    // No image, external relationship, user-supplied markup or active content.
    return `<w:r xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">` +
        `<w:pict xmlns:v="urn:schemas-microsoft-com:vml"><v:shape id="codeLanguageTab${id}" ` +
        `style="width:${width * 0.75}pt;height:${height * 0.75}pt;v-text-anchor:middle;` +
        `mso-wrap-distance-left:0;mso-wrap-distance-right:0;mso-wrap-distance-top:0;mso-wrap-distance-bottom:0" ` +
        `coordsize="${width * 100},${height * 100}" path="${vmlPath}" ` +
        `fillcolor="#F6F8FA" strokecolor="#D0D7DE" strokeweight="0.5pt">` +
        `<v:textbox inset="9pt,1pt,9pt,1pt"><w:txbxContent><w:p><w:pPr>` +
        `<w:spacing w:before="0" w:after="0" w:line="240" w:lineRule="auto"/>` +
        `<w:ind w:left="0" w:right="0" w:firstLine="0"/><w:wordWrap w:val="off"/><w:jc w:val="center"/>` +
        `</w:pPr><w:r><w:rPr><w:rStyle w:val="CodeLanguageBadge"/></w:rPr>` +
        `<w:t xml:space="preserve">${text}</w:t></w:r></w:p></w:txbxContent></v:textbox></v:shape></w:pict></w:r>`;
}
