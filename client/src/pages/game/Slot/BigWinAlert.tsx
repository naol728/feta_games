import React, { useState, useEffect, useCallback } from 'react';
import BigWin from "/images/slot/bigwin.webp";
import Monetary from './../../../components/Monetary';

interface BigWinAlertProps {
    value: number;
}

const BigWinAlert: React.FC<BigWinAlertProps> = ({ value }) => {
    const [scale, setScale] = useState(0);
    const [animatedValue, setAnimatedValue] = useState(0);

    const animateValue = useCallback(() => {
        let start = 0;
        const end = Math.round(value);

        const timer = setInterval(() => {
            start += value / 100
            setAnimatedValue(start);
            if (start >= end) {
                clearInterval(timer);
            }
        }, 30);
    }, [value]);

    useEffect(() => {
        const timeout = setTimeout(() => {
            setScale(1);
            animateValue();
        }, 3000);

        return () => clearTimeout(timeout);
    }, [animateValue]);

    return (
        <div className='absolute z-50 transition-all flex items-center justify-center bg-black/30 w-screen h-[110vh]'
            style={{
                opacity: scale,
                transition: 'opacity 0.5s ease-in-out',
            }}
        >
            <div className='flex items-center justify-center absolute top-52'>
                <div
                    className="absolute w-auto rounded-full -z-10 "
                    style={{
                        width: "1px",
                        height: "1px",
                        boxShadow: "0px 0px 230px 150px #FFCC00",
                    }}
                />
                <div className='flex flex-col items-center justify-center font-bold p-4 text-white text-2xl gap-2'
                    style={{
                        transform: `scale(${scale})`,
                        transition: 'transform 0.5s ease-in-out',
                        transformOrigin: '50% 50%',
                    }}>
                    <img src={BigWin} className='w-[350px] animate-winner winner-item' />
                    <span className='text-[#FFED08] text-5xl -mt-32 z-10' style={{ textShadow: '4px 4px 0 #A93400, -4px -4px 0 #A93400, 4px -4px 0 #A93400, -4px 4px 0 #A93400' }}>
                        <Monetary value={animatedValue} />
                    </span>
                </div>
            </div>

            <style>{`
           

            @keyframes animate-winner {
                0% {
                    transform: scale(1);
                }
                100% {
                    transform: scale(1.005);
                }
            }

            .winner-item {
                animation: animate-winner 0.8s infinite alternate;
            }
        `}</style>
        </div>

    );
};

export default BigWinAlert;
