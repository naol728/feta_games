/* eslint-disable */
import React, { useMemo } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import type { CrashGameState, CrashPlayer } from "./../../types/crash";

interface LiveBetsProps {
    gameState: CrashGameState;
    /** Optional: highlights the viewer's own row. */
    currentUserId?: string;
}

// ======================== MODULE-LEVEL HELPERS ========================
// Hoisted so they're constructed once, not once per row per render.

const currencyFormatter = new Intl.NumberFormat("en-ET", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
});

const formatETB = (amount: number): string => currencyFormatter.format(amount);

const getInitials = (name: string): string => {
    const trimmed = name.trim();
    if (!trimmed) return "PL";
    const parts = trimmed.split(/\s+/);
    if (parts.length === 1) return trimmed.slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[1][0]).toUpperCase();
};

interface PlayerRowData {
    player: CrashPlayer;
    hasCashedOut: boolean;
    totalPayout: number | null;
    profit: number | null;
    isSelf: boolean;
}

/** Pure derivation, no hooks needed inside — safe to compute once per player up in the parent's useMemo instead of per-row. */
function deriveRow(player: CrashPlayer, currentUserId?: string): PlayerRowData {
    const payout = player.payout;
    const hasCashedOut = payout !== null && payout !== undefined && Number.isFinite(payout);
    const bet = player.betAmount;

    return {
        player,
        hasCashedOut,
        totalPayout: hasCashedOut ? (payout as number) * bet : null,
        profit: hasCashedOut ? ((payout as number) - 1) * bet : null,
        isSelf: !!currentUserId && player.userId === currentUserId,
    };
}

// ======================== ROW (memoized) ========================
// Only re-renders when ITS player object reference changes. The parent's
// merge logic only creates a new object for players whose data actually
// changed, so a cashout affecting one player never touches the other rows.

const PlayerRow = React.memo<PlayerRowData>(
    ({ player, hasCashedOut, totalPayout, profit, isSelf }) => {
        const initials = getInitials(player.username);

        return (
            <div className={cn("px-2.5 py-2 sm:py-2.5", isSelf && "bg-primary/[0.04]")}>
                {/* MOBILE LAYOUT */}
                <div className="flex items-center justify-between sm:hidden">
                    <div className="flex min-w-0 items-center gap-2">
                        <Avatar className="h-7 w-7 shrink-0">
                            <AvatarFallback
                                className={cn(
                                    "text-[8px] font-bold",
                                    isSelf ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary"
                                )}
                            >
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <div className="min-w-0">
                            <p className="max-w-[150px] truncate text-[10px] font-semibold">
                                {player.username}
                                {isSelf && <span className="ml-1 text-[8px] text-primary">(You)</span>}
                            </p>
                            <p className="text-[9px] text-muted-foreground">
                                ETB {formatETB(player.betAmount)}
                            </p>
                        </div>
                    </div>

                    <div className="shrink-0 text-right">
                        {hasCashedOut ? (
                            <>
                                <p className="text-xs font-bold text-green-500">
                                    {(player.payout as number).toFixed(2)}x
                                </p>
                                <p className="text-[9px] font-medium text-green-500">
                                    +ETB {formatETB(profit ?? 0)}
                                </p>
                            </>
                        ) : (
                            <Badge
                                variant="secondary"
                                className="flex h-5 items-center gap-1 px-1.5 text-[8px] font-medium"
                            >
                                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-green-500" />
                                Playing
                            </Badge>
                        )}
                    </div>
                </div>

                {hasCashedOut && (
                    <div className="mt-1.5 flex items-center justify-between border-t border-border/20 pt-1.5 sm:hidden">
                        <span className="text-[8px] text-muted-foreground">Total payout</span>
                        <span className="text-[9px] font-semibold">ETB {formatETB(totalPayout ?? 0)}</span>
                    </div>
                )}

                {/* DESKTOP LAYOUT */}
                <div className="hidden grid-cols-[1fr_75px_70px_80px] items-center gap-2 sm:grid">
                    <div className="flex min-w-0 items-center gap-2">
                        <Avatar className="h-7 w-7 shrink-0">
                            <AvatarFallback
                                className={cn(
                                    "text-[8px] font-bold",
                                    isSelf ? "bg-primary/20 text-primary" : "bg-primary/10 text-primary"
                                )}
                            >
                                {initials}
                            </AvatarFallback>
                        </Avatar>
                        <p className="truncate text-[10px] font-semibold">
                            {player.username}
                            {isSelf && <span className="ml-1 text-[8px] text-primary">(You)</span>}
                        </p>
                    </div>

                    <span className="text-right text-[10px] font-medium">
                        ETB {formatETB(player.betAmount)}
                    </span>

                    <span
                        className={cn(
                            "text-right text-[10px] font-bold",
                            hasCashedOut ? "text-green-500" : "text-muted-foreground"
                        )}
                    >
                        {hasCashedOut ? `${(player.payout as number).toFixed(2)}x` : "-"}
                    </span>

                    <span
                        className={cn(
                            "text-right text-[10px] font-bold",
                            hasCashedOut ? "text-green-500" : "text-muted-foreground"
                        )}
                    >
                        {hasCashedOut ? `+ ETB ${formatETB(profit ?? 0)}` : "-"}
                    </span>
                </div>
            </div>
        );
    },
    // Custom comparator: skip the default shallow-prop scan and just check
    // what can actually change. player is a new object only when its data
    // changed (see the reducer's `changed` flag in CrashGame.tsx), so an
    // identity check on it is enough — no need to compare every primitive.
    (prev, next) => prev.player === next.player && prev.isSelf === next.isSelf
);

