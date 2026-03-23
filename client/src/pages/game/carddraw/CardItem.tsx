import { socket } from '@/lib/socket';
import React from 'react'

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

type CardItemprop = {
    card: { value: number | string, revealed: boolean },
    index: number,
    roomId: string | undefined,
    playerId: string,
    disabled: boolean,
    pickedBy: string
}

export default function CardItem({ card, index, roomId, playerId, disabled, pickedBy }: CardItemprop) {
    function handlepick() {
        if (disabled) return;

        socket.emit("carddraw:card-pick", {
            roomId,
            cardindex: index,
            playerId,
        });
    }

    const isMine = pickedBy === playerId;
    // const isOpponent = pickedBy && pickedBy !== playerId;

    return (
        <div
            className={`relative w-[60px] h-[80px] perspective mx-auto ${disabled ? "opacity-50" : "cursor-pointer hover:scale-[1.03]"
                } transition`}
            onClick={handlepick}
        >
            <div
                className={`relative w-full h-full transition-transform duration-500 transform-style-preserve-3d ${card.revealed ? "rotate-y-180" : ""
                    }`}
            >
                <img
                    src="/cards/back2.png"
                    className="absolute w-full h-full bg-white backface-hidden border  shadow-sm"
                />

                <img
                    src={cardMap[card.value]}
                    className="absolute w-full h-full bg-white rotate-y-180 backface-hidden border  shadow-sm"
                />
            </div>

            {pickedBy && (
                <div
                    className={`absolute inset-0 rounded-sm border-[2px] ${isMine ? "border-green-500" : "border-red-500"
                        }`}
                />
            )}
        </div>
    );
}
