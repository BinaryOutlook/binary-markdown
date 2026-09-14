const codeLanguageNames = new Map(Object.entries({
    javascript: 'JavaScript', js: 'JavaScript', typescript: 'TypeScript', ts: 'TypeScript',
    python: 'Python', py: 'Python', json: 'JSON', bash: 'Bash', sh: 'Shell', shell: 'Shell', zsh: 'Zsh',
    css: 'CSS', html: 'HTML', htm: 'HTML', xml: 'XML', sql: 'SQL', java: 'Java', go: 'Go', rust: 'Rust',
    yaml: 'YAML', yml: 'YAML', markdown: 'Markdown', md: 'Markdown', c: 'C', cpp: 'C++', 'c++': 'C++',
    csharp: 'C#', cs: 'C#', 'c#': 'C#', php: 'PHP', ruby: 'Ruby', rb: 'Ruby', swift: 'Swift',
    kotlin: 'Kotlin', dockerfile: 'Dockerfile', docker: 'Dockerfile',
    plaintext: 'Plain text', text: 'Plain text', txt: 'Plain text'
}));
const codeControlClasses = new Set(['sourcecode', 'numberlines', 'number-lines', 'number', 'lineanchors', 'unnumbered']);

/** A declared fence language; control classes and missing labels are not languages. */
export function codeLanguageLabel(classes: readonly unknown[]): string | undefined {
    const language = classes.find((value): value is string =>
        typeof value === 'string' && value.length > 0 && !codeControlClasses.has(value.toLowerCase()));
    return language ? codeLanguageNames.get(language.toLowerCase()) || language : undefined;
}
