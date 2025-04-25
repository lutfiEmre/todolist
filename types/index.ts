// /types/index.ts  (veya projenizde nerede tanımlıysa)
export type Status = 'todo' | 'doing' | 'inreview' | 'done';

export interface Comment {
    id: number;
    taskId: number;
    author: string;
    message: string;
    date: string;
}
export interface Task {
    id: number;
    category: string;
    name: string;
    successPercent: number;
    importance: number;
    timeline: string;
    status: Status;
    /** drag-drop sırası (0 = en üst) */
    order: number;
}
