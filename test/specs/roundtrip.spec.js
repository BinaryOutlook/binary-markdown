"use strict";
/**
 * Round-trip変換テスト
 * Markdown → HTML → Markdown の変換で意味的に等価な結果を検証
 */
Object.defineProperty(exports, "__esModule", { value: true });
const test_1 = require("@playwright/test");
test_1.test.describe('Round-trip変換', () => {
    test_1.test.beforeEach(async ({ page }) => {
        await page.goto('/standalone-editor.html');
        await page.waitForFunction(() => { var _a; return (_a = window.__testApi) === null || _a === void 0 ? void 0 : _a.ready; });
    });
    (0, test_1.test)('《見出し》のRound-trip', async ({ page }) => {
        const markdown = '# 見出し1\n\n## 見出し2\n\n### 見出し3';
        await page.evaluate((md) => {
            window.__testApi.setMarkdown(md);
        }, markdown);
        const result = await page.evaluate(() => {
            return window.__testApi.getMarkdown();
        });
        (0, test_1.expect)(result).toContain('# 見出し1');
        (0, test_1.expect)(result).toContain('## 見出し2');
        (0, test_1.expect)(result).toContain('### 見出し3');
    });
    (0, test_1.test)('《段落》のRound-trip', async ({ page }) => {
        const markdown = 'これは段落です。\n\nこれは別の段落です。';
        await page.evaluate((md) => {
            window.__testApi.setMarkdown(md);
        }, markdown);
        const result = await page.evaluate(() => {
            return window.__testApi.getMarkdown();
        });
        (0, test_1.expect)(result).toContain('これは段落です。');
        (0, test_1.expect)(result).toContain('これは別の段落です。');
    });
    (0, test_1.test)('《順序なしリスト》のRound-trip（正規化）', async ({ page }) => {
        // 入力: * と + を使用
        const markdown = '* アイテム1\n+ アイテム2\n- アイテム3';
        await page.evaluate((md) => {
            window.__testApi.setMarkdown(md);
        }, markdown);
        const result = await page.evaluate(() => {
            return window.__testApi.getMarkdown();
        });
        // Unchanged blocks retain the author's markers.
        (0, test_1.expect)(result).toBe(markdown + '\n');
    });
    (0, test_1.test)('《太字》のRound-trip（正規化）', async ({ page }) => {
        // 入力: __ を使用
        const markdown = '__太字テキスト__';
        await page.evaluate((md) => {
            window.__testApi.setMarkdown(md);
        }, markdown);
        const result = await page.evaluate(() => {
            return window.__testApi.getMarkdown();
        });
        (0, test_1.expect)(result).toBe(markdown + '\n');
    });
    (0, test_1.test)('《斜体》のRound-trip（正規化）', async ({ page }) => {
        // 入力: _ を使用
        const markdown = '_斜体テキスト_';
        await page.evaluate((md) => {
            window.__testApi.setMarkdown(md);
        }, markdown);
        const result = await page.evaluate(() => {
            return window.__testApi.getMarkdown();
        });
        (0, test_1.expect)(result).toBe(markdown + '\n');
    });
    (0, test_1.test)('《コードブロック》のRound-trip（言語タグ保持）', async ({ page }) => {
        const markdown = '```javascript\nconst x = 1;\n```';
        await page.evaluate((md) => {
            window.__testApi.setMarkdown(md);
        }, markdown);
        const result = await page.evaluate(() => {
            return window.__testApi.getMarkdown();
        });
        (0, test_1.expect)(result).toContain('```javascript');
        (0, test_1.expect)(result).toContain('const x = 1;');
    });
    (0, test_1.test)('《画像》パスにアンダースコア含む場合の保持', async ({ page }) => {
        const markdown = '![alt](path_with_underscore.png)';
        await page.evaluate((md) => {
            window.__testApi.setMarkdown(md);
        }, markdown);
        const result = await page.evaluate(() => {
            return window.__testApi.getMarkdown();
        });
        // アンダースコアが斜体として誤解釈されていないこと
        (0, test_1.expect)(result).toContain('path_with_underscore.png');
        (0, test_1.expect)(result).not.toContain('<em>');
    });
    (0, test_1.test)('《画像》がimgタグとしてレンダリングされる', async ({ page }) => {
        const markdown = '![代替テキスト](https://example.com/image.png)';
        await page.evaluate((md) => {
            window.__testApi.setMarkdown(md);
        }, markdown);
        const html = await page.evaluate(() => {
            return window.__testApi.getHtml();
        });
        // imgタグが存在すること
        (0, test_1.expect)(html).toContain('<img');
        (0, test_1.expect)(html).toContain('src="https://example.com/image.png"');
        (0, test_1.expect)(html).toContain('alt="代替テキスト"');
    });
    (0, test_1.test)('《リンク》がaタグとしてレンダリングされる', async ({ page }) => {
        const markdown = '[リンクテキスト](https://example.com)';
        await page.evaluate((md) => {
            window.__testApi.setMarkdown(md);
        }, markdown);
        const html = await page.evaluate(() => {
            return window.__testApi.getHtml();
        });
        // aタグが存在すること
        (0, test_1.expect)(html).toContain('<a');
        (0, test_1.expect)(html).toContain('href="https://example.com"');
        (0, test_1.expect)(html).toContain('リンクテキスト');
    });
    (0, test_1.test)('《引用》複数行の保持', async ({ page }) => {
        const markdown = '> 引用1行目\n> 引用2行目\n> 引用3行目';
        await page.evaluate((md) => {
            window.__testApi.setMarkdown(md);
        }, markdown);
        const result = await page.evaluate(() => {
            return window.__testApi.getMarkdown();
        });
        // 各行に > プレフィックスが保持されていること
        const lines = result.split('\n').filter((l) => l.startsWith('>'));
        (0, test_1.expect)(lines.length).toBeGreaterThanOrEqual(3);
    });
    (0, test_1.test)('《水平線》のRound-trip（正規化）', async ({ page }) => {
        // 入力: *** を使用
        const markdown = '***';
        await page.evaluate((md) => {
            window.__testApi.setMarkdown(md);
        }, markdown);
        const result = await page.evaluate(() => {
            return window.__testApi.getMarkdown();
        });
        (0, test_1.expect)(result).toBe(markdown + '\n');
    });
    (0, test_1.test)('《リンク》のRound-trip', async ({ page }) => {
        const markdown = '[リンクテキスト](https://example.com)';
        await page.evaluate((md) => {
            window.__testApi.setMarkdown(md);
        }, markdown);
        const result = await page.evaluate(() => {
            return window.__testApi.getMarkdown();
        });
        (0, test_1.expect)(result).toContain('[リンクテキスト](https://example.com)');
    });
    (0, test_1.test)('《リンク》URLにアンダースコア含む場合の保持', async ({ page }) => {
        const markdown = '[リンク](https://example.com/path_with_underscore)';
        await page.evaluate((md) => {
            window.__testApi.setMarkdown(md);
        }, markdown);
        const result = await page.evaluate(() => {
            return window.__testApi.getMarkdown();
        });
        // アンダースコアが斜体として誤解釈されていないこと
        (0, test_1.expect)(result).toContain('path_with_underscore');
        (0, test_1.expect)(result).not.toContain('<em>');
    });
    (0, test_1.test)('《リンク》テキスト内に特殊文字含む場合', async ({ page }) => {
        const markdown = '[テキスト with *special* chars](https://example.com)';
        await page.evaluate((md) => {
            window.__testApi.setMarkdown(md);
        }, markdown);
        const result = await page.evaluate(() => {
            return window.__testApi.getMarkdown();
        });
        (0, test_1.expect)(result).toContain('https://example.com');
    });
    (0, test_1.test)('《リンク》と《画像》の混在', async ({ page }) => {
        const markdown = '[リンク](https://example.com) と ![画像](image.png) の混在';
        await page.evaluate((md) => {
            window.__testApi.setMarkdown(md);
        }, markdown);
        const result = await page.evaluate(() => {
            return window.__testApi.getMarkdown();
        });
        (0, test_1.expect)(result).toContain('[リンク](https://example.com)');
        (0, test_1.expect)(result).toContain('![画像](image.png)');
    });
});
const fs = require("fs");
const path = require("path");
test_1.test.describe('ファイルベースRound-trip変換', () => {
    test_1.test.beforeEach(async ({ page }) => {
        await page.goto('/standalone-editor.html');
        await page.waitForFunction(() => { var _a; return (_a = window.__testApi) === null || _a === void 0 ? void 0 : _a.ready; });
    });
    (0, test_1.test)('committed mixed document retains its authored source', async ({ page }) => {
        const fixture = path.join(__dirname, '../fixtures/roundtrip');
        const inputMarkdown = fs.readFileSync(path.join(fixture, 'mixed-input.md'), 'utf8');
        await page.evaluate(md => window.__testApi.setMarkdown(md), inputMarkdown);
        const result = await page.evaluate(() => window.__testApi.getMarkdown());
        (0, test_1.expect)(result).toBe(inputMarkdown);
        // Newly authored DOM has no captured source baseline. Keep the
        // independent canonical-serializer check alongside source retention.
        await page.evaluate(() => document.querySelectorAll('#editor > *').forEach(node => node.removeAttribute('data-md-canonical')));
        const canonical = await page.evaluate(() => window.__testApi.getMarkdown());
        (0, test_1.expect)(canonical).toBe(fs.readFileSync(path.join(fixture, 'mixed-expected.md'), 'utf8'));
    });
    (0, test_1.test)('Round-tripを2回実行しても空行が増えない', async ({ page }) => {
        // 各種Markdown要素を含むテストデータ
        const inputMarkdown = [
            '# 見出し1',
            '',
            '段落テキストです。',
            '',
            '## 見出し2',
            '',
            '- リスト1',
            '- リスト2',
            '  - ネストリスト',
            '',
            '1. 番号付き1',
            '2. 番号付き2',
            '',
            '> 引用テキスト',
            '',
            '```javascript',
            'const x = 1;',
            '```',
            '',
            '| col1 | col2 |',
            '| :--- | :--- |',
            '| a | b |',
            '',
            '---',
            '',
            '**太字** と *斜体* と ~~取り消し線~~',
        ].join('\n');
        // 1回目のRound-trip
        await page.evaluate((md) => {
            window.__testApi.setMarkdown(md);
        }, inputMarkdown);
        const firstResult = await page.evaluate(() => {
            return window.__testApi.getMarkdown();
        });
        // 2回目のRound-trip
        await page.evaluate((md) => {
            window.__testApi.setMarkdown(md);
        }, firstResult);
        const secondResult = await page.evaluate(() => {
            return window.__testApi.getMarkdown();
        });
        // 1回目と2回目の結果が同じであること（空行が増えていないこと）
        (0, test_1.expect)(secondResult).toBe(firstResult);
    });
    (0, test_1.test)('《コードブロック》末尾の空行が保持される', async ({ page }) => {
        // コードブロック末尾に空行がある場合
        const markdown = '```javascript\nconst x = 1;\n\n```';
        await page.evaluate((md) => {
            window.__testApi.setMarkdown(md);
        }, markdown);
        const result = await page.evaluate(() => {
            return window.__testApi.getMarkdown();
        });
        // 末尾の空行が保持されていること
        (0, test_1.expect)(result).toContain('const x = 1;\n\n```');
    });
    (0, test_1.test)('《コードブロック》複数の末尾空行が保持される', async ({ page }) => {
        // コードブロック末尾に複数の空行がある場合
        const markdown = '```python\nprint("hello")\n\n\n```';
        await page.evaluate((md) => {
            window.__testApi.setMarkdown(md);
        }, markdown);
        const result = await page.evaluate(() => {
            return window.__testApi.getMarkdown();
        });
        // 複数の末尾空行が保持されていること
        (0, test_1.expect)(result).toContain('print("hello")\n\n\n```');
    });
    (0, test_1.test)('《コードブロック》内の改行がすべて保持される', async ({ page }) => {
        // コードブロック内に複数の改行がある場合
        const markdown = '```\nline1\n\nline2\n\nline3\n```';
        await page.evaluate((md) => {
            window.__testApi.setMarkdown(md);
        }, markdown);
        const result = await page.evaluate(() => {
            return window.__testApi.getMarkdown();
        });
        // 中間の空行も保持されていること
        (0, test_1.expect)(result).toContain('line1\n\nline2\n\nline3');
    });
    (0, test_1.test)('《コードブロック》直後の段落が正しく分離される', async ({ page }) => {
        // コードブロックの直後に段落がある場合
        const markdown = '```javascript\nconst x = 1;\n```\n\nこれは段落です';
        await page.evaluate((md) => {
            window.__testApi.setMarkdown(md);
        }, markdown);
        const result = await page.evaluate(() => {
            return window.__testApi.getMarkdown();
        });
        // コードブロックと段落が正しく分離されていること
        (0, test_1.expect)(result).toContain('```\n\nこれは段落です');
    });
    (0, test_1.test)('《コードブロック》HTMLで<br>タグが使用される', async ({ page }) => {
        // コードブロック内の改行がHTMLで<br>として表現されること
        const markdown = '```\nline1\nline2\n```';
        await page.evaluate((md) => {
            window.__testApi.setMarkdown(md);
        }, markdown);
        const html = await page.evaluate(() => {
            return window.__testApi.getHtml();
        });
        // <br>タグが使用されていること
        (0, test_1.expect)(html).toContain('<br>');
        (0, test_1.expect)(html).toContain('<pre');
        (0, test_1.expect)(html).toContain('<code'); // contenteditable属性が付く場合があるため部分一致
    });
});
//# sourceMappingURL=roundtrip.spec.js.map