import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import React, { useState } from 'react'

export default function Players({ player }) {

    const [playerId] = useState(() => {
        let id = localStorage.getItem("playerId");
        if (!id) {
            id = "player_" + Math.floor(Math.random() * 100000);
            localStorage.setItem("playerId", id);
        }
        return id;
    });

    return (
        <div className="flex justify-between gap-2.5 px-2 py-1.5">
            
            <div className="flex flex-col justify-between">
                
                <div className='flex flex-col gap-1'>
                    <Avatar className="h-9 w-9">
                        <AvatarFallback className="bg-primary/15 text-primary text-[11px] font-semibold">
                            {player.id.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                    </Avatar>

                    <div>
                        <p className={`font-medium text-[11px] leading-tight ${
                            player.id === playerId ? "text-primary" : "text-foreground/80"
                        }`}>
                            {player.id}
                        </p>
                    </div>
                </div>

                <div>
                    <p className="text-[10px] text-muted-foreground leading-none">
                        Total Score
                    </p>
                    <p className="text-xs font-semibold leading-tight">
                        {player.total}
                    </p>
                </div>

            </div>

            {player.picks.length > 0 && (
                <div className="space-y-1.5">
                    <p className="text-[10px] font-medium text-muted-foreground">
                        Picks ({player.picks.length})
                    </p>

                    <div className="flex flex-col gap-1">
                        {player.picks.map((pick: any, i: number) => (
                            <Badge
                                key={i}
                                variant="secondary"
                                className="text-[10px] font-mono px-2 py-[2px]"
                            >
                                {pick?.value || '?'}
                            </Badge>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}