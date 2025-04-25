/*
 * Drag-and-Drop Kanban board (z-index fix + full modal) – TypeScript / React 18
 * ────────────────────────────────────────────────────────────────────────────
 * - Adds z-20 while dragging so cards aren’t clipped.
 * - Keeps “+” button per column with Add-Task modal.
 * - Fully self-contained component; drop into Next.js project.
 *
 * Install deps:
 *   npm i @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
 */

'use client';
import React, { useEffect, useState } from 'react';
import {
    DndContext,
    PointerSensor,
    closestCorners,
    useSensor,
    useSensors,

    DragEndEvent,
    DragStartEvent,
    DragOverlay
} from '@dnd-kit/core';
import {
    SortableContext,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/* ------------------------------------------------------------------
 * Types
 * ------------------------------------------------------------------*/
export type Status = 'todo' | 'doing' | 'inreview' | 'done';
interface TaskCardProps {
    task: Task;
    dragOverlay?: boolean;   // 🆕
}
export interface Task {
    id: number;
    category: string;
    name: string;
    successPercent: number;
    importance: number; // 1-5
    timeline: string;   // "6 days"
    status: Status;
    order: number;
}

export interface Comment {
    id: number;
    taskId: number;
    author: string;
    message: string;
    date: string; // YYYY-MM-DD
}

const TITLE: Record<Status, string> = {
    todo: 'Todo',
    doing: 'Doing',
    inreview: 'In Review',
    done: 'Done',
};

/* ------------------------------------------------------------------
 * Main component
 * ------------------------------------------------------------------*/
const KanbanBoard: React.FC = () => {
    const [tasks, setTasks] = useState<Record<Status, Task[]>>({
        todo: [],
        doing: [],
        inreview: [],
        done: [],
    });

    /* ---------- Add-task modal state ---------- */
    const [modalStatus, setModalStatus] = useState<Status | null>(null);
    const [formCategory, setFormCategory] = useState('');
    const [formName, setFormName] = useState('');
    const [formPercent, setFormPercent] = useState<number | undefined>();
    const [formImportance, setFormImportance] = useState<number | undefined>();
    const [formTimeline, setFormTimeline] = useState<number | undefined>();
    const [formInitialComment, setFormInitialComment] = useState('');
    const [activeTask, setActiveTask] = useState<Task | null>(null);

    /* ---------- Fetch once ---------- */
    useEffect(() => {
        (async () => {
            const statuses: Status[] = ['todo', 'doing', 'inreview', 'done'];
            const grouped: Partial<Record<Status, Task[]>> = {};

            await Promise.all(
                statuses.map(async s => {
                    const res = await fetch(`/api/tasks?status=${s}`);
                    if (!res.ok) {                     // 200 değilse ⇒ anlamlı log
                        const txt = await res.text();    // (hata JSON da olabilir)
                        throw new Error(`GET /api/tasks?status=${s} → ${res.status}\n${txt}`);
                    }
                    const list = (await res.json()) as Task[];
                    grouped[s] = list.sort((a, b) => a.order - b.order);
                }),
            );


            setTasks(grouped as Record<Status, Task[]>);
        })().catch(console.error);               // network hatalarını konsola bas
    }, []);

    /* ---------- dnd-kit ---------- */
    const sensors = useSensors(useSensor(PointerSensor));

    const persistOrder = (st: Status, list: Task[]) =>
        fetch('/api/tasks/order', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                status: st,
                orderedIds: list.map((t, i) => ({ id: t.id, order: i })),
            }),
        }).catch(console.error);

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;

        const [fromSt, fromId] = active.id.toString().split(':') as [Status, string];
        const [toSt,   toId]   = over.id.toString().split(':')   as [Status, string];

        if (fromSt === toSt && fromId === toId) return;

        setTasks(prev => {
            const src  = [...prev[fromSt]];
            const dest = fromSt === toSt ? src : [...prev[toSt]];

            const movedIdx = src.findIndex(t => t.id === +fromId);
            const [moved]  = src.splice(movedIdx, 1);

            const hoverIdx = dest.findIndex(t => t.id === +toId);
            const insertAt = hoverIdx === -1 ? dest.length : hoverIdx;
            dest.splice(insertAt, 0, { ...moved, status: toSt });

            // yeni order alanlarını yaz
            dest.forEach((t, i) => (t.order = i));
            if (fromSt !== toSt) src.forEach((t, i) => (t.order = i));

            // Persist
            persistOrder(toSt, dest);
            if (fromSt !== toSt) persistOrder(fromSt, src);

            // Status değiştiyse ayrıca PATCH et
            if (fromSt !== toSt) {
                fetch(`/api/tasks?id=${fromId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ status: toSt }),
                }).catch(console.error);
            }

            return { ...prev, [fromSt]: src, [toSt]: dest };
        });
    };


    /* ---------- Add-task helpers ---------- */
    const isPercentValid = Number.isFinite(formPercent) && (formPercent as number) >= 0 && (formPercent as number) <= 100;
    const isImportanceValid = Number.isFinite(formImportance) && (formImportance as number) >= 1 && (formImportance as number) <= 5;
    const isTimelineValid = Number.isFinite(formTimeline) && (formTimeline as number) >= 1;
    const isFormValid = () =>
        formCategory.trim() && formName.trim() && isPercentValid && isImportanceValid && isTimelineValid;

    const resetForm = () => {
        setFormCategory('');
        setFormName('');
        setFormPercent(undefined);
        setFormImportance(undefined);
        setFormTimeline(undefined);
        setFormInitialComment('');
    };

    const handleAddTask = async () => {
        if (!modalStatus || !isFormValid()) return;

        const newTask: Task = {
            id: Date.now(),
            category: formCategory,
            name: formName,
            successPercent: formPercent as number,
            importance: formImportance as number,
            timeline: `${formTimeline} days`,
            status: modalStatus,
            order: 0,
        };

        setTasks(prev => ({ ...prev, [modalStatus]: [newTask, ...prev[modalStatus]] }));

        /* optional first comment */
        if (formInitialComment.trim()) {
            const firstComment: Comment = {
                id: Date.now(),
                taskId: newTask.id,
                author: 'Current User',
                message: formInitialComment,
                date: new Date().toISOString().split('T')[0],
            };
            fetch('/api/tasks/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(firstComment),
            }).catch(console.error);
        }

        try {
            await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTask),
            });
        } catch {
            alert('Görev kaydedilemedi');
        }

        resetForm();
        setModalStatus(null);
    };

    const handleDragStart = (e: DragStartEvent) => {
        const [st, id] = e.active.id.toString().split(':') as [Status, string];
        setActiveTask(tasks[st].find(t => t.id === +id) ?? null);
    };
    /* ---------- Render ---------- */
    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
            <div className="grid noscrollbar grid-cols-4 overflow-y-scroll overflow-x-visible h-full gap-4">
                {(Object.keys(TITLE) as Status[]).map(status => (
                    <Column key={status} status={status} tasks={tasks[status]} openAdd={setModalStatus} />
                ))}
            </div>
            <DragOverlay dropAnimation={null}>
                {activeTask && <TaskCard task={activeTask} dragOverlay />}
            </DragOverlay>
            {modalStatus && (
                <AddTaskModal
                    status={modalStatus}
                    title={TITLE[modalStatus]}
                    values={{
                        formCategory,
                        formName,
                        formPercent,
                        formImportance,
                        formTimeline,
                        formInitialComment,
                    }}
                    setters={{
                        setFormCategory,
                        setFormName,
                        setFormPercent,
                        setFormImportance,
                        setFormTimeline,
                        setFormInitialComment,
                    }}
                    onCancel={() => {
                        resetForm();
                        setModalStatus(null);
                    }}
                    onSubmit={handleAddTask}
                    isFormValid={isFormValid()}
                />
            )}
        </DndContext>
    );
};

/* ------------------------------------------------------------------
 * Column (droppable)
 * ------------------------------------------------------------------*/
interface ColumnProps {
    status: Status;
    tasks: Task[];
    openAdd: (s: Status) => void;
}


const Column: React.FC<ColumnProps> = ({ status, tasks, openAdd }) => (
    <div className="w-full h-full noscrollbar overflow-y-scroll overflow-x-visible p-4">
        <div className="sticky top-[-20px] z-10 bg-[#F0F5FF] flex justify-center items-center gap-4  mb-4 py-2">
            <h6 className="poppins-semibold text-[25px]">{TITLE[status]}</h6>
            <svg onClick={() => openAdd(status)} className="w-5 h-5 cursor-pointer" viewBox="0 0 12 12" fill="none">
                <path d="M6 6V1M6 6V11M6 6H11M6 6H1" stroke="#161A3E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </div>

        <SortableContext id={status} items={tasks.map(t => `${status}:${t.id}`)} strategy={verticalListSortingStrategy}>
            {tasks.map(task => (
                <TaskCard key={task.id} task={task} />
            ))}
        </SortableContext>
    </div>
);

/* ------------------------------------------------------------------
 * Task card (draggable)
 * ------------------------------------------------------------------*/
const TaskCard: React.FC<TaskCardProps> = ({ task, dragOverlay = false }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: `${task.status}:${task.id}` });

    const importanceBg =
        task.importance === 1 ? 'bg-[#ECF2FF] text-black' :
            task.importance === 2 ? 'bg-[#BBFFA7] text-black' :
                task.importance === 3 ? 'bg-[#1161FF] text-white' :
                    task.importance === 4 ? 'bg-[#A530FF] text-white' :
                        'bg-[#FF4E51] text-white';

    const style: React.CSSProperties = {
        transform: CSS.Transform.toString(transform),
        transition,
        zIndex: isDragging ? 20 : undefined,
    };
    const wrapperProps = dragOverlay ? {} : { ...attributes, ...listeners };
    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            {...wrapperProps}
            className="bg-white shadow-md rounded-[25px] p-5 pb-3 flex flex-col mb-5 select-none"
        >
            {/* Category pill */}
            <div className={`p-2 rounded-[30px] w-fit ${importanceBg}`}>
                <p className="text-xs">{task.category}</p>
            </div>

            <h6 className="mt-4 poppins-semibold text-[16px]">{task.name}</h6>

            {/* Progress bar */}
            <div className="mt-2 flex flex-col gap-1">
                <div className="flex justify-end text-xs">%{task.successPercent}</div>
                <div className="relative h-[7px]">
                    <div
                        className={`absolute h-full rounded-[10px] ${importanceBg.split(' ')[0]}`}
                        style={{ width: `${task.successPercent}%` }}
                    />
                    <div className="bg-[#DEE0FC] h-full rounded-[10px]" />
                </div>
            </div>

            <div className="flex justify-between mt-4 text-xs">
                <p>Importance: {task.importance}</p>
                <p>{task.timeline}</p>
            </div>
        </div>
    );
};

/* ------------------------------------------------------------------
 * Modal component
 * ------------------------------------------------------------------*/
interface AddTaskModalProps {
    status: Status;
    title: string;
    values: {
        formCategory: string;
        formName: string;
        formPercent: number | undefined;
        formImportance: number | undefined;
        formTimeline: number | undefined;
        formInitialComment: string;
    };
    setters: {
        setFormCategory: React.Dispatch<React.SetStateAction<string>>;
        setFormName: React.Dispatch<React.SetStateAction<string>>;
        setFormPercent: React.Dispatch<React.SetStateAction<number | undefined>>;
        setFormImportance: React.Dispatch<React.SetStateAction<number | undefined>>;
        setFormTimeline: React.Dispatch<React.SetStateAction<number | undefined>>;
        setFormInitialComment: React.Dispatch<React.SetStateAction<string>>;
    };
    onCancel: () => void;
    onSubmit: () => void;
    isFormValid: boolean;
}

const AddTaskModal: React.FC<AddTaskModalProps> = ({ status, title, values, setters, onCancel, onSubmit, isFormValid }) => (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/30 backdrop-blur-sm">
        <div className="bg-white p-6 rounded-[20px] w-[400px]">
            <h6 className="poppins-semibold text-lg mb-4">Yeni Görev Ekle — {title}</h6>

            <label className="block text-sm mb-1">Konu Başlığı</label>
            <input className="w-full border border-gray-300 rounded p-2 mb-3" value={values.formCategory} onChange={e => setters.setFormCategory(e.target.value)} />

            <label className="block text-sm mb-1">Todo İsmi</label>
            <input className="w-full border border-gray-300 rounded p-2 mb-3" value={values.formName} onChange={e => setters.setFormName(e.target.value)} />

            <label className="block text-sm mb-1">% Tamamlanma</label>
            <input type="number" min={0} max={100} value={values.formPercent ?? ''} onChange={e => setters.setFormPercent(e.target.valueAsNumber)} className="w-full border border-gray-300 rounded p-2 mb-1" />
            {!Number.isFinite(values.formPercent) && <p className="text-xs text-red-600 mb-2">0-100 arası</p>}

            <label className="block text-sm mb-1">Importance (1-5)</label>
            <input type="number" min={1} max={5} value={values.formImportance ?? ''} onChange={e => setters.setFormImportance(e.target.valueAsNumber)} className="w-full border border-gray-300 rounded p-2 mb-1" />
            {!Number.isFinite(values.formImportance) && <p className="text-xs text-red-600 mb-2">1-5 arası</p>}

            <label className="block text-sm mb-1">Timeline (gün)</label>
            <input type="number" min={1} value={values.formTimeline ?? ''} onChange={e => setters.setFormTimeline(e.target.valueAsNumber)} className="w-full border border-gray-300 rounded p-2 mb-1" />
            {!Number.isFinite(values.formTimeline) && <p className="text-xs text-red-600 mb-2">En az 1 gün</p>}

            <label className="block text-sm mb-1">İlk Yorum (opsiyonel)</label>
            <textarea className="w-full border border-gray-300 rounded p-2 mb-4 resize-none" rows={2} value={values.formInitialComment} onChange={e => setters.setFormInitialComment(e.target.value)} />

            <div className="flex justify-end gap-2">
                <button className="px-4 py-2 bg-gray-200 rounded" onClick={onCancel}>İptal</button>
                <button disabled={!isFormValid} className={`px-4 py-2 rounded text-white ${isFormValid ? 'bg-[#1161FF] hover:bg-[#0d4cd9]' : 'bg-gray-400 cursor-not-allowed'}`} onClick={onSubmit}>Ekle</button>
            </div>
        </div>
    </div>
);

export default KanbanBoard;
