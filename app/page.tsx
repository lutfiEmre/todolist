'use client';
import React from 'react';
import Image from 'next/image';

// ⬇️ Artık TaskBar’a gerek yok (KanbanBoard kendi içinde kullanıyor)
import KanbanBoard from '@/components/KanbanBoard';
import LeftMenu from "@/components/LeftMenu";

const MyComponent = () => (
    <div className={'w-full flex  flex-row  min-h-screen h-full'}>
        <LeftMenu/>
        <div className={'w-full  h-full p-0px]'}>

            <div className={'p-[20px] w-full h-full min-h-screen h-screen '}>
                <div className={'bg-[#F0F5FF] px-[28px] py-[20px] rounded-[25px]  w-full h-full'}>
                    <div className="flex flex-col h-full gap-[25px]">
                        {/* ---------- Header ---------- */}
                        <div
                            className="w-full px-[20px] py-[7px] flex justify-between items-center rounded-[32px] bg-white">
                            <h6 className="poppins-semibold text-[24px] text-black">Task Manager</h6>

                            <div className="flex flex-row gap-2">
                                {/* Takvim kartı */}
                                <div
                                    className="px-[15px] cursor-pointer flex items-center gap-2 py-[12px] bg-[#7C5BF8] rounded-[23px]">
                                    {/* svg … */}
                                    <h6 className="poppins-medium text-white text-[12px]">January 2025</h6>
                                </div>

                                {/* Bildirim çanı */}
                                <div
                                    className="p-[11.5px] bg-[#7C5BF8]/20 rounded-full flex justify-center items-center">
                                    {/* svg … */}
                                </div>

                                {/* Profil resmi */}
                                <div className="w-[50px] rounded-full">
                                    <Image
                                        className="w-full h-[50px] rounded-full object-cover"
                                        src="/photos/emrelutfi.png"
                                        width={60}
                                        height={50}
                                        alt=""
                                    />
                                </div>
                            </div>
                        </div>

                        <KanbanBoard/>
                    </div>
                </div>
            </div>
        </div>

    </div>
);

export default MyComponent;
