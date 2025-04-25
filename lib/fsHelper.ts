import { promises as fs } from 'fs';
import path from 'path';

export async function readJson<T>(filePath: string, fallback: T): Promise<T> {
    try {
        const raw = await fs.readFile(filePath, 'utf8');
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

export async function writeJson<T>(filePath: string, data: T) {
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}
