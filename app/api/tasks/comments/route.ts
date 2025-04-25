
import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { Comment } from '@/types';

const FILE_PATH = path.join(process.cwd(), 'data', 'comments.json');

function readComments(): Comment[] {
    try {
        const json = fs.readFileSync(FILE_PATH, 'utf8');
        return JSON.parse(json) as Comment[];
    } catch {
        return [];
    }
}

function writeComments(comments: Comment[]) {
    fs.mkdirSync(path.dirname(FILE_PATH), { recursive: true });
    fs.writeFileSync(FILE_PATH, JSON.stringify(comments, null, 2));
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'GET') {
        const taskId = parseInt(req.query.taskId as string);
        const all = readComments();
        const filtered = isNaN(taskId) ? [] : all.filter(c => c.taskId === taskId);
        return res.status(200).json(filtered);
    }

    if (req.method === 'POST') {
        const newComment: Comment = req.body;
        const comments = readComments();
        writeComments([...comments, newComment]);
        return res.status(201).json(newComment);
    }

    res.setHeader('Allow', ['GET', 'POST']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
}