PlayerRow.displayName = "PlayerRow";

// ======================== MAIN COMPONENT ========================

const LiveBets: React.FC<LiveBetsProps> = React.memo(({ gameState, currentUserId }) => {
    const isRunning = gameState.phase === "running";

    // Single pass: derive rows + running total together instead of two
    // separate Object.values()/reduce() traversals.
    const { rows, totalBets } = useMemo(() => {
        const players = Object.values(gameState.players);

        let total = 0;
        const derived: PlayerRowData[] = new Array(players.length);

        for (let i = 0; i < players.length; i++) {
            const player = players[i];
            total += player.betAmount;
            derived[i] = deriveRow(player, currentUserId);
        }

        // Active bets first, then by bet size — cheap since list is small
        // (typically tens, not thousands, of concurrent players).
        derived.sort((a, b) => {
            if (a.hasCashedOut !== b.hasCashedOut) return a.hasCashedOut ? 1 : -1;
            return b.player.betAmount - a.player.betAmount;
        });

        return { rows: derived, totalBets: total };
    }, [gameState.players, currentUserId]);

    return (
        <Card className="w-full overflow-hidden rounded-xl border-border/60 bg-card shadow-none">
            {/* HEADER */}
            <CardHeader className="p-2.5">
                <div className="flex items-center justify-between">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <span
                            className={cn(
                                "h-1.5 w-1.5 shrink-0 rounded-full",
                                isRunning ? "animate-pulse bg-green-500" : "bg-muted-foreground/50"
                            )}
                        />
                        <span className="text-xs font-semibold">Live Bets</span>
                        {rows.length > 0 && (
                            <Badge variant="secondary" className="h-4 rounded-full px-1.5 text-[9px] font-medium">
                                {rows.length}
                            </Badge>
                        )}
                    </div>
                    <div className="text-right">
                        <p className="text-[8px] uppercase tracking-wide text-muted-foreground">Total</p>
                        <p className="text-xs font-bold">ETB {formatETB(totalBets)}</p>
                    </div>
                </div>
            </CardHeader>

            <Separator />

            {/* DESKTOP TABLE HEADER */}
            <div className="hidden grid-cols-[1fr_75px_70px_80px] gap-2 bg-muted/20 px-2.5 py-1.5 sm:grid">
                <span className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Player
                </span>
                <span className="text-right text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Bet
                </span>
                <span className="text-right text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Payout
                </span>
                <span className="text-right text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
                    Profit
                </span>
            </div>

            <CardContent className="p-0">
                {rows.length === 0 ? (
                    <div className="flex min-h-[70px] items-center justify-center">
                        <p className="text-[10px] text-muted-foreground">No live bets</p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/30">
                        {rows.map((row) => (
                            <PlayerRow key={row.player.playerId} {...row} />
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
});

LiveBets.displayName = "LiveBets";

export default LiveBets;