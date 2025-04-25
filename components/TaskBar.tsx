'use client';
import React, { useEffect, useState } from 'react';
import { Task, Comment } from '@/types';

type Status = 'todo' | 'doing' | 'inreview' | 'done';

interface TaskBarProps {
    status: Status;
}

/* --- Başlıklar --- */
const TITLE: Record<Status, string> = {
    todo: 'Todo',
    doing: 'Doing',
    inreview: 'In Review',
    done: 'Done',
};

const TaskBar: React.FC<TaskBarProps> = ({ status }) => {
    /* ---------- STATE ---------- */
    const [tasks, setTasks] = useState<Task[]>([]);
    const [comments, setComments] = useState<Record<number, Comment[]>>({});
    const [activeCommentTaskId, setActiveCommentTaskId] = useState<number | null>(null);
    const [newComment, setNewComment] = useState('');

    /* --- Modal form --- */
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [formCategory, setFormCategory] = useState('');
    const [formName, setFormName] = useState('');
    const [formPercent, setFormPercent] = useState<number | undefined>();
    const [formImportance, setFormImportance] = useState<number | undefined>();
    const [formTimeline, setFormTimeline] = useState<number | undefined>();
    const [formInitialComment, setFormInitialComment] = useState('');

    /* ---------- DATA FETCH ---------- */
    useEffect(() => {
        fetch(`/api/tasks?status=${status}`)
            .then(r => r.json())
            .then((data: Task[]) => {
                setTasks(data);
                data.forEach(t =>
                    fetch(`/api/tasks/comments?taskId=${t.id}`)
                        .then(r => r.json())
                        .then((c: Comment[]) =>
                            setComments(prev => ({ ...prev, [t.id]: c })),
                        ),
                );
            });
    }, [status]);

    /* ---------- COMMENT ---------- */
    const handleCommentSubmit = (taskId: number) => {
        if (!newComment.trim()) return;

        const commentPayload: Comment = {
            id: Date.now(),
            taskId,
            author: 'Emrelutfi',
            message: newComment,
            date: new Date().toISOString().split('T')[0],
        };

        /* Optimistic UI */
        setComments(prev => ({
            ...prev,
            [taskId]: [...(prev[taskId] ?? []), commentPayload],
        }));
        setNewComment('');
        setActiveCommentTaskId(null);

        fetch('/api/tasks/comments', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(commentPayload),
        }).catch(console.error);
    };

    /* ---------- FORM VALIDATION ---------- */
    const isPercentValid =
        Number.isFinite(formPercent) && (formPercent as number) >= 0 && (formPercent as number) <= 100;
    const isImportanceValid =
        Number.isFinite(formImportance) && (formImportance as number) >= 1 && (formImportance as number) <= 5;
    const isTimelineValid =
        Number.isFinite(formTimeline) && (formTimeline as number) >= 1;

    const isFormValid = () =>
        formCategory.trim() !== '' &&
        formName.trim() !== '' &&
        isPercentValid &&
        isImportanceValid &&
        isTimelineValid;

    /* ---------- ADD TASK ---------- */
    const handleAddTaskSubmit = async () => {
        if (!isFormValid()) return;

        const newTask: Task = {
            id: Date.now(),
            category: formCategory,
            name: formName,
            successPercent: formPercent as number,
            importance: formImportance as number,
            timeline: `${formTimeline} days`,
            status,
        };

        /* Optimistic add */
        setTasks(prev => [newTask, ...prev]);

        /* İlk yorum (isteğe bağlı) */
        if (formInitialComment.trim()) {
            const firstComment: Comment = {
                id: Date.now(),
                taskId: newTask.id,
                author: 'Current User',
                message: formInitialComment,
                date: new Date().toISOString().split('T')[0],
            };
            setComments(prev => ({
                ...prev,
                [newTask.id]: [...(prev[newTask.id] ?? []), firstComment],
            }));
            fetch('/api/tasks/comments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(firstComment),
            }).catch(console.error);
        }

        /* Sunucuya kaydet */
        try {
            const res = await fetch('/api/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newTask),
            });
            if (!res.ok) throw new Error();
        } catch {
            // sunucu hatası ⇒ optimistic rollback
            setTasks(prev => prev.filter(t => t.id !== newTask.id));
            alert('Görev kaydedilemedi.');
            return;
        }

        /* Reset form */
        setFormCategory('');
        setFormName('');
        setFormPercent(undefined);
        setFormImportance(undefined);
        setFormTimeline(undefined);
        setFormInitialComment('');
        setIsAddModalOpen(false);
    };

    /* ---------- UI ---------- */
    return (
        <>
            {/* ---------- HEADER & LIST ---------- */}
            <div className="flex flex-row h-full w-full gap-5">
                <div className="flex flex-col w-full items-center">
                    <div className="flex sticky top-0 z-20 justify-center pb-4 w-full bg-[#F0F5FF] items-center gap-4">
                        <h6 className="poppins-semibold text-[25px]">{TITLE[status]}</h6>

                        {/* Add icon */}
                        <svg
                            onClick={() => setIsAddModalOpen(true)}
                            className="w-5 h-5 cursor-pointer"
                            viewBox="0 0 12 12"
                            fill="none"
                        >
                            <path
                                d="M6 6V1M6 6V11M6 6H11M6 6H1"
                                stroke="#161A3E"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                            />
                        </svg>
                    </div>

                    <div className="w-full flex flex-col gap-5">
                        {tasks.map(task => (
                            <div
                                key={task.id}
                                className="bg-white shadow-md rounded-[25px] p-5 pb-3 flex flex-col"
                            >
                                <div className={`
                                ${task.importance === 1 && "bg-[#ECF2FF]"}
                                ${task.importance === 2 && "bg-[#BBFFA7]"}
                                ${task.importance === 3 && "bg-[#1161FF]"}
                                ${task.importance === 4 && "bg-[#A530FF]"}
                                ${task.importance === 5 && "bg-[#FF4E51]"}
                                
                                 p-2  rounded-[30px] w-fit`}>
                                    <p className={`
                                    ${(task.importance === 2 || task.importance === 1 || task.importance === 3) ? "!text-black" : "!text-white"}  
                                     text-xs`}>{task.category}</p>
                                </div>

                                <h6 className="mt-4 poppins-semibold text-[16px]">
                                    {task.name}
                                </h6>

                                {/* progress */}
                                <div className="mt-2 flex flex-col gap-1">
                                    <div className="flex justify-end text-xs">
                                        %{task.successPercent}
                                    </div>
                                    <div className="relative h-[7px]">
                                        <div
                                            className={`
                                               ${task.importance === 1 && "bg-[#ECF2FF]"}
                                ${task.importance === 2 && "bg-[#BBFFA7]"}
                                ${task.importance === 3 && "bg-[#1161FF]"}
                                ${task.importance === 4 && "bg-[#A530FF]"}
                                ${task.importance === 5 && "bg-[#FF4E51]"}
                                            absolute  h-full rounded-[10px]`}
                                            style={{ width: `${task.successPercent}%` }}
                                        />
                                        <div className="bg-[#DEE0FC] h-full rounded-[10px]" />
                                    </div>
                                </div>

                                <div className="flex justify-between mt-4 text-xs">
                                    <p>Importance: {task.importance}</p>
                                    <p>{task.timeline}</p>
                                </div>

                                {/* yorum listesi */}
                                <div
                                    className="mt-3 max-h-[100px] overflow-auto cursor-pointer"
                                    onClick={() => setActiveCommentTaskId(task.id)}
                                >
                                    {comments[task.id]?.length ? (
                                        comments[task.id].map(c => (
                                            <div key={c.id} className="text-xs py-1">
                                                <strong>{c.author}:</strong> {c.message}
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-xs italic text-gray-500">
                                            No comments yet.
                                        </p>
                                    )}
                                </div>

                                {/* yorum textarea */}
                                {activeCommentTaskId === task.id && (
                                    <div className="mt-2 flex flex-col gap-1">
                                        <textarea
                                            className="w-full border border-gray-300 p-2 rounded resize-none text-xs"
                                            value={newComment}
                                            onChange={e => setNewComment(e.target.value)}
                                            placeholder="Write your comment here..."
                                        />
                                        <button
                                            className="w-full bg-[#1161FF] text-white py-1 rounded text-xs"
                                            onClick={() => handleCommentSubmit(task.id)}
                                        >
                                            Submit Comment
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* ---------- MODAL ---------- */}
            {isAddModalOpen && (
                <div className="fixed inset-0 z-30 flex items-center justify-center bg-opacity-50 backdrop-blur-sm">
                    <div className="bg-white p-6 rounded-[20px] w-[400px]">
                        <h6 className="poppins-semibold text-lg mb-4">Yeni Görev Ekle</h6>

                        {/* ---------- FORM ---------- */}
                        <label className="block text-sm mb-1">Konu Başlığı</label>
                        <input
                            className="w-full border border-gray-300 rounded p-2 mb-3"
                            value={formCategory}
                            onChange={e => setFormCategory(e.target.value)}
                        />

                        <label className="block text-sm mb-1">Todo İsmi</label>
                        <input
                            className="w-full border border-gray-300 rounded p-2 mb-3"
                            value={formName}
                            onChange={e => setFormName(e.target.value)}
                        />

                        <label className="block text-sm mb-1">% Tamamlanma</label>
                        <input
                            type="number"
                            min={0}
                            max={100}
                            value={formPercent ?? ''}
                            onChange={e => setFormPercent(e.target.valueAsNumber)}
                            className="w-full border border-gray-300 rounded p-2 mb-1"
                        />
                        {!isPercentValid && (
                            <p className="text-xs text-red-600 mb-2">0-100 arası bir değer girin</p>
                        )}

                        <label className="block text-sm mb-1">Importance (1-5)</label>
                        <input
                            type="number"
                            min={1}
                            max={5}
                            value={formImportance ?? ''}
                            onChange={e => setFormImportance(e.target.valueAsNumber)}
                            className="w-full border border-gray-300 rounded p-2 mb-1"
                        />
                        {!isImportanceValid && (
                            <p className="text-xs text-red-600 mb-2">1-5 arası bir değer girin</p>
                        )}

                        <label className="block text-sm mb-1">Timeline (gün)</label>
                        <input
                            type="number"
                            min={1}
                            value={formTimeline ?? ''}
                            onChange={e => setFormTimeline(e.target.valueAsNumber)}
                            className="w-full border border-gray-300 rounded p-2 mb-1"
                        />
                        {!isTimelineValid && (
                            <p className="text-xs text-red-600 mb-2">En az 1 gün olmalı</p>
                        )}

                        <label className="block text-sm mb-1">İlk Yorum (opsiyonel)</label>
                        <textarea
                            className="w-full border border-gray-300 rounded p-2 mb-4 resize-none"
                            rows={2}
                            value={formInitialComment}
                            onChange={e => setFormInitialComment(e.target.value)}
                        />

                        {/* ---------- ACTIONS ---------- */}
                        <div className="flex justify-end gap-2">
                            <button
                                className="px-4 py-2 cursor-pointer bg-gray-200 rounded"
                                onClick={() => setIsAddModalOpen(false)}
                            >
                                İptal
                            </button>
                            <button
                                disabled={!isFormValid()}
                                className={`px-4 py-2 cursor-pointer rounded text-white ${
                                    isFormValid()
                                        ? 'bg-[#1161FF] hover:bg-[#0d4cd9]'
                                        : 'bg-gray-400 cursor-not-allowed'
                                }`}
                                onClick={handleAddTaskSubmit}
                            >
                                Ekle
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default TaskBar;
