/**
 * Code presentation and language helpers shared by the editor controllers.
 * Construction only binds dependencies; DOM work starts when a method is called.
 * The sentinel set belongs to the editor session and is shared with serialization.
 */
function createCodeContent({ editor, logger, i18n, document, window, codeBlocksWithSentinel, getCodePlainText, stripSentinelAndRebuildCode, stripTrailingNewlines, escapeHtml, renderMermaidDiagram, renderMathBlock, setCursorToEnd, syncMarkdown, syncMarkdownSync }) {
    // Supported languages for syntax highlighting (must be defined before init())
    const SUPPORTED_LANGUAGES = [
        // Curated browsing order, not a measured popularity ranking.
        'plaintext', 'markdown', 'javascript', 'typescript', 'python', 'java', 'c', 'cpp',
        'csharp', 'go', 'rust', 'bash', 'shell', 'json', 'yaml', 'html', 'css', 'sql',
        'dockerfile', 'php', 'ruby', 'swift', 'kotlin', 'xml', 'mermaid', 'math'
    ];
    const LANGUAGE_ALIASES = {
        'js': 'javascript', 'ts': 'typescript', 'py': 'python', 'sh': 'bash', 'zsh': 'bash',
        'htm': 'html', 'yml': 'yaml', 'md': 'markdown', 'c++': 'cpp', 'c#': 'csharp',
        'cs': 'csharp', 'rb': 'ruby', 'docker': 'dockerfile', 'text': 'plaintext', 'txt': 'plaintext'
    };
    const LANGUAGE_NAMES = {
        javascript: 'JavaScript', typescript: 'TypeScript', python: 'Python', json: 'JSON',
        bash: 'Bash', shell: 'Shell', css: 'CSS', html: 'HTML', xml: 'XML', sql: 'SQL',
        java: 'Java', go: 'Go', rust: 'Rust', yaml: 'YAML', markdown: 'Markdown', c: 'C',
        cpp: 'C++', csharp: 'C#', php: 'PHP', ruby: 'Ruby', swift: 'Swift', kotlin: 'Kotlin',
        dockerfile: 'Dockerfile'
    };
    function codeLanguageName(id) {
        if (id === 'plaintext')
            return i18n.languagePickerPlainText || 'Plain text';
        if (id === 'math')
            return i18n.languagePickerMath || 'Math equation';
        if (id === 'mermaid')
            return i18n.languagePickerMermaid || 'Mermaid diagram';
        return LANGUAGE_NAMES[id] || id;
    }
    function orderedCodeLanguages() {
        const mode = document.documentElement.dataset.codeLanguageOrder;
        if (mode !== 'a-z' && mode !== 'z-a')
            return SUPPORTED_LANGUAGES;
        // Explicit collation keeps ordering independent of the OS locale.
        const names = new Intl.Collator('en', { sensitivity: 'base' });
        const ordered = [...SUPPORTED_LANGUAGES].sort((a, b) => names.compare(codeLanguageName(a), codeLanguageName(b)) || a.localeCompare(b, 'en'));
        return mode === 'z-a' ? ordered.reverse() : ordered;
    }
    // Enter edit mode - remove highlighting, make editable
    function enterEditMode(pre) {
        const code = pre.querySelector('code');
        if (!code)
            return;
        // Nested contenteditable elements can share the outer editor's focus.
        // Restore inactive blocks here; click propagation/focusout is not enough.
        editor.querySelectorAll('pre[data-mode="edit"]').forEach(other => {
            if (other !== pre && !other.closest('.mermaid-wrapper, .math-wrapper')) {
                enterDisplayMode(other);
            }
        });
        logger.log('enterEditMode');
        // Get plain text content, converting <br> to newlines.
        let plainText = getCodePlainText(code);
        // Strip the display-only trailing <br> that was added for browser
        // visibility. This <br> is NOT user content.
        if (code.getAttribute('data-trailing-br') === 'true') {
            if (plainText.endsWith('\n')) {
                plainText = plainText.slice(0, -1);
            }
        }
        // Set edit mode — clear the trailing-br marker since edit DOM doesn't use it
        pre.setAttribute('data-mode', 'edit');
        code.setAttribute('contenteditable', 'true');
        code.removeAttribute('data-trailing-br');
        // Replace content with plain text (remove highlight spans)
        // Convert to text nodes with <br> for newlines
        code.innerHTML = '';
        // Handle empty code block - add a <br> for minimum height and cursor placement
        if (!plainText || plainText === '' || plainText === '\n') {
            code.appendChild(document.createElement('br'));
        }
        else {
            const lines = plainText.split('\n');
            lines.forEach((line, i) => {
                code.appendChild(document.createTextNode(line));
                if (i < lines.length - 1) {
                    code.appendChild(document.createElement('br'));
                }
            });
            // If content has a trailing empty line, the last <br> above acts as
            // the contenteditable "block closer" and is NOT rendered as a visible
            // empty line.  Add one more <br> so the empty line is actually visible,
            // and mark the block as having a sentinel so Markdown conversion strips it.
            if (plainText.endsWith('\n')) {
                code.appendChild(document.createElement('br'));
                codeBlocksWithSentinel.add(pre);
            }
        }
        // Focus and place cursor at start
        code.focus();
        const range = document.createRange();
        const sel = window.getSelection();
        if (code.firstChild) {
            if (code.firstChild.nodeType === 1 && code.firstChild.tagName === 'BR') {
                // Empty code block - set cursor before the <br>
                range.setStart(code, 0);
            }
            else {
                range.setStart(code.firstChild, 0);
            }
            range.collapse(true);
            sel.removeAllRanges();
            sel.addRange(range);
        }
    }
    // Enter display mode - apply highlighting, make non-editable
    function enterDisplayMode(pre) {
        const code = pre.querySelector('code');
        if (!code)
            return;
        logger.log('enterDisplayMode');
        const hasSentinel = codeBlocksWithSentinel.has(pre);
        // Set display mode
        pre.setAttribute('data-mode', 'display');
        code.setAttribute('contenteditable', 'false');
        if (hasSentinel) {
            codeBlocksWithSentinel.delete(pre);
            stripSentinelAndRebuildCode(code);
        }
        // Apply syntax highlighting (also manages data-trailing-br)
        applyHighlighting(pre);
    }
    // Convert a regular code block to a mermaid or math special wrapper block.
    // type: 'mermaid' | 'math'
    function convertToSpecialBlock(pre, type) {
        logger.log('convertToSpecialBlock:', type);
        const code = pre.querySelector('code');
        if (!code)
            return;
        const empty = code.childNodes.length === 1 && code.firstChild.nodeName === 'BR';
        const codeContent = empty ? '' : stripTrailingNewlines(getCodePlainText(code), code, pre);
        const wrapperClass = type + '-wrapper';
        const displayClass = type === 'mermaid' ? 'mermaid-diagram' : 'math-display';
        const renderFn = type === 'mermaid' ? renderMermaidDiagram : renderMathBlock;
        const wrapper = document.createElement('div');
        wrapper.className = wrapperClass;
        wrapper.setAttribute('data-mode', 'display');
        wrapper.setAttribute('contenteditable', 'false');
        const newPre = document.createElement('pre');
        newPre.setAttribute('data-lang', type);
        newPre.setAttribute('contenteditable', 'true');
        const newCode = document.createElement('code');
        if (!codeContent) {
            newCode.innerHTML = '<br>';
        }
        else if (codeContent.endsWith('\n')) {
            newCode.innerHTML = escapeHtml(codeContent).replace(/\n/g, '<br>') + '<br>';
            newCode.setAttribute('data-trailing-br', 'true');
        }
        else {
            newCode.innerHTML = escapeHtml(codeContent).replace(/\n/g, '<br>');
        }
        newPre.appendChild(newCode);
        const displayDiv = document.createElement('div');
        displayDiv.className = displayClass;
        wrapper.appendChild(newPre);
        wrapper.appendChild(displayDiv);
        pre.parentNode.replaceChild(wrapper, pre);
        wrapper.dataset[type + 'Setup'] = 'true';
        renderFn(wrapper);
        // Add click handler to enter edit mode
        wrapper.addEventListener('click', function (e) {
            if (wrapper.getAttribute('data-mode') !== 'edit') {
                wrapper.setAttribute('data-mode', 'edit');
                newCode.focus();
                setCursorToEnd(newCode);
            }
        });
        // Add input handler for live re-rendering
        var renderTimeout = null;
        newPre.addEventListener('input', function () {
            if (renderTimeout)
                clearTimeout(renderTimeout);
            renderTimeout = setTimeout(function () {
                renderFn(wrapper);
            }, 500);
        });
        // Add focusout handler to return to display mode
        newCode.addEventListener('focusout', function (e) {
            setTimeout(function () {
                if (!wrapper.contains(document.activeElement)) {
                    if (wrapper.getAttribute('data-mode') === 'edit') {
                        wrapper.setAttribute('data-mode', 'display');
                        renderFn(wrapper);
                        syncMarkdown();
                    }
                }
            }, 100);
        });
        syncMarkdownSync();
    }
    // Apply syntax highlighting to a code block
    function applyHighlighting(pre) {
        const code = pre.querySelector('code');
        if (!code)
            return;
        let lang = pre.getAttribute('data-lang') || '';
        lang = LANGUAGE_ALIASES[lang.toLowerCase()] || lang.toLowerCase();
        // Get plain text content, converting <br> to newlines.
        // If there's already a display-only trailing <br> from a previous
        // call, strip it before processing so we don't accumulate extras.
        let text = getCodePlainText(code);
        if (code.getAttribute('data-trailing-br') === 'true' && text.endsWith('\n')) {
            text = text.slice(0, -1);
        }
        // Handle empty code block - add a <br> for minimum height
        if (!text || text === '' || text === '\n') {
            code.innerHTML = '<br>';
            code.removeAttribute('data-trailing-br');
            return;
        }
        // Trailing empty line needs an extra <br> for browser visibility.
        // Also set/clear data-trailing-br attribute so mdProcessNode can
        // strip it during round-trip.
        const hasTrailingEmptyLine = text.endsWith('\n');
        const trailingBr = hasTrailingEmptyLine ? '<br>' : '';
        if (hasTrailingEmptyLine) {
            code.setAttribute('data-trailing-br', 'true');
        }
        else {
            code.removeAttribute('data-trailing-br');
        }
        // Get highlight patterns for this language
        const patterns = getHighlightPatterns(lang);
        if (!patterns || patterns.length === 0) {
            // No patterns - just escape HTML and preserve newlines
            code.innerHTML = escapeHtml(text).replace(/\n/g, '<br>') + trailingBr;
            return;
        }
        // Escape HTML first
        let html = escapeHtml(text);
        // Track which character positions have been highlighted
        const highlighted = new Array(html.length).fill(false);
        const matches = [];
        // Find all matches for all patterns
        patterns.forEach(({ regex, className }) => {
            regex.lastIndex = 0;
            let match;
            while ((match = regex.exec(html)) !== null) {
                const start = match.index;
                const end = start + match[0].length;
                // Check if this region overlaps with already highlighted
                let overlaps = false;
                for (let i = start; i < end; i++) {
                    if (highlighted[i]) {
                        overlaps = true;
                        break;
                    }
                }
                if (!overlaps) {
                    // Mark as highlighted
                    for (let i = start; i < end; i++) {
                        highlighted[i] = true;
                    }
                    matches.push({ start, end, text: match[0], className });
                }
            }
        });
        // Sort by start position
        matches.sort((a, b) => a.start - b.start);
        // Build final HTML
        let result = '';
        let lastEnd = 0;
        matches.forEach(({ start, end, text: matchText, className }) => {
            if (start > lastEnd) {
                result += html.substring(lastEnd, start);
            }
            result += '<span class="' + className + '">' + matchText + '</span>';
            lastEnd = end;
        });
        if (lastEnd < html.length) {
            result += html.substring(lastEnd);
        }
        // Convert newlines to <br>, with extra <br> for trailing empty line
        code.innerHTML = result.replace(/\n/g, '<br>') + trailingBr;
    }
    // Get highlight patterns for a language
    function getHighlightPatterns(lang) {
        const patterns = [];
        // Common patterns
        const addCommon = () => {
            // Strings (double and single quotes)
            patterns.push({ regex: /"(?:[^"\\]|\\.)*"/g, className: 'hljs-string' });
            patterns.push({ regex: /'(?:[^'\\]|\\.)*'/g, className: 'hljs-string' });
            // Numbers
            patterns.push({ regex: /\b\d+(\.\d+)?\b/g, className: 'hljs-number' });
        };
        switch (lang) {
            case 'javascript':
            case 'typescript':
                // Comments
                patterns.push({ regex: /\/\/.*$/gm, className: 'hljs-comment' });
                patterns.push({ regex: /\/\*[\s\S]*?\*\//g, className: 'hljs-comment' });
                addCommon();
                // Template literals
                patterns.push({ regex: /`(?:[^`\\]|\\.)*`/g, className: 'hljs-string' });
                // Keywords
                patterns.push({ regex: /\b(const|let|var|function|return|if|else|for|while|do|switch|case|break|continue|new|this|class|extends|import|export|from|default|async|await|try|catch|finally|throw|typeof|instanceof|in|of|null|undefined|true|false)\b/g, className: 'hljs-keyword' });
                // Built-ins
                patterns.push({ regex: /\b(console|document|window|Array|Object|String|Number|Boolean|Promise|Map|Set|JSON|Math|Date|RegExp|Error)\b/g, className: 'hljs-built_in' });
                break;
            case 'python':
                // Comments
                patterns.push({ regex: /#.*$/gm, className: 'hljs-comment' });
                // Triple-quoted strings
                patterns.push({ regex: /"""[\s\S]*?"""/g, className: 'hljs-string' });
                patterns.push({ regex: /'''[\s\S]*?'''/g, className: 'hljs-string' });
                addCommon();
                // Keywords
                patterns.push({ regex: /\b(def|class|return|if|elif|else|for|while|break|continue|pass|import|from|as|try|except|finally|raise|with|lambda|yield|global|nonlocal|True|False|None|and|or|not|in|is)\b/g, className: 'hljs-keyword' });
                // Built-ins
                patterns.push({ regex: /\b(print|len|range|str|int|float|list|dict|set|tuple|bool|type|isinstance|hasattr|getattr|setattr|open|input|super|self)\b/g, className: 'hljs-built_in' });
                break;
            case 'json':
                addCommon();
                // Property names
                patterns.push({ regex: /"[^"]*"(?=\s*:)/g, className: 'hljs-attr' });
                // Literals
                patterns.push({ regex: /\b(true|false|null)\b/g, className: 'hljs-literal' });
                break;
            case 'bash':
            case 'shell':
                // Comments
                patterns.push({ regex: /#.*$/gm, className: 'hljs-comment' });
                addCommon();
                // Keywords
                patterns.push({ regex: /\b(if|then|else|elif|fi|for|while|do|done|case|esac|function|return|exit|echo|cd|ls|rm|cp|mv|mkdir|chmod|chown|grep|sed|awk|cat|head|tail|find|xargs|export|source|alias)\b/g, className: 'hljs-keyword' });
                // Variables
                patterns.push({ regex: /\$[a-zA-Z_][a-zA-Z0-9_]*/g, className: 'hljs-built_in' });
                patterns.push({ regex: /\$\{[^}]+\}/g, className: 'hljs-built_in' });
                break;
            case 'css':
                // Comments
                patterns.push({ regex: /\/\*[\s\S]*?\*\//g, className: 'hljs-comment' });
                addCommon();
                // Selectors
                patterns.push({ regex: /[.#][a-zA-Z_][a-zA-Z0-9_-]*/g, className: 'hljs-selector' });
                // Properties
                patterns.push({ regex: /[a-z-]+(?=\s*:)/g, className: 'hljs-property' });
                // Keywords
                patterns.push({ regex: /@[a-z-]+/g, className: 'hljs-keyword' });
                break;
            case 'html':
            case 'xml':
                // Comments
                patterns.push({ regex: /<!--[\s\S]*?-->/g, className: 'hljs-comment' });
                addCommon();
                // Tags
                patterns.push({ regex: /&lt;\/?[a-zA-Z][a-zA-Z0-9]*(?=[\s&gt;])/g, className: 'hljs-tag' });
                // Attributes
                patterns.push({ regex: /[a-zA-Z-]+(?==)/g, className: 'hljs-attr' });
                break;
            case 'sql':
                // Comments
                patterns.push({ regex: /--.*$/gm, className: 'hljs-comment' });
                patterns.push({ regex: /\/\*[\s\S]*?\*\//g, className: 'hljs-comment' });
                addCommon();
                // Keywords (case insensitive)
                patterns.push({ regex: /\b(SELECT|FROM|WHERE|AND|OR|NOT|IN|LIKE|ORDER|BY|GROUP|HAVING|JOIN|LEFT|RIGHT|INNER|OUTER|ON|AS|INSERT|INTO|VALUES|UPDATE|SET|DELETE|CREATE|TABLE|INDEX|DROP|ALTER|ADD|COLUMN|PRIMARY|KEY|FOREIGN|REFERENCES|NULL|DEFAULT|UNIQUE|CHECK|CONSTRAINT)\b/gi, className: 'hljs-keyword' });
                // Functions
                patterns.push({ regex: /\b(COUNT|SUM|AVG|MIN|MAX|COALESCE|NULLIF|CAST|CONVERT|SUBSTRING|CONCAT|UPPER|LOWER|TRIM|LENGTH)\b/gi, className: 'hljs-built_in' });
                break;
            case 'java':
            case 'csharp':
            case 'cpp':
            case 'c':
                // Comments
                patterns.push({ regex: /\/\/.*$/gm, className: 'hljs-comment' });
                patterns.push({ regex: /\/\*[\s\S]*?\*\//g, className: 'hljs-comment' });
                addCommon();
                // Keywords
                patterns.push({ regex: /\b(public|private|protected|static|final|abstract|class|interface|extends|implements|new|return|if|else|for|while|do|switch|case|break|continue|try|catch|finally|throw|throws|void|int|long|float|double|boolean|char|byte|short|string|var|const|null|true|false|this|super|import|package|using|namespace)\b/g, className: 'hljs-keyword' });
                // Types
                patterns.push({ regex: /\b(String|Integer|Long|Float|Double|Boolean|Object|List|Map|Set|Array|ArrayList|HashMap|HashSet)\b/g, className: 'hljs-type' });
                break;
            case 'go':
                // Comments
                patterns.push({ regex: /\/\/.*$/gm, className: 'hljs-comment' });
                patterns.push({ regex: /\/\*[\s\S]*?\*\//g, className: 'hljs-comment' });
                addCommon();
                // Keywords
                patterns.push({ regex: /\b(package|import|func|return|if|else|for|range|switch|case|default|break|continue|go|defer|chan|select|type|struct|interface|map|var|const|nil|true|false|make|new|len|cap|append|copy|delete|panic|recover)\b/g, className: 'hljs-keyword' });
                // Types
                patterns.push({ regex: /\b(string|int|int8|int16|int32|int64|uint|uint8|uint16|uint32|uint64|float32|float64|bool|byte|rune|error)\b/g, className: 'hljs-type' });
                break;
            case 'rust':
                // Comments
                patterns.push({ regex: /\/\/.*$/gm, className: 'hljs-comment' });
                patterns.push({ regex: /\/\*[\s\S]*?\*\//g, className: 'hljs-comment' });
                addCommon();
                // Keywords
                patterns.push({ regex: /\b(fn|let|mut|const|static|if|else|match|loop|while|for|in|break|continue|return|struct|enum|impl|trait|type|pub|mod|use|crate|self|super|where|async|await|move|ref|true|false|Some|None|Ok|Err)\b/g, className: 'hljs-keyword' });
                // Types
                patterns.push({ regex: /\b(i8|i16|i32|i64|i128|u8|u16|u32|u64|u128|f32|f64|bool|char|str|String|Vec|Option|Result|Box|Rc|Arc)\b/g, className: 'hljs-type' });
                // Macros
                patterns.push({ regex: /[a-z_]+!/g, className: 'hljs-built_in' });
                break;
            case 'yaml':
                // Comments
                patterns.push({ regex: /#.*$/gm, className: 'hljs-comment' });
                addCommon();
                // Keys
                patterns.push({ regex: /^[a-zA-Z_][a-zA-Z0-9_-]*(?=:)/gm, className: 'hljs-attr' });
                // Literals
                patterns.push({ regex: /\b(true|false|null|yes|no|on|off)\b/gi, className: 'hljs-literal' });
                break;
            default:
                // No highlighting for unknown languages
                return null;
        }
        return patterns;
    }
    return {
        enterEditMode,
        enterDisplayMode,
        convertToSpecialBlock,
        applyHighlighting,
        getHighlightPatterns,
        SUPPORTED_LANGUAGES,
        LANGUAGE_ALIASES,
        LANGUAGE_NAMES,
        codeLanguageName,
        orderedCodeLanguages
    };
}
// Construction defines capabilities; bootstrap controls the original initialization order.
function createCodeContentController(dependencies) {
    let codeBlocksWithSentinel, enterEditMode, enterDisplayMode, convertToSpecialBlock, applyHighlighting, getHighlightPatterns, SUPPORTED_LANGUAGES, LANGUAGE_ALIASES, LANGUAGE_NAMES, codeLanguageName, orderedCodeLanguages;
    let initializeCodeBlocksWithSentinelDone = false;
    function initializeCodeBlocksWithSentinel() {
        if (initializeCodeBlocksWithSentinelDone)
            return;
        initializeCodeBlocksWithSentinelDone = true;
        (codeBlocksWithSentinel = new WeakSet());
    }
    let initializeEnterEditMode1Done = false;
    function initializeEnterEditMode1() {
        if (initializeEnterEditMode1Done)
            return;
        initializeEnterEditMode1Done = true;
        ({ enterEditMode, enterDisplayMode, convertToSpecialBlock, applyHighlighting, getHighlightPatterns,
            SUPPORTED_LANGUAGES, LANGUAGE_ALIASES, LANGUAGE_NAMES, codeLanguageName, orderedCodeLanguages
        } = createCodeContent({
            editor: dependencies.editor, logger: dependencies.logger, i18n: dependencies.i18n, document, window, codeBlocksWithSentinel,
            getCodePlainText: (...args) => dependencies.getCodePlainText(...args),
            stripSentinelAndRebuildCode: (...args) => dependencies.stripSentinelAndRebuildCode(...args),
            stripTrailingNewlines: (...args) => dependencies.stripTrailingNewlines(...args), escapeHtml: dependencies.escapeHtml,
            renderMermaidDiagram: (...args) => dependencies.renderMermaidDiagram(...args), renderMathBlock: (...args) => dependencies.renderMathBlock(...args),
            setCursorToEnd: (...args) => dependencies.setCursorToEnd(...args), syncMarkdown: (...args) => dependencies.syncMarkdown(...args),
            syncMarkdownSync: (...args) => dependencies.syncMarkdownSync(...args)
        }));
    }
    return {
        get codeBlocksWithSentinel() { return codeBlocksWithSentinel; }, set codeBlocksWithSentinel(value) { codeBlocksWithSentinel = value; },
        get enterEditMode() { return enterEditMode; }, set enterEditMode(value) { enterEditMode = value; },
        get enterDisplayMode() { return enterDisplayMode; }, set enterDisplayMode(value) { enterDisplayMode = value; },
        get convertToSpecialBlock() { return convertToSpecialBlock; }, set convertToSpecialBlock(value) { convertToSpecialBlock = value; },
        get applyHighlighting() { return applyHighlighting; }, set applyHighlighting(value) { applyHighlighting = value; },
        get getHighlightPatterns() { return getHighlightPatterns; }, set getHighlightPatterns(value) { getHighlightPatterns = value; },
        get SUPPORTED_LANGUAGES() { return SUPPORTED_LANGUAGES; }, set SUPPORTED_LANGUAGES(value) { SUPPORTED_LANGUAGES = value; },
        get LANGUAGE_ALIASES() { return LANGUAGE_ALIASES; }, set LANGUAGE_ALIASES(value) { LANGUAGE_ALIASES = value; },
        get LANGUAGE_NAMES() { return LANGUAGE_NAMES; }, set LANGUAGE_NAMES(value) { LANGUAGE_NAMES = value; },
        get codeLanguageName() { return codeLanguageName; }, set codeLanguageName(value) { codeLanguageName = value; },
        get orderedCodeLanguages() { return orderedCodeLanguages; }, set orderedCodeLanguages(value) { orderedCodeLanguages = value; },
        initializeCodeBlocksWithSentinel,
        initializeEnterEditMode1
    };
}
module.exports = { createCodeContent, createCodeContentController };
