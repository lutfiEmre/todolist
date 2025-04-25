import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { Task } from '@/types';

const FILE = path.join(process.cwd(), 'data', 'tasks.json');

/* ---------- Helpers ---------- */
async function readTasks(): Promise<Task[]> {
    try {
        const raw = await fs.readFile(FILE, 'utf-8');
        return raw.trim() ? JSON.parse(raw) : [];
    } catch (err :any) {
        if (err.code === 'ENOENT') return [];
        console.error('tasks.json parse hatası:', err);
        return [];""
    }
}

async function writeTasks(list: Task[]) {
    await fs.mkdir(path.dirname(FILE), { recursive: true });
    await fs.writeFile(FILE, JSON.stringify(list, null, 2));
}

/* ---------- GET  (?status=todo/…) ---------- */
export async function GET(req: NextRequest) {
    const status = req.nextUrl.searchParams.get('status');
    const list   = await readTasks();
    return NextResponse.json(
        status ? list.filter(t => t.status === status) : list
    );
}

/* ---------- POST (yeni görev) --------------- */
export async function POST(req: NextRequest) {
    const task: Task = await req.json();
    const list = await readTasks();
    list.push(task);
    await writeTasks(list);
    return NextResponse.json(task, { status: 201 });
}

/* ---------- PUT  (id ile kısmi update) ------ */
export async function PUT(req: NextRequest) {
    const idParam = req.nextUrl.searchParams.get('id');
    if (!idParam) {
        return NextResponse.json({ error: 'id parametresi eksik' }, { status: 400 });
    }
    const id    = Number(idParam);
    const patch = await req.json();               // { status:'doing', ... }

    const list = await readTasks();
    const idx  = list.findIndex(t => t.id === id);
    if (idx === -1) {
        return NextResponse.json({ error: 'Görev bulunamadı' }, { status: 404 });
    }

    list[idx] = { ...list[idx], ...patch };
    await writeTasks(list);
    return NextResponse.json(list[idx]);          // 200 OK
}
