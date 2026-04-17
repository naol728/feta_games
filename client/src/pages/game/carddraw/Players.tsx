/*eslint-disable*/
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import type { Player } from "./CardDraw"
import { useAppSelector } from "@/store/hook"

export default function Players({ player }: { player: Player }) {
    const user = useAppSelector((state) => state.auth?.user)

    const isMe = player.id === user?.id

    // 👇 DISPLAY NAME
    const displayName = isMe
        ? `${user?.Fname ?? ""} ${user?.Lname ?? ""}`.trim()
        : "Opponent"

    // 👇 TELEGRAM ID (masked for opponent)
    const telegramId = isMe
        ? user?.telegram_id
        : player.id?.slice(0, 6) // fallback (since opponent telegram not available)

    return (
        <div
            className={`
        flex items-center justify-between
        px-3 py-2 rounded-lg border
        ${isMe
                    ? "bg-primary/10 border-primary/20"
                    : "bg-muted/30 border-border/30"}
      `}
        >
            {/* LEFT */}
            <div className="flex items-center gap-3 min-w-0">
                <Avatar className="h-8 w-8">
                    <AvatarFallback className="text-xs font-semibold">
                        {displayName.charAt(0) || "U"}
                    </AvatarFallback>
                </Avatar>

                <div className="min-w-0">
                    {/* NAME */}
                    <p
                        className={`text-[12px] truncate font-semibold ${isMe ? "text-primary" : ""
                            }`}
                    >
                        {displayName}
                    </p>

                    {/* TELEGRAM */}
                    <p className="text-[10px] text-muted-foreground">
                        ID: {telegramId}
                    </p>

                    {/* SCORE */}
                    <p className="text-[10px] text-muted-foreground leading-none">
                        {player.total} pts
                    </p>
                </div>
            </div>

            {/* RIGHT (PICKS) */}
            <div className="flex items-center gap-1 flex-wrap justify-end max-w-[50%]">
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
    )
}