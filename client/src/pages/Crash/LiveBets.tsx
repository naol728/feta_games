import React from "react";
import {
    Card,
    CardContent,
    CardHeader,
} from "@/components/ui/card";
import {
    Avatar,
    AvatarFallback,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface User {
    id: string;
    telegram_id: number;
    username: string;
    created_at: string;
    updated_at: string;
    Fname: string;
    Lname: string;
    referral_id: string;
    wallets: {
        balance: number;
        locked_balance: number;
    };
}

interface CrashPlayer extends User {
    payout?: number | null;
}

interface CrashGameState {
    gameBets: Record<string, number>;
    gamePlayers: Record<string, CrashPlayer>;
    crashPoint: number;
    gameStartTime: number | null;
    phase: "betting" | "running" | "crashed";
}

interface LiveBetsProps {
    gameState: CrashGameState;
}

const formatETB = (amount: number) =>
    new Intl.NumberFormat("en-ET", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);

const getInitials = (player: CrashPlayer) => {
    const first =
        player.Fname?.charAt(0) ||
        player.username?.charAt(0) ||
        "?";

    const last = player.Lname?.charAt(0) || "";

    return `${first}${last}`.toUpperCase();
};

const LiveBets: React.FC<LiveBetsProps> = ({ gameState }) => {
    const gameBets = gameState?.gameBets ?? {};
    const gamePlayers = gameState?.gamePlayers ?? {};

    const players = Object.entries(gamePlayers);

    const totalBets = Object.values(gameBets).reduce(
        (sum, bet) => sum + Number(bet || 0),
        0
    );

    return (
        <Card className="w-full overflow-hidden border-border/50 bg-card">
            {/* HEADER */}
            <CardHeader className="p-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span
                            className={`h-2 w-2 rounded-full ${gameState.phase === "running"
                                ? "animate-pulse bg-green-500"
                                : "bg-muted-foreground"
                                }`}
                        />

                        <span className="text-sm font-semibold">
                            Live Bets
                        </span>

                        {players.length > 0 && (
                            <Badge
                                variant="secondary"
                                className="h-5 rounded-full px-2 text-[10px]"
                            >
                                {players.length}
                            </Badge>
                        )}
                    </div>

                    <div className="text-right">
                        <p className="text-[9px] uppercase text-muted-foreground">
                            Total
                        </p>

                        <p className="text-sm font-bold">
                            ETB {formatETB(totalBets)}
                        </p>
                    </div>
                </div>
            </CardHeader>

            <Separator />

            {/* DESKTOP HEADER */}
            <div className="hidden grid-cols-[1fr_80px_80px_90px] gap-2 bg-muted/30 px-3 py-2 sm:grid">
                <span className="text-[10px] font-semibold uppercase text-muted-foreground">
                    Player
                </span>

                <span className="text-right text-[10px] font-semibold uppercase text-muted-foreground">
                    Bet
                </span>

                <span className="text-right text-[10px] font-semibold uppercase text-muted-foreground">
                    Payout
                </span>

                <span className="text-right text-[10px] font-semibold uppercase text-muted-foreground">
                    Profit
                </span>
            </div>

            <CardContent className="p-0">
                {players.length === 0 ? (
                    <div className="flex min-h-[90px] items-center justify-center">
                        <p className="text-xs text-muted-foreground">
                            No live bets
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/40">
                        {players.map(([playerId, player]) => {
                            const bet = Number(gameBets[playerId] || 0);

                            const payout =
                                player.payout !== undefined
                                    ? player.payout
                                    : null;

                            const hasCashedOut = payout !== null;

                            const totalPayout = hasCashedOut
                                ? payout! * bet
                                : null;

                            const profit = hasCashedOut
                                ? (payout! - 1) * bet
                                : null;

                            return (
                                <div
                                    key={playerId}
                                    className="px-3 py-3"
                                >
                                    {/* MOBILE */}
                                    <div className="flex items-center justify-between sm:hidden">
                                        {/* USER */}
                                        <div className="flex min-w-0 items-center gap-2">
                                            <Avatar className="h-8 w-8 shrink-0">
                                                <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
                                                    {getInitials(player)}
                                                </AvatarFallback>
                                            </Avatar>

                                            <div className="min-w-0">
                                                <p className="max-w-[130px] truncate text-xs font-semibold">
                                                    {player.username ||
                                                        `${player.Fname} ${player.Lname}`}
                                                </p>

                                                <p className="text-[10px] text-muted-foreground">
                                                    ETB {formatETB(bet)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* STATUS */}
                                        <div className="text-right">
                                            {hasCashedOut ? (
                                                <>
                                                    <p className="text-sm font-bold text-green-500">
                                                        {payout!.toFixed(2)}x
                                                    </p>

                                                    <p className="text-[10px] text-green-500">
                                                        +ETB {formatETB(profit!)}
                                                    </p>
                                                </>
                                            ) : (
                                                <Badge
                                                    variant="secondary"
                                                    className="h-6 px-2 text-[9px]"
                                                >
                                                    Playing
                                                </Badge>
                                            )}
                                        </div>
                                    </div>

                                    {/* DESKTOP */}
                                    <div className="hidden grid-cols-[1fr_80px_80px_90px] items-center  sm:grid">
                                        {/* USER */}
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-8 w-8">
                                                <AvatarFallback className="bg-primary/10 text-[10px] font-bold text-primary">
                                                    {getInitials(player)}
                                                </AvatarFallback>
                                            </Avatar>

                                            <div className="min-w-0">
                                                <p className="truncate text-xs font-semibold">
                                                    {player.username ||
                                                        `${player.Fname} ${player.Lname}`}
                                                </p>

                                                <p className="text-[9px] text-muted-foreground">
                                                    {player.Fname} {player.Lname}
                                                </p>
                                            </div>
                                        </div>

                                        {/* BET */}
                                        <span className="text-right text-xs font-semibold">
                                            ETB {formatETB(bet)}
                                        </span>

                                        {/* PAYOUT */}
                                        <span
                                            className={`text-right text-xs font-bold ${hasCashedOut
                                                ? "text-green-500"
                                                : "text-muted-foreground"
                                                }`}
                                        >
                                            {hasCashedOut
                                                ? `${payout!.toFixed(2)}x`
                                                : "-"}
                                        </span>

                                        {/* PROFIT */}
                                        <span
                                            className={`text-right text-xs font-bold ${hasCashedOut
                                                ? "text-green-500"
                                                : "text-muted-foreground"
                                                }`}
                                        >
                                            {hasCashedOut
                                                ? `+ETB ${formatETB(profit!)}`
                                                : "-"}
                                        </span>
                                    </div>

                                    {/* MOBILE TOTAL PAYOUT */}
                                    {hasCashedOut && (
                                        <div className="mt-2 flex justify-between border-t border-border/30 pt-2 sm:hidden">
                                            <span className="text-[9px] text-muted-foreground">
                                                Total payout
                                            </span>

                                            <span className="text-[10px] font-semibold">
                                                ETB {formatETB(totalPayout!)}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default LiveBets;