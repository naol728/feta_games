import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import React, { useState } from 'react'
import type { Player } from './CardDraw'

export default function Players({ player }: { player: Player }) {
    const [playerId] = useState(() => {
        let id = localStorage.getItem("playerId");
        if (!id) {
            id = "player_" + Math.floor(Math.random() * 100000);
            localStorage.setItem("playerId", id);
        }
        return id;
    });

    const isMe = player.id === playerId;

    return (
        <div
            className={`flex items-center justify-between px-2 py-1.5 rounded-md
      ${isMe ? "bg-primary/10" : "bg-muted/40"}
    `}
        >
            {/* LEFT */}
            <div className="flex items-center gap-2 min-w-0">
                <Avatar className="h-7 w-7">
                    <AvatarFallback className="text-[10px] font-semibold">
                        {player.id.substring(0, 2).toUpperCase()}
                    </AvatarFallback>
                </Avatar>

                <div className="min-w-0">
                    <p
                        className={`text-[11px] truncate font-medium ${isMe ? "text-primary" : ""
                            }`}
                    >
                        {player.id}
                    </p>

                    <p className="text-[10px] text-muted-foreground leading-none">
                        {player.total} pts
                    </p>
                </div>
            </div>

            {/* RIGHT */}
            <div className="flex items-center gap-1">
                {player.picks.map((pick, i: number) => (
                    <Badge
                        key={i}
                        variant="secondary"
                        className="text-[9px] px-1.5 py-[1px] font-mono"
                    >
                        {pick?.value ?? "?"}
                    </Badge>
                ))}
            </div>
        </div>
    );
}