'use strict';
const fs = require('node:fs/promises');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

async function toolFixture(directory, kind, receipt = '', ast = null) {
    if (process.platform === 'win32') {
        const file = path.join(directory, 'test executable.exe');
        const compiler = path.join(process.env.WINDIR, 'Microsoft.NET', 'Framework64', 'v4.0.30319', 'csc.exe');
        execFileSync(compiler, ['/nologo', '/target:exe', '/reference:System.Web.Extensions.dll', '/out:' + file,
            path.resolve(__dirname, '../fixtures/tool-worker.cs')], { stdio: 'pipe', timeout: 30000 });
        await fs.writeFile(file + '.fixture', kind + '\n' + receipt + '\n' + JSON.stringify(ast) + '\n');
        return file;
    }
    const controlled = `const fs=require('node:fs');const argument=process.argv[2];if(argument==='--version')console.log('pandoc 3.8.3');else if(argument==='--list-input-formats')console.log('commonmark_x\\njson');else if(argument==='--list-output-formats')console.log('json\\ndocx\\nepub');else if(argument==='--list-extensions=commonmark_x')console.log('+tex_math_gfm');else{fs.writeFileSync(${JSON.stringify(receipt)},String(process.pid));`;
    const programs = {
        echo: 'process.stdout.write(JSON.stringify(process.argv.slice(2)));',
        'incomplete-pandoc': `const argument = process.argv[2]; process.stdout.write(argument === '--version' ? 'pandoc 3.8.3\\n' : argument === '--list-input-formats' ? 'commonmark_x\\njson\\n' : 'html\\n');`,
        hang: `if (process.argv[2]) require('node:fs').writeFileSync(process.argv[2], String(process.pid)); process.on('SIGTERM', () => {}); setInterval(() => {}, 1000);`,
        'fail-pandoc': `require('node:fs').writeFileSync(${JSON.stringify(receipt)}, process.cwd()); process.stderr.write('Controlled converter failure'); process.exitCode = 4;`,
        'controlled-pandoc': controlled + 'process.stdin.resume();setInterval(()=>{},1000)}',
        'controlled-pandoc-fail': controlled + "console.error('CONTROLLED-WRITER-FAILURE');process.exit(2)}",
        'ast-pandoc': `const fs=require('node:fs'), args=process.argv.slice(2), input=fs.readFileSync(0,'utf8'); if(args.includes('--to=json'))process.stdout.write(${JSON.stringify(JSON.stringify(ast))});else{fs.writeFileSync(${JSON.stringify(receipt)},JSON.stringify({args,ast:JSON.parse(input)}));fs.writeFileSync(args.find(a=>a.startsWith('--output=')).slice(9),Buffer.from([80,75,3,4]));}`
    };
    if (!(kind in programs)) throw new Error('Unknown test worker');
    const file = path.join(directory, 'test executable');
    await fs.writeFile(file, `#!${process.execPath}\n${programs[kind]}\n`, { mode: 0o700 });
    return file;
}

module.exports = { toolFixture };
