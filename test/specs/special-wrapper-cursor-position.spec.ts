import { test, expect } from '@playwright/test';

test.describe('Mermaid/Math block cursor position after editing', () => {
    test.beforeEach(async ({ page }) => {
        page.on('console', msg => {
            console.log(`[BROWSER ${msg.type()}] ${msg.text()}`);
        });
        page.on('pageerror', err => {
            console.log(`[BROWSER ERROR] ${err.message}`);
        });

        await page.goto('http://localhost:3000/standalone-editor.html');
        await page.waitForSelector('#editor', { timeout: 5000 });
        await page.waitForTimeout(1000);
        await page.waitForFunction(() => window.__testApi?.ready === true, { timeout: 5000 });
    });

    test('setCursorToLastLineStartByDOM handles \\n text nodes correctly', async ({ page }) => {
        // Directly test setCursorToLastLineStartByDOM with \n text nodes (not <br>)
        const result = await page.evaluate(() => {
            const editor = document.getElementById('editor');

            // Create a code element with \n text nodes (simulating what happens after editing in mermaid/math)
            const pre = document.createElement('pre');
            pre.setAttribute('data-lang', 'test');
            const code = document.createElement('code');
            code.setAttribute('contenteditable', 'true');

            // Simulate: "line1\nline2\nline3\n" with \n text nodes
            code.appendChild(document.createTextNode('line1'));
            code.appendChild(document.createTextNode('\n'));
            code.appendChild(document.createTextNode('line2'));
            code.appendChild(document.createTextNode('\n'));
            code.appendChild(document.createTextNode('line3'));
            code.appendChild(document.createTextNode('\n')); // trailing newline (empty last line)

            pre.appendChild(code);
            editor.appendChild(pre);

            // Call setCursorToLastLineStartByDOM via test API
            window.__testApi.setCursorToLastLineStartByDOM(code);

            // Check cursor position
            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) return { error: 'no selection' };

            const range = sel.getRangeAt(0);

            // Get text before cursor
            const cursorRange = document.createRange();
            cursorRange.selectNodeContents(code);
            cursorRange.setEnd(range.startContainer, range.startOffset);
            const textBeforeCursor = cursorRange.toString();

            // The last line after "line3\n" is empty, so cursor should be after the last \n
            // textBeforeCursor should be "line1\nline2\nline3\n"
            const lastNewline = textBeforeCursor.lastIndexOf('\n');
            const posInLine = lastNewline === -1 ? textBeforeCursor.length : textBeforeCursor.length - lastNewline - 1;

            // Clean up
            pre.remove();

            return {
                textBeforeCursor,
                positionInLine: posInLine,
                isAtLineStart: posInLine === 0,
                anchorNodeType: range.startContainer.nodeType,
                anchorNodeText: range.startContainer.textContent?.substring(0, 20),
                anchorOffset: range.startOffset,
                codeChildNodes: Array.from(code.childNodes).map(n =>
                    n.nodeType === 3 ? `TEXT:"${n.textContent}"` : n.nodeName
                )
            };
        });
        console.log('setCursorToLastLineStartByDOM with \\n result:', JSON.stringify(result));

        // Cursor should be at the start of the last (empty) line
        expect(result.isAtLineStart).toBe(true);
    });

    test('setCursorToLastLineStartByDOM handles \\n text nodes with content on last line', async ({ page }) => {
        // Test with \n text nodes where the last line has content
        const result = await page.evaluate(() => {
            const editor = document.getElementById('editor');

            const pre = document.createElement('pre');
            pre.setAttribute('data-lang', 'test');
            const code = document.createElement('code');
            code.setAttribute('contenteditable', 'true');

            // Simulate: "line1\nline2\nline3" (no trailing newline)
            code.appendChild(document.createTextNode('line1'));
            code.appendChild(document.createTextNode('\n'));
            code.appendChild(document.createTextNode('line2'));
            code.appendChild(document.createTextNode('\n'));
            code.appendChild(document.createTextNode('line3'));

            pre.appendChild(code);
            editor.appendChild(pre);

            window.__testApi.setCursorToLastLineStartByDOM(code);

            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) return { error: 'no selection' };

            const range = sel.getRangeAt(0);
            const cursorRange = document.createRange();
            cursorRange.selectNodeContents(code);
            cursorRange.setEnd(range.startContainer, range.startOffset);
            const textBeforeCursor = cursorRange.toString();

            const lastNewline = textBeforeCursor.lastIndexOf('\n');
            const posInLine = lastNewline === -1 ? textBeforeCursor.length : textBeforeCursor.length - lastNewline - 1;

            pre.remove();

            return {
                textBeforeCursor,
                positionInLine: posInLine,
                isAtLineStart: posInLine === 0,
                anchorNodeType: range.startContainer.nodeType,
                anchorNodeText: range.startContainer.textContent?.substring(0, 20),
                anchorOffset: range.startOffset
            };
        });
        console.log('setCursorToLastLineStartByDOM with \\n (content on last line) result:', JSON.stringify(result));

        // Cursor should be at start of "line3" (position 0 in the last line)
        expect(result.isAtLineStart).toBe(true);
    });

    test('setCursorToLastLineStartByDOM handles mixed <br> and \\n correctly', async ({ page }) => {
        // Test with mixed <br> and \n (which can happen during editing)
        const result = await page.evaluate(() => {
            const editor = document.getElementById('editor');

            const pre = document.createElement('pre');
            pre.setAttribute('data-lang', 'test');
            const code = document.createElement('code');
            code.setAttribute('contenteditable', 'true');

            // Simulate: "line1<br>line2\nline3\n"
            code.appendChild(document.createTextNode('line1'));
            code.appendChild(document.createElement('br'));
            code.appendChild(document.createTextNode('line2'));
            code.appendChild(document.createTextNode('\n'));
            code.appendChild(document.createTextNode('line3'));
            code.appendChild(document.createTextNode('\n'));

            pre.appendChild(code);
            editor.appendChild(pre);

            window.__testApi.setCursorToLastLineStartByDOM(code);

            const sel = window.getSelection();
            if (!sel || !sel.rangeCount) return { error: 'no selection' };

            const range = sel.getRangeAt(0);
            const cursorRange = document.createRange();
            cursorRange.selectNodeContents(code);
            cursorRange.setEnd(range.startContainer, range.startOffset);
            const textBeforeCursor = cursorRange.toString();

            const lastNewline = textBeforeCursor.lastIndexOf('\n');
            const posInLine = lastNewline === -1 ? textBeforeCursor.length : textBeforeCursor.length - lastNewline - 1;

            pre.remove();

            return {
                textBeforeCursor,
                positionInLine: posInLine,
                isAtLineStart: posInLine === 0,
                anchorNodeType: range.startContainer.nodeType,
                anchorNodeText: range.startContainer.textContent?.substring(0, 20),
                anchorOffset: range.startOffset
            };
        });
        console.log('setCursorToLastLineStartByDOM with mixed result:', JSON.stringify(result));

        expect(result.isAtLineStart).toBe(true);
    });

    test('ArrowUp enters the last empty Mermaid line after editing and leaving the block', async ({ page }) => {
        await page.evaluate(() => {
            window.__testApi.setMarkdown('```mermaid\ngraph TD\n    A --> B\n```\nParagraph below\n');
        });
        const wrapper = page.locator('.mermaid-wrapper');
        await wrapper.click();
        await expect(wrapper).toHaveAttribute('data-mode', 'edit');
        await page.evaluate(() => {
            const code = document.querySelector('.mermaid-wrapper code') as HTMLElement;
            code.focus();
            const range = document.createRange();
            range.selectNodeContents(code);
            range.collapse(false);
            const selection = window.getSelection()!;
            selection.removeAllRanges();
            selection.addRange(range);
        });
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');

        const expectedMarkdown = '```mermaid\ngraph TD\n    A --> B\n\n\n```\nParagraph below\n';
        expect(await page.evaluate(() => window.__testApi.getMarkdown())).toBe(expectedMarkdown);

        // Leave through the real click/focus lifecycle, not a data-mode mutation.
        const paragraph = page.getByText('Paragraph below', { exact: true });
        await paragraph.click();
        await expect(wrapper).toHaveAttribute('data-mode', 'display');
        expect(await page.evaluate(() => window.__testApi.getMarkdown())).toBe(expectedMarkdown);
        await paragraph.evaluate(element => {
            const range = document.createRange();
            range.selectNodeContents(element);
            range.collapse(true);
            const selection = window.getSelection()!;
            selection.removeAllRanges();
            selection.addRange(range);
        });
        await page.keyboard.press('ArrowUp');
        await expect(wrapper).toHaveAttribute('data-mode', 'edit');

        const cursor = await page.evaluate(() => {
            const code = document.querySelector('.mermaid-wrapper code')!;
            const selection = window.getSelection()!;
            if (!code.contains(selection.anchorNode)) throw new Error('Caret is outside Mermaid code');
            const prefix = document.createRange();
            prefix.selectNodeContents(code);
            prefix.setEnd(selection.anchorNode!, selection.anchorOffset);
            const text = (node: Node): string => node.nodeName === 'BR' ? '\n'
                : node.nodeType === Node.TEXT_NODE ? node.textContent || ''
                : Array.from(node.childNodes).map(text).join('');
            return { prefix: text(prefix.cloneContents()), markdown: window.__testApi.getMarkdown() };
        });
        // Check both row and column: column zero on an earlier row is incorrect.
        expect(cursor.prefix).toBe('graph TD\n    A --> B\n\n');
        expect(cursor.markdown).toBe(expectedMarkdown);
    });
});
