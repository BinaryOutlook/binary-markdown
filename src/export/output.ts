import { createHash } from 'crypto';
import * as fs from 'fs/promises';
import * as path from 'path';
import { checkCancelled, ExportFormat } from './types';

async function identical(file: string, bytes: Buffer): Promise<boolean> {
    try {
        const stat = await fs.stat(file);
        return stat.isFile() && stat.size === bytes.length && (await fs.readFile(file)).equals(bytes);
    } catch (error) {
        if (['ENOENT', 'EISDIR'].includes((error as NodeJS.ErrnoException).code || '')) {
            return false;
        }
        throw error;
    }
}

/** A hard-link claims the final name exclusively after all bytes have been written. */
export async function finalizeExport(
    sourcePath: string, format: ExportFormat, bytes: Buffer, signal: AbortSignal
): Promise<{ outputPath: string; reused: boolean }> {
    checkCancelled(signal);
    const directory = path.dirname(sourcePath);
    const stem = path.basename(sourcePath, path.extname(sourcePath));
    const temp = await fs.mkdtemp(path.join(directory, '.binary-markdown-export-'));
    const staged = path.join(temp, 'complete');
    try {
        await fs.writeFile(staged, bytes, { flag: 'wx', mode: 0o600 });
        const handle = await fs.open(staged, 'r+');
        try {
            await handle.sync();
        } finally {
            await handle.close();
        }
        const hash = createHash('sha256').update(bytes).digest('hex').slice(-8);
        let candidate = path.join(directory, stem + '.' + format);
        let suffix = 0;
        while (true) {
            checkCancelled(signal);
            try {
                await fs.link(staged, candidate);
                return { outputPath: candidate, reused: false };
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
                    throw error;
                }
            }
            if (suffix === 1 && await identical(candidate, bytes)) {
                checkCancelled(signal);
                return { outputPath: candidate, reused: true };
            }
            suffix++;
            candidate = path.join(directory, stem + '_' + hash +
                (suffix > 1 ? '_' + suffix : '') + '.' + format);
        }
    } finally {
        await fs.rm(temp, { recursive: true, force: true });
    }
}
