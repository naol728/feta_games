import { socket } from '@/lib/socket';
import React from 'react';

const cardMap: Record<string, string> = {
    "1": "/cards/AS.png",
    "2": "/cards/2S.png",
    "3": "/cards/3S.png",
    "4": "/cards/4S.png",
    "5": "/cards/5S.png",
    "6": "/cards/6S.png",
    "7": "/cards/7S.png",
    "8": "/cards/8S.png",
    "9": "/cards/9S.png",
    "10": "/cards/10S.png",
    J: "/cards/JS.png",
    Q: "/cards/QS.png",
    K: "/cards/KS.png",
};

type CardItemProp = {
    card: { value: number | string; revealed: boolean };
    index: number;
    roomId: string | undefined;
    playerId: string;
    disabled: boolean;
    pickedBy: string;
};

export default function CardItem({ card, index, roomId, playerId, disabled, pickedBy }: CardItemProp) {
    const isMine = pickedBy === playerId;

    function handlePick() {
        if (disabled) return;
        socket.emit("carddraw:card-pick", { roomId, cardindex: index, playerId });
    }

    return (
        <div
            className={`relative w-[60px] h-[80px] perspective mx-auto ${disabled ? "opacity-50" : "cursor-pointer hover:scale-105"
                } transition-transform duration-300`}
            onClick={handlePick}
        >
            <div
                className={`relative w-full h-full transition-transform duration-500 transform-style-preserve-3d ${card.revealed ? "rotate-y-180" : ""
                    }`}
            >
                <img
                    src="https://i.pinimg.com/236x/30/37/56/3037565bfff30ab14386e78ee9140979.jpg"
                    className="absolute w-full h-full  bg-black/90 border border-white/20 rounded-md backface-hidden shadow-lg"
                />
                <img
                    src={cardMap[card.value]}
                    className="absolute w-full h-full bg-white border border-white/20 rounded-md rotate-y-180 backface-hidden shadow-lg"
                />
            </div>

            {pickedBy && (
                <div
                    className={`absolute inset-0 rounded-lg border-2 ${isMine ? "border-emerald-400 animate-pulse" : "border-red-500"
                        }`}
                />
            )}
        </div>
    );
}