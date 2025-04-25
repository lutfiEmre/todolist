import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { Task } from '@/types';

const FILE = path.join(process.cwd(), 'data', 'tasks.json');


async function read(): Promise<Task[]> {
    try {
        const raw = await fs.readFile(FILE, 'utf-8');
        return raw.trim() ? JSON.parse(raw) : [];
    } catch (err: any) {
        if (err.code === 'ENOENT') return [];
        throw err;
    }
}
async function write(list: Task[]) {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(list, null, 2));
}


export async function PUT(req: NextRequest) {
    const { status, orderedIds } = await req.json() as {
        status: 'todo' | 'doing' | 'inreview' | 'done';
        orderedIds: { id: number; order: number }[];
    };

    const list       = await read();
    const sameStatus = list.filter(t => t.status === status);
    const other      = list.filter(t => t.status !== status);

    const byId = Object.fromEntries(orderedIds.map(o => [o.id, o.order]));
    sameStatus.forEach(t => {
        if (byId[t.id] !== undefined) t.order = byId[t.id];
    });
    sameStatus.sort((a, b) => a.order - b.order);

    await write([...other, ...sameStatus]);
    return NextResponse.json({ ok: true });
}
