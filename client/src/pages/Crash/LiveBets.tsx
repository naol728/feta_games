
/* eslint-disable */

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

interface CrashPlayer {
    payout?: number | null;
    autoCashoutAt?: number | null;
}

interface CrashGameState {
    gameBets: Record<string, number>;
    gamePlayers: Record<string, CrashPlayer>;
    gameStartTime: number | null;

    // Backend should hide the real crash point
    // while betting/running.
    crashPoint: number;

    phase: "betting" | "running" | "crashed";
}

interface LiveBetsProps {
    gameState: CrashGameState;
}

const formatETB = (amount: number): string => {
    return new Intl.NumberFormat("en-ET", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
    }).format(amount);
};

const getPlayerName = (playerId: string): string => {
    return `Player ${playerId.slice(0, 5)}`;
};

const getInitials = (playerId: string): string => {
    return playerId.slice(0, 2).toUpperCase();
};

const LiveBets: React.FC<LiveBetsProps> = ({
    gameState,
}) => {
    const gameBets = gameState?.gameBets ?? {};
    const gamePlayers = gameState?.gamePlayers ?? {};

    const players = Object.entries(gamePlayers);

    const totalBets = Object.values(gameBets).reduce(
        (sum: number, bet: number) =>
            sum + Number(bet || 0),
        0
    );

    return (
        <Card
            className="
        w-full
        overflow-hidden
        rounded-xl
        border-border/60
        bg-card
        shadow-none
      "
        >
            {/* =========================
          HEADER
      ========================== */}
            <CardHeader className="p-2.5">
                <div className="flex items-center justify-between">
                    <div className="flex min-w-0 items-center gap-1.5">
                        {/* LIVE INDICATOR */}
                        <span
                            className={`
                h-1.5
                w-1.5
                shrink-0
                rounded-full
                ${gameState.phase === "running"
                                    ? "animate-pulse bg-green-500"
                                    : "bg-muted-foreground/50"
                                }
              `}
                        />

                        <span className="text-xs font-semibold">
                            Live Bets
                        </span>

                        {players.length > 0 && (
                            <Badge
                                variant="secondary"
                                className="
                  h-4
                  rounded-full
                  px-1.5
                  text-[9px]
                  font-medium
                "
                            >
                                {players.length}
                            </Badge>
                        )}
                    </div>

                    <div className="text-right">
                        <p className="text-[8px] uppercase tracking-wide text-muted-foreground">
                            Total
                        </p>

                        <p className="text-xs font-bold">
                            ETB {formatETB(totalBets)}
                        </p>
                    </div>
                </div>
            </CardHeader>

            <Separator />

            {/* =========================
          DESKTOP TABLE HEADER
      ========================== */}
            <div
                className="
          hidden
          grid-cols-[1fr_75px_70px_80px]
          gap-2
          bg-muted/20
          px-2.5
          py-1.5
          sm:grid
        "
            >
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
                {/* =========================
            EMPTY STATE
        ========================== */}
                {players.length === 0 ? (
                    <div className="flex min-h-[70px] items-center justify-center">
                        <p className="text-[10px] text-muted-foreground">
                            No live bets
                        </p>
                    </div>
                ) : (
                    <div className="divide-y divide-border/30">
                        {players.map(([playerId, player]) => {
                            const bet = Number(
                                gameBets[playerId] ?? 0
                            );

                            /*
                             * Convert undefined -> null.
                             * This gives us a clean type:
                             * number | null
                             */
                            const payout: number | null =
                                player?.payout ?? null;

                            const hasCashedOut =
                                payout !== null &&
                                Number.isFinite(payout);

                            /*
                             * Only calculate these when payout exists.
                             * Otherwise they stay null.
                             */
                            const totalPayout: number | null =
                                hasCashedOut
                                    ? payout * bet
                                    : null;

                            const profit: number | null =
                                hasCashedOut
                                    ? (payout - 1) * bet
                                    : null;

                            const autoCashoutAt =
                                player?.autoCashoutAt ?? null;

                            const hasAutoCashout =
                                autoCashoutAt !== null &&
                                Number.isFinite(autoCashoutAt) &&
                                autoCashoutAt >= 1.01;

                            const playerName =
                                getPlayerName(playerId);

                            return (
                                <div
                                    key={playerId}
                                    className="
                    px-2.5
                    py-2
                    sm:py-2.5
                  "
                                >
                                    {/* =========================
                      MOBILE
                  ========================== */}
                                    <div className="flex items-center justify-between sm:hidden">
                                        {/* PLAYER */}
                                        <div className="flex min-w-0 items-center gap-2">
                                            <Avatar className="h-7 w-7 shrink-0">
                                                <AvatarFallback
                                                    className="
                            bg-primary/10
                            text-[8px]
                            font-bold
                            text-primary
                          "
                                                >
                                                    {getInitials(playerId)}
                                                </AvatarFallback>
                                            </Avatar>

                                            <div className="min-w-0">
                                                <p className="max-w-[150px] truncate text-[10px] font-semibold">
                                                    {playerName}
                                                </p>

                                                <p className="text-[9px] text-muted-foreground">
                                                    ETB {formatETB(bet)}
                                                </p>
                                            </div>
                                        </div>

                                        {/* STATUS */}
                                        <div className="shrink-0 text-right">
                                            {hasCashedOut && payout !== null ? (
                                                <>
                                                    <p className="text-xs font-bold text-green-500">
                                                        {payout.toFixed(2)}x
                                                    </p>

                                                    <p className="text-[9px] font-medium text-green-500">
                                                        +ETB{" "}
                                                        {formatETB(profit ?? 0)}
                                                    </p>
                                                </>
                                            ) : (
                                                <div className="flex flex-col items-end gap-0.5">
                                                    <Badge
                                                        variant="secondary"
                                                        className="
                              h-5
                              px-1.5
                              text-[8px]
                              font-medium
                            "
                                                    >
                                                        Playing
                                                    </Badge>

                                                    {hasAutoCashout &&
                                                        autoCashoutAt !== null && (
                                                            <span className="text-[8px] text-muted-foreground">
                                                                Auto{" "}
                                                                {autoCashoutAt.toFixed(2)}
                                                                x
                                                            </span>
                                                        )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* =========================
                      MOBILE PAYOUT
                  ========================== */}
                                    {hasCashedOut && (
                                        <div
                                            className="
                        mt-1.5
                        flex
                        items-center
                        justify-between
                        border-t
                        border-border/20
                        pt-1.5
                        sm:hidden
                      "
                                        >
                                            <span className="text-[8px] text-muted-foreground">
                                                Total payout
                                            </span>

                                            <span className="text-[9px] font-semibold">
                                                ETB {formatETB(totalPayout ?? 0)}
                                            </span>
                                        </div>
                                    )}

                                    {/* =========================
                      DESKTOP
                  ========================== */}
                                    <div
                                        className="
                      hidden
                      grid-cols-[1fr_75px_70px_80px]
                      items-center
                      gap-2
                      sm:grid
                    "
                                    >
                                        {/* PLAYER */}
                                        <div className="flex min-w-0 items-center gap-2">
                                            <Avatar className="h-7 w-7 shrink-0">
                                                <AvatarFallback
                                                    className="
                            bg-primary/10
                            text-[8px]
                            font-bold
                            text-primary
                          "
                                                >
                                                    {getInitials(playerId)}
                                                </AvatarFallback>
                                            </Avatar>

                                            <div className="min-w-0">
                                                <p className="truncate text-[10px] font-semibold">
                                                    {playerName}
                                                </p>

                                                {hasAutoCashout &&
                                                    autoCashoutAt !== null && (
                                                        <p className="text-[8px] text-muted-foreground">
                                                            Auto{" "}
                                                            {autoCashoutAt.toFixed(2)}
                                                            x
                                                        </p>
                                                    )}
                                            </div>
                                        </div>

                                        {/* BET */}
                                        <span className="text-right text-[10px] font-medium">
                                            ETB {formatETB(bet)}
                                        </span>

                                        {/* PAYOUT */}
                                        <span
                                            className={`
                        text-right
                        text-[10px]
                        font-bold
                        ${hasCashedOut
                                                    ? "text-green-500"
                                                    : "text-muted-foreground"
                                                }
                      `}
                                        >
                                            {hasCashedOut &&
                                                payout !== null
                                                ? `${payout.toFixed(2)}x`
                                                : "-"}
                                        </span>

                                        {/* PROFIT */}
                                        <span
                                            className={`
                        text-right
                        text-[10px]
                        font-bold
                        ${hasCashedOut
                                                    ? "text-green-500"
                                                    : "text-muted-foreground"
                                                }
                      `}
                                        >
                                            {hasCashedOut
                                                ? `+ ETB ${formatETB(
                                                    profit ?? 0
                                                )}`
                                                : "-"}
                                        </span>
                                    </div>
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

