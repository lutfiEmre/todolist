'use client';
import React from 'react';
import Image from 'next/image';

import KanbanBoard from '@/components/KanbanBoard';
import LeftMenu from "@/components/LeftMenu";

const MyComponent = () => (
    <div className={'w-full flex   flex-row  min-h-screen h-full'}>
        <LeftMenu/>
        <div className={'w-full   h-full p-0px]'}>

            <div className={'lg:p-[10px] md:w-full w-[1500px] overflow-x-visible p-[10px] xl:p-[20px] pl-[0px]  h-full min-h-screen h-full '}>
                <div className={'bg-[#F0F5FF] px-[28px] py-[20px] rounded-[25px]  w-full h-full'}>
                    <div className="flex flex-col h-full gap-[25px]">
                        <div
                            className="w-full px-[20px] py-[7px] flex justify-between items-center rounded-[32px] bg-white">
                            <h6 className="poppins-semibold text-[24px] text-black">Task Manager</h6>

                            <div className="flex flex-row gap-2">
                                <div
                                    className="px-[15px] cursor-pointer flex items-center gap-2 py-[12px] bg-[#7C5BF8] rounded-[23px]">
                                    <h6 className="poppins-medium text-white text-[12px]">January 2025</h6>
                                </div>



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
                        <div className={'flex flex-row gap-4 items-center'}>
                            <h6 className={'poppins-semibold'}>
                                Important Level:
                            </h6>
                            <div className={'flex flex-row gap-6 bg-white p-2 rounded-[10px]'}>

                                <div className={'flex flex-row gap-[8px] items-center '}>
                                    <h2 className={'poppins-medium text-black'}>
                                        1
                                    </h2>
                                    <div className={'w-[30px] h-[30px] rounded-full !bg-[#ECF2FF]'}>

                                    </div>
                                </div>
                                <div className={'flex flex-row gap-[8px] items-center '}>
                                    <h2 className={'poppins-medium text-black'}>
                                        2
                                    </h2>
                                    <div className={'w-[30px] h-[30px] rounded-full bg-[#BBFFA7]'}>

                                    </div>
                                </div>
                                <div className={'flex flex-row gap-[8px] items-center '}>
                                    <h2 className={'poppins-medium text-black'}>
                                        3
                                    </h2>
                                    <div className={'w-[30px] h-[30px] rounded-full bg-[#1161FF]'}>

                                    </div>
                                </div>
                                <div className={'flex flex-row gap-[8px] items-center '}>
                                    <h2 className={'poppins-medium text-black'}>
                                        4
                                    </h2>
                                    <div className={'w-[30px] h-[30px] rounded-full !bg-[#A530FF]'}>

                                    </div>
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
