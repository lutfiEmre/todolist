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
    useDroppable,
    rectIntersection,
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

export type Status = 'todo' | 'doing' | 'inreview' | 'done';
interface TaskCardProps {
    task: Task;
    dragOverlay?: boolean;
    deleteTask: any;
    incrementPercent: (t: Task, inc: number) => void;

}
export interface Task {
    id: number;
    category: string;
    name: string;
    successPercent: number;
    importance: number; // 1-5
    timeline: string;
    status: Status;
    order: number;
}

export interface Comment {
    id: number;
    taskId: number;
    author: string;
    message: string;
    date: string;
}

const TITLE: Record<Status, string> = {
    todo: 'Todo',
    doing: 'Doing',
    inreview: 'In Review',
    done: 'Done',
};

const KanbanBoard: React.FC = () => {
    const [tasks, setTasks] = useState<Record<Status, Task[]>>({
        todo: [],
        doing: [],
        inreview: [],
        done: [],
    });


    const [modalStatus, setModalStatus] = useState<Status | null>(null);
    const [formCategory, setFormCategory] = useState('');
    const [formName, setFormName] = useState('');
    const [formPercent, setFormPercent] = useState<number | undefined>();
    const [formImportance, setFormImportance] = useState<number | undefined>();
    const [formTimeline, setFormTimeline] = useState<number | undefined>();
    const [formInitialComment, setFormInitialComment] = useState('');
    const [activeTask, setActiveTask] = useState<Task | null>(null);
    const handleDeleteTask = async (task: Task) => {
        // 1) State’ten çıkar
        setTasks(prev => ({
            ...prev,
            [task.status]: prev[task.status].filter(t => t.id !== task.id),
        }));
        // 2) API çağrısı
        try {
            await fetch(`/api/tasks?id=${task.id}`, { method: 'DELETE' });
            // 3) Order’ı güncelle
            const remaining = tasks[task.status].filter(t => t.id !== task.id);
            await persistOrder(task.status, remaining);
        } catch (err) {
            console.error(err);
        }
    };

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

    const handleIncrementPercent = async (task: Task, inc: number) => {
        const newPct = Math.min(100, Math.max(0, task.successPercent + inc));
        const from = task.status;
        const to: Status = newPct === 100 ? 'done' : from;

        // Bu iki listeyi aşağıda persistOrder için kullanacağız
        let newSrc: Task[];
        let newDest: Task[];

        setTasks(prev => {
            // 1) Kaynaktan çıkar
            const srcList = prev[from].filter(t => t.id !== task.id);

            if (to === from) {
                // Aynı sütunda sadece yüzdelik güncelle
                const updated = prev[from].map(t =>
                    t.id === task.id ? { ...t, successPercent: newPct } : t
                );
                // order'ları koru ya da yeniden sıralamak istiyorsan:
                newSrc = updated.map((t, i) => ({ ...t, order: i }));
                return { ...prev, [from]: newSrc };
            } else {
                // 2) Yeni sütuna, listenin en başına ekle
                const movedTask: Task = { ...task, successPercent: newPct, status: to };
                newDest = [movedTask, ...prev[to]].map((t, i) => ({ ...t, order: i }));

                // 3) Kaynak sütunda order'ları yeniden ayarla
                newSrc = srcList.map((t, i) => ({ ...t, order: i }));

                return {
                    ...prev,
                    [from]: newSrc,
                    [to]: newDest
                };
            }
        });

        try {
            // 4) Backend'e güncelleme
            await fetch(`/api/tasks?id=${task.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    successPercent: newPct,
                    ...(to !== from && { status: to })
                })
            });

            // 5) Order değişikliklerini kaydet
            if (to !== from) {
                await persistOrder(from, newSrc);
                await persistOrder(to, newDest);
            }
        } catch (err) {
            console.error('Percent/status update error:', err);
        }
    };
    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over) return;
        console.log('🕵️ over.id:', over?.id);
        // fromSt ve fromId her zaman "status:id" formatında
        const [fromSt, fromIdStr] = active.id.toString().split(':') as [Status, string];

        // toSt/toId ya "status:id", ya da sadece "status" (boş listede)
        let toSt: Status;
        let toId: string | null;
        if (over.id.toString().includes(':')) {
            [toSt, toId] = over.id.toString().split(':') as [Status, string];
        } else {
            toSt = over.id as Status;
            toId = null;
        }


        if (fromSt === toSt && toId === fromIdStr) return;


        const src = [...tasks[fromSt]];
        const dest = fromSt === toSt ? src : [...tasks[toSt]];


        const movedIdx = src.findIndex(t => t.id === +fromIdStr);
        const [moved] = src.splice(movedIdx, 1);


        const insertAt = toId
            ? dest.findIndex(t => t.id === +toId)
            : dest.length;

        dest.splice(insertAt, 0, { ...moved, status: toSt });


        dest.forEach((t, i) => (t.order = i));
        if (fromSt !== toSt) src.forEach((t, i) => (t.order = i));


        setTasks(prev => ({
            ...prev,
            [fromSt]: src,
            [toSt]: dest
        }));


        if (fromSt !== toSt) {
            await fetch(`/api/tasks?id=${fromIdStr}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status: toSt })
            }).catch(console.error);
        }

        // order’ları persist et
        await persistOrder(toSt, dest);
        if (fromSt !== toSt) {
            await persistOrder(fromSt, src);
        }
    };




    const isPercentValid = Number.isFinite(formPercent) && (formPercent as number) >= 0 && (formPercent as number) <= 100;
    const isImportanceValid = Number.isFinite(formImportance) && (formImportance as number) >= 1 && (formImportance as number) <= 5;
    const isTimelineValid = Number.isFinite(formTimeline) && (formTimeline as number) >= 1;
    const isFormValid = (): boolean =>
        formCategory.trim().length > 0 &&
        formName.trim().length   > 0 &&
        isPercentValid &&
        isImportanceValid &&
        isTimelineValid;

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


    return (
        <DndContext sensors={sensors} onDragStart={handleDragStart} collisionDetection={rectIntersection} onDragEnd={handleDragEnd}>
            <div className="grid noscrollbar  grid-cols-4 overflow-y-scroll overflow-x-visible h-full gap-3 lg:gap-4">
                {(Object.keys(TITLE) as Status[]).map(status => (
                    <Column incrementPercent={handleIncrementPercent} key={status} status={status} tasks={tasks[status]} deleteTask={handleDeleteTask} openAdd={setModalStatus} />
                ))}
            </div>
            <DragOverlay dropAnimation={null}>
                {activeTask && <TaskCard task={activeTask}  deleteTask={handleDeleteTask} dragOverlay />}
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

interface ColumnProps {
    status: Status;
    incrementPercent: (t: Task, inc: number) => void;
    tasks: Task[];
    openAdd: (s: Status) => void;
    deleteTask: (task: Task) => void;
}
export const Column: React.FC<ColumnProps> = ({
                                                  status,
                                                  tasks,
                                                  openAdd,
                                                  deleteTask,
                                                  incrementPercent
                                              }) => {
    // 1) Kolonu droppable olarak kaydet
    const { setNodeRef } = useDroppable({ id: status });

    return (
        <div
            ref={setNodeRef}
            className="w-full p-4 bg-[#F9FAFC] rounded min-h-[200px] flex flex-col"
        >
            {/* Başlık */}
            <div className="flex justify-between items-center mb-4">
                <h6 className="poppins-semibold text-xl">{TITLE[status]}</h6>
                <button onClick={() => openAdd(status)} className="text-2xl">＋</button>
            </div>

            {/* 2) SortableContext + placeholder */}
            <SortableContext
                items={tasks.map(t => `${status}:${t.id}`)}
                strategy={verticalListSortingStrategy}
            >
                {tasks.length > 0 ? (
                    tasks.map(task => (
                        <TaskCard
                            key={task.id}
                            task={task}
                            deleteTask={deleteTask}
                            incrementPercent={incrementPercent}
                        />
                    ))
                ) : (
                    // İçerik yoksa bu boş kutuyu görecek, drop burada tetiklenecek
                    tasks.length === 0 && (
                            <div
                                className="flex-1 flex items-center justify-center italic text-gray-400 pointer-events-none"
                            >
                                Drop here…
                            </div>
                        )
                )}
            </SortableContext>
        </div>
    );
};
const TaskCard: React.FC<TaskCardProps> = ({ task, dragOverlay, deleteTask , incrementPercent  }) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: `${task.status}:${task.id}` });

    const [confirming, setConfirming] = useState(false);
    const [pctMenuOpen, setPctMenuOpen] = useState(false);
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
        const playClickSound = () => {
            const audio = new Audio('/frog.mp3');
            !pctMenuOpen &&  audio.play().catch(console.error);

        };
        const playCloseClickSound = () => {
            const audio = new Audio('/village.mp3');
            !pctMenuOpen &&  audio.play().catch(console.error);

        };
    const wrapperProps = dragOverlay ? {} : { ...attributes, ...listeners };
    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            {...wrapperProps}
            className={`
            ${task.successPercent === 100 ? "effect-flame" : ""}
    relative bg-white shadow-md rounded-[25px] p-5 pb-3 flex flex-col mb-5 select-none
   
  `}
            >

            {confirming && (
                <div className="absolute inset-0 z-40 bg-white bg-opacity-90 flex flex-col items-center justify-center p-4 rounded-[25px]">
                    <p className="text-center">Are u sure delete for "{task.name}"?</p>
                    <div className="flex gap-2 mt-2">
                        <button
                            onPointerDown={e => e.stopPropagation()}
                            onClick={() => deleteTask(task)}
                            className="px-2 py-1 cursor-pointer bg-red-500 text-white rounded"
                        >
                            Delete
                        </button>
                        <button
                            onPointerDown={e => e.stopPropagation()}
                            onClick={() => setConfirming(false)}
                            className="px-2 py-1 cursor-pointer bg-gray-300 rounded"
                        >
                            nope
                        </button>
                    </div>
                </div>
            )}
            <div  className="absolute  flex flex-row items-center justify-center gap-2 top-4 right-4 text-xl  text-red-500 font-bold">
                <button
                    onPointerDown={e => e.stopPropagation()}
                    onClick={() => {
                        setConfirming(true)
                        playCloseClickSound()
                    }}
                    className=" z-30 top-4 right-4 text-xl cursor-pointer text-red-500 font-bold"
                >
                    &times;
                </button>
                <div className={''}>

                    <svg className="svg-icon cursor-pointer relative z-30 w-[25px] h-[25px]" onPointerDown={e => e.stopPropagation()}
                         onClick={() => {

                             setPctMenuOpen(o => !o)
                             playClickSound()
                         }} width="800px" height="800px" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg"
                         xmlnsXlink="http://www.w3.org/1999/xlink" aria-hidden="true" role="img"
                         preserveAspectRatio="xMidYMid meet">
                        <path fill="#3AAA3A"
                              d="M454.896 301.923c0 83.213-89.29 150.671-199.434 150.671S56.028 385.136 56.028 301.923c0 0 89.29 10.861 199.434 10.861s199.434-10.861 199.434-10.861z"></path>
                        <path fill="#2B3B47"
                              d="M167.093 352.872l191.077-5.046s-4.212 49.198-102.256 49.198s-88.821-44.152-88.821-44.152z"></path>
                        <path fill="#0C0"
                              d="M466.825 294.783c0-35.526-18.398-68.082-48.965-93.388a76.116 76.116 0 0 0 3.947-24.21c0-42.113-34.139-76.252-76.252-76.252c-32.329 0-59.938 20.129-71.032 48.529a309.08 309.08 0 0 0-19.063-.597c-6.068 0-12.073.187-18.012.533c-11.11-28.366-38.702-48.465-71.006-48.465c-42.113 0-76.252 34.139-76.252 76.252c0 8.21 1.313 16.111 3.714 23.521c-31.069 25.403-49.808 58.227-49.808 94.077c0 5.933 5.923 16.55 5.923 16.55c81.37 99.21 175.541 47.75 205.893 47.75s124.523 50.956 204.321-47.75l-.017-.002c4.282-5.076 6.609-10.59 6.609-16.548z"></path>
                        <path fill="#3B933F"
                              d="M214.316 307.25c0 5.827-4.723 10.55-10.55 10.55s-10.55-4.723-10.55-10.55s4.723-10.55 10.55-10.55s10.55 4.723 10.55 10.55zm92.842-10.55c-5.827 0-10.55 4.723-10.55 10.55s4.723 10.55 10.55 10.55s10.55-4.723 10.55-10.55s-4.723-10.55-10.55-10.55z"></path>
                        <path fill="#2B3B47"
                              d="M166.444 137.095c13.578 0 24.585 11.007 24.585 24.585v30.221c0 13.578-11.007 24.585-24.585 24.585c-13.578 0-24.585-11.007-24.585-24.585V161.68c0-13.578 11.007-24.585 24.585-24.585zm179.112 0c-13.578 0-24.585 11.007-24.585 24.585v30.221c0 13.578 11.007 24.585 24.585 24.585c13.578 0 24.585-11.007 24.585-24.585V161.68c0-13.578-11.007-24.585-24.585-24.585z"></path>
                    </svg>
                    {pctMenuOpen && (
                        <ul className="absolute right-0 bg-white shadow-lg rounded  z-40">
                            {[-50,-15, -10, -5, 5, 10, 15,100].map(delta => (
                                <li
                                    key={delta}
                                    onPointerDown={e => e.stopPropagation()}
                                    onClick={() => {
                                        incrementPercent(task, delta);
                                        setPctMenuOpen(false);
                                    }}
                                    className="px-3 py-1 hover:bg-gray-100 cursor-pointer text-sm"
                                >
                                    {delta > 0 ? (
                                        <div className={` ${delta === 100 ? "!text-[#3B933F]" : "!text-blue-600"}  cursor-pointer`}>
                                            +{delta}
                                        </div>
                                    ) : delta}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>


            <div className={`p-2 rounded-[30px] w-fit ${importanceBg}`}>
                <p className="text-xs">{task.category}</p>
            </div>

            <h6 className="mt-4 poppins-semibold text-[16px]">{task.name}</h6>


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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-sm">
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


            <div className="flex justify-end gap-2">
                <button className="px-4 py-2 bg-gray-200 rounded" onClick={onCancel}>İptal</button>
                <button disabled={!isFormValid} className={`px-4 py-2 rounded text-white ${isFormValid ? 'bg-[#1161FF] hover:bg-[#0d4cd9]' : 'bg-gray-400 cursor-not-allowed'}`} onClick={onSubmit}>Ekle</button>
            </div>
        </div>
    </div>
);

export default KanbanBoard;
