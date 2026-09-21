/* eslint-disable */
import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { toast } from 'react-toastify';
import { audio } from './../../../service/audio';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Coins,
    Hash,
    Sparkles,
    Play,
    Square,
    Bomb,
    Gem,
    Trophy,
    TrendingUp,
    CheckCircle2,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from '@/store/hook';
import { setUserWallet } from '@/store/slice/auth';
import { getSocket } from '@/lib/socket';

/* ============================================================
   NOTE ON WHAT CHANGED
   The old `engine` was a client-side, localStorage-backed fake wallet
   that also generated the mine grid on the client -- meaning a
   player could, in principle, just read the mine positions out of
   their own browser state before clicking anything. It's gone.

   The mine layout is now generated on the server and never sent to
   the client until a tile is actually revealed (or the game ends).
   Every reveal is a round trip: "mines:reveal" -> server checks it
   against the hidden layout -> tells you hit or safe. RTP is fixed
   at exactly 95% server-side (see the comment in
   backend/mines/mines.socket.ts for why the martingale structure of
   this game makes that exact, not just approximate).
============================================================ */

const BOARD_SIZE = 25;

interface Wallet {
    balance: number;
    locked_balance: number;
    withdrawable_balance: number;
    available_balance: number;
}

interface MinesStartAck {
    ok: boolean;
    minesCount?: number;
    betAmount?: number;
    wallet?: Wallet;
    error?: string;
}

interface MinesRevealAck {
    ok: boolean;
    isMine?: boolean;
    isFullClear?: boolean;
    revealed?: number[];
    mineIndices?: number[];
    multiplier?: number;
    payout?: number;
    wallet?: Wallet;
    error?: string;
}

interface MinesCashoutAck {
    ok: boolean;
    multiplier?: number;
    payout?: number;
    wallet?: Wallet;
    error?: string;
}

interface MinesRequestStateAck {
    active: boolean;
    minesCount?: number;
    betAmount?: number;
    revealed?: number[];
    multiplier?: number;
}

// Thin promise wrapper around socket.emit's ack callback, with a
// timeout so a dropped connection can't leave the UI stuck in
// "processing" forever.
function emitAsync<T>(socket: ReturnType<typeof getSocket>, event: string, payload: unknown): Promise<T> {
    return new Promise((resolve) => {
        let settled = false;

        const timeout = setTimeout(() => {
            if (settled) return;
            settled = true;
            resolve({ ok: false, error: "Request timed out" } as unknown as T);
        }, 8000);

        socket.emit(event, payload, (result: T) => {
            if (settled) return;
            settled = true;
            clearTimeout(timeout);
            resolve(result);
        });
    });
}

export default function Mines() {
    const dispatch = useAppDispatch();
    const socket = getSocket();
    const user = useAppSelector((state) => state.auth.user);

    const [betAmount, setBetAmount] = useState<number>(100);
    const [minesCount, setMinesCount] = useState<number>(3);
    const [isPlaying, setIsPlaying] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [revealed, setRevealed] = useState<number[]>([]);
    const [mineIndices, setMineIndices] = useState<number[]>([]); // only populated once the game ends in a loss
    const [multiplier, setMultiplier] = useState<number>(0.95);
    const [gameOver, setGameOver] = useState(false);
    const [win, setWin] = useState(false);
    const [lastPayout, setLastPayout] = useState(0);
    const [lastBet, setLastBet] = useState(0);

    // Auto Bet State
    const [mode, setMode] = useState<'MANUAL' | 'AUTO'>('MANUAL');
    const [autoActive, setAutoActive] = useState(false);
    const [autoBetCount, setAutoBetCount] = useState<number>(0);
    const [autoBetsRemaining, setAutoBetsRemaining] = useState<number>(0);

    const autoRef = useRef({ active: false, count: 0, remaining: 0 });
    const betAmountRef = useRef(betAmount);
    const minesCountRef = useRef(minesCount);

    useEffect(() => {
        autoRef.current = { active: autoActive, count: autoBetCount, remaining: autoBetsRemaining };
    }, [autoActive, autoBetCount, autoBetsRemaining]);

    useEffect(() => {
        betAmountRef.current = betAmount;
    }, [betAmount]);

    useEffect(() => {
        minesCountRef.current = minesCount;
    }, [minesCount]);

    const balance = Number(user?.wallets?.available_balance ?? 0);
    const revealedCount = revealed.length;
    const nextPayout = betAmount * multiplier;

    // =====================================================
    // RESUME AN IN-PROGRESS GAME ON CONNECT/RECONNECT
    // =====================================================
    useEffect(() => {
        (async () => {
            const state = await emitAsync<MinesRequestStateAck>(socket, "mines:requestState", {});
            if (state.active) {
                setIsPlaying(true);
                setMinesCount(state.minesCount ?? minesCountRef.current);
                setBetAmount(state.betAmount ?? betAmountRef.current);
                setRevealed(state.revealed ?? []);
                setMultiplier(state.multiplier ?? 0.95);
                setGameOver(false);
            }
        })();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [socket]);

    // =====================================================
    // START
    // =====================================================
    const start = useCallback(async () => {
        if (processing || isPlaying || betAmount > balance || betAmount <= 0) return;

        setProcessing(true);
        audio.playBet();

        const result = await emitAsync<MinesStartAck>(socket, "mines:start", { betAmount, minesCount });

        if (!result.ok) {
            toast.error(result.error || "Could not start the game");
            setProcessing(false);
            return;
        }

        setRevealed([]);
        setMineIndices([]);
        setIsPlaying(true);
        setGameOver(false);
        setWin(false);
        setMultiplier(0.95);

        if (result.wallet) dispatch(setUserWallet(result.wallet));

        setProcessing(false);
    }, [processing, isPlaying, betAmount, minesCount, balance, socket, dispatch]);

    // =====================================================
    // REVEAL ONE TILE -- returns the ack so callers (manual click vs
    // the auto-play sequence) can react to it themselves.
    // =====================================================
    const revealTile = useCallback(
        async (index: number): Promise<MinesRevealAck> => {
            const result = await emitAsync<MinesRevealAck>(socket, "mines:reveal", { index });

            if (!result.ok) {
                toast.error(result.error || "Could not reveal that tile");
                return result;
            }

            if (result.isMine) {
                setMineIndices(result.mineIndices ?? []);
                setRevealed(result.revealed ?? []);
                setGameOver(true);
                setWin(false);
                setIsPlaying(false);
                setLastBet(betAmountRef.current);
                audio.playLoss();
                if (result.wallet) dispatch(setUserWallet(result.wallet));
                return result;
            }

            setRevealed(result.revealed ?? []);
            setMultiplier(result.multiplier ?? multiplier);

            if (result.isFullClear) {
                setGameOver(true);
                setWin(true);
                setIsPlaying(false);
                setLastPayout(result.payout ?? 0);
                audio.playWin();
                if (result.wallet) dispatch(setUserWallet(result.wallet));
            }

            return result;
        },
        [socket, dispatch, multiplier],
    );

    // =====================================================
    // MANUAL CLICK
    // =====================================================
    const click = useCallback(
        async (i: number) => {
            if (!isPlaying || revealed.includes(i) || gameOver || processing) return;

            setProcessing(true);
            audio.playClick();
            await revealTile(i);
            setProcessing(false);
        },
        [isPlaying, revealed, gameOver, processing, revealTile],
    );

    // =====================================================
    // CASH OUT
    // =====================================================
    const cashOut = useCallback(async () => {
        if (!isPlaying || processing) return;

        setProcessing(true);
        const result = await emitAsync<MinesCashoutAck>(socket, "mines:cashout", {});

        if (!result.ok) {
            toast.error(result.error || "Could not cash out");
            setProcessing(false);
            return;
        }

        audio.playWin();
        setIsPlaying(false);
        setGameOver(true);
        setWin(true);
        setMultiplier(result.multiplier ?? multiplier);
        setLastPayout(result.payout ?? 0);
        if (result.wallet) dispatch(setUserWallet(result.wallet));
        setProcessing(false);
    }, [isPlaying, processing, socket, dispatch, multiplier]);

    // =====================================================
    // AUTO MODE -- starts a game, reveals 3 random tiles in
    // sequence (each one a real round trip, since the server
    // has to check each one before the next can happen), then
    // cashes out if it survived all 3. Matches the original
    // "auto plays 3 random tiles then cashes out" behavior,
    // just against the real backend instead of a fake local RNG.
    // =====================================================
    const runAutoRound = useCallback(async () => {
        if (betAmountRef.current > balance) {
            setAutoActive(false);
            return;
        }

        setProcessing(true);
        audio.playBet();

        const startResult = await emitAsync<MinesStartAck>(socket, "mines:start", {
            betAmount: betAmountRef.current,
            minesCount: minesCountRef.current,
        });

        if (!startResult.ok) {
            toast.error(startResult.error || "Could not start the game");
            setAutoActive(false);
            setProcessing(false);
            return;
        }

        setRevealed([]);
        setMineIndices([]);
        setIsPlaying(true);
        setGameOver(false);
        setWin(false);
        setMultiplier(0.95);
        if (startResult.wallet) dispatch(setUserWallet(startResult.wallet));

        const picks: number[] = [];
        while (picks.length < 3) {
            const r = Math.floor(Math.random() * BOARD_SIZE);
            if (!picks.includes(r)) picks.push(r);
        }

        let busted = false;

        for (const index of picks) {
            const result = await revealTile(index);
            if (!result.ok || result.isMine || result.isFullClear) {
                busted = result.isMine ?? false;
                if (!result.ok) busted = true; // treat a failed reveal as a stop, not a cashout attempt
                break;
            }
        }

        if (!busted) {
            const cashoutResult = await emitAsync<MinesCashoutAck>(socket, "mines:cashout", {});
            if (cashoutResult.ok) {
                audio.playWin();
                setIsPlaying(false);
                setGameOver(true);
                setWin(true);
                setMultiplier(cashoutResult.multiplier ?? multiplier);
                setLastPayout(cashoutResult.payout ?? 0);
                if (cashoutResult.wallet) dispatch(setUserWallet(cashoutResult.wallet));
            }
        }

        setProcessing(false);
    }, [balance, socket, dispatch, revealTile, multiplier]);

    // Auto Loop
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;
        if (autoActive && !isPlaying && !gameOver && !processing) {
            const { count, remaining } = autoRef.current;

            if (count === 0 || remaining > 0) {
                timeout = setTimeout(() => {
                    runAutoRound();
                    if (count > 0) setAutoBetsRemaining(prev => Math.max(prev - 1, 0));
                }, 1000);
            } else {
                setAutoActive(false);
            }
        }
        return () => clearTimeout(timeout);
    }, [autoActive, isPlaying, gameOver, processing, runAutoRound]);

    // Restart delay after game over in Auto mode
    useEffect(() => {
        let timeout: ReturnType<typeof setTimeout>;
        if (autoActive && gameOver) {
            timeout = setTimeout(() => {
                setGameOver(false);
            }, 1500);
        }
        return () => clearTimeout(timeout);
    }, [gameOver, autoActive]);

    const toggleAuto = () => {
        if (autoActive) {
            setAutoActive(false);
        } else {
            setAutoBetsRemaining(autoBetCount === 0 ? 999999 : autoBetCount);
            setAutoActive(true);
        }
    };

    const minesOptions = [1, 3, 5, 13];

    // =====================================================
    // RENDER
    // =====================================================
    return (
        <div className="space-y-1 px-1.5 py-1.5 sm:px-2 sm:py-2">
            {/* ==================== HEADER ==================== */}
            <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary via-primary to-primary/85 px-2 py-1.5 text-primary-foreground shadow-sm">
                <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full border-2 border-primary-foreground/15" />
                <div className="pointer-events-none absolute -bottom-5 -left-5 h-14 w-14 rounded-full border border-primary-foreground/10" />

                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <div className="flex h-5 w-5 items-center justify-center rounded-md bg-primary-foreground/15 shadow-inner">
                            <Bomb className="h-2.5 w-2.5" strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-[10px] font-black uppercase leading-none tracking-wider">
                                Mines
                            </h1>
                            <p className="text-[6px] font-medium uppercase tracking-widest text-primary-foreground/70">
                                {gameOver
                                    ? win
                                        ? "You won!"
                                        : "Game over"
                                    : isPlaying
                                        ? "Pick a tile"
                                        : autoActive
                                            ? "Auto running"
                                            : "Place your bet"}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-end">
                        <span className="text-[6px] uppercase tracking-wider text-primary-foreground/70">
                            Balance
                        </span>
                        <span className="text-[9px] font-bold leading-tight">
                            {balance.toFixed(2)}
                            <span className="ml-0.5 text-[6px] font-normal opacity-80">
                                ETB
                            </span>
                        </span>
                    </div>
                </div>

                {/* Stats row */}
                <div className="relative z-10 mt-1.5 grid grid-cols-4 gap-0.5">
                    <div className="rounded bg-primary-foreground/10 px-1 py-0.5 text-center backdrop-blur-sm">
                        <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
                            <Bomb className="h-1.5 w-1.5" />
                            <span className="text-[5px] uppercase tracking-wider">
                                Mines
                            </span>
                        </div>
                        <p className="mt-0.5 text-[9px] font-bold leading-none">
                            {minesCount}
                        </p>
                    </div>

                    <div className="rounded bg-primary-foreground/10 px-1 py-0.5 text-center backdrop-blur-sm">
                        <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
                            <Gem className="h-1.5 w-1.5" />
                            <span className="text-[5px] uppercase tracking-wider">
                                Gems
                            </span>
                        </div>
                        <p className="mt-0.5 text-[9px] font-bold leading-none">
                            {revealedCount}
                        </p>
                    </div>

                    <div className="rounded bg-primary-foreground/10 px-1 py-0.5 text-center backdrop-blur-sm">
                        <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
                            <TrendingUp className="h-1.5 w-1.5" />
                            <span className="text-[5px] uppercase tracking-wider">
                                Mult
                            </span>
                        </div>
                        <p className="mt-0.5 text-[9px] font-bold leading-none">
                            {multiplier.toFixed(2)}x
                        </p>
                    </div>

                    <div className="rounded bg-primary-foreground/10 px-1 py-0.5 text-center backdrop-blur-sm">
                        <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
                            <Trophy className="h-1.5 w-1.5" />
                            <span className="text-[5px] uppercase tracking-wider">
                                Payout
                            </span>
                        </div>
                        <p className="mt-0.5 text-[9px] font-bold leading-none">
                            {nextPayout.toFixed(0)}
                        </p>
                    </div>
                </div>
            </div>

            {/* ==================== BOARD ==================== */}
            <Card className="overflow-hidden rounded-lg border-border/60 shadow-sm">
                <CardContent className="p-1">
                    <div className="grid grid-cols-5 gap-1">
                        {Array.from({ length: BOARD_SIZE }, (_, i) => {
                            const isRevealed = revealed && revealed?.includes(i);
                            const isMineTile = mineIndices && mineIndices?.includes(i);
                            const dimmed = !isPlaying && !gameOver;

                            let stateClass = "";
                            if (isRevealed) {
                                stateClass =
                                    "bg-green-500 text-white border-green-400 shadow-[0_0_12px_rgba(34,197,94,0.7)]";
                            } else if (gameOver && isMineTile) {
                                // Only known once the game has ended in a loss.
                                stateClass =
                                    "bg-red-500 text-white border-red-400 shadow-[0_0_12px_rgba(239,68,68,0.7)]";
                            } else if (dimmed) {
                                stateClass =
                                    "bg-slate-700/60 border-slate-500/60 text-slate-400 opacity-70";
                            } else {
                                stateClass =
                                    "bg-slate-600 border-slate-400 hover:bg-slate-500 hover:border-primary hover:-translate-y-0.5 cursor-pointer shadow-sm";
                            }

                            return (
                                <button
                                    key={i}
                                    onClick={() => click(i)}
                                    disabled={!isPlaying || isRevealed || autoActive || processing}
                                    className={`relative flex aspect-square items-center justify-center rounded-md border-2 transition-all duration-200 active:scale-95 disabled:cursor-not-allowed ${stateClass}`}
                                >
                                    {isRevealed && (
                                        <Gem className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={2.5} />
                                    )}
                                    {!isRevealed && gameOver && isMineTile && (
                                        <Bomb className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={2.5} />
                                    )}
                                    {!isRevealed && !(gameOver && isMineTile) && isPlaying && (
                                        <span className="h-1 w-1 rounded-full bg-white/40" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* ==================== CONTROLS ==================== */}
            <Card className="rounded-lg border-border/60 shadow-sm">
                <CardContent className="space-y-1.5 p-1.5">
                    {/* Manual / Auto tabs */}
                    <Tabs
                        value={mode}
                        onValueChange={(v) => setMode(v as 'MANUAL' | 'AUTO')}
                    >
                        <TabsList className="grid h-5 w-full grid-cols-2 rounded-md bg-muted/70 p-0.5">
                            <TabsTrigger
                                value="MANUAL"
                                disabled={autoActive || isPlaying}
                                className="h-4 rounded text-[7px] font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                Manual
                            </TabsTrigger>
                            <TabsTrigger
                                value="AUTO"
                                disabled={autoActive || isPlaying}
                                className="h-4 rounded text-[7px] font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                Auto
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {/* Bet amount + auto rounds */}
                    <div className={mode === 'AUTO' ? "grid grid-cols-2 gap-1" : ""}>
                        <div className="space-y-0.5">
                            <Label className="flex items-center gap-0.5 text-[6px] uppercase tracking-wider text-muted-foreground">
                                <Coins className="h-1.5 w-1.5" />
                                Bet Amount
                            </Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    value={betAmount}
                                    onChange={(e) => setBetAmount(Number(e.target.value))}
                                    disabled={isPlaying || autoActive}
                                    className="h-6 rounded-md pr-6 text-center text-[9px] font-bold"
                                />
                                <span className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-[6px] font-medium text-muted-foreground">
                                    ETB
                                </span>
                            </div>
                        </div>

                        {mode === 'AUTO' && (
                            <div className="space-y-0.5 animate-in fade-in slide-in-from-top-1">
                                <Label className="flex items-center gap-0.5 text-[6px] uppercase tracking-wider text-muted-foreground">
                                    <Hash className="h-1.5 w-1.5" />
                                    Rounds
                                </Label>
                                <Input
                                    type="number"
                                    value={autoBetCount}
                                    onChange={(e) => setAutoBetCount(Number(e.target.value))}
                                    disabled={autoActive}
                                    placeholder="0 = ∞"
                                    className="h-6 rounded-md text-center text-[9px] font-bold"
                                />
                            </div>
                        )}
                    </div>

                    {/* Mines selector */}
                    <div className="space-y-0.5">
                        <Label className="flex items-center gap-0.5 text-[6px] uppercase tracking-wider text-muted-foreground">
                            <Bomb className="h-1.5 w-1.5" />
                            Danger Mines
                        </Label>
                        <div className="grid grid-cols-4 gap-0.5">
                            {minesOptions.map((m) => (
                                <Button
                                    key={m}
                                    onClick={() => setMinesCount(m)}
                                    disabled={isPlaying || autoActive}
                                    variant={minesCount === m ? "default" : "outline"}
                                    size="sm"
                                    className={`h-6 rounded-md text-[8px] font-bold ${minesCount === m
                                        ? "shadow-sm"
                                        : "text-muted-foreground"
                                        }`}
                                >
                                    {m}
                                </Button>
                            ))}
                        </div>
                    </div>

                    {/* Action button */}
                    {mode === 'MANUAL' ? (
                        !isPlaying ? (
                            <Button
                                onClick={start}
                                disabled={processing || betAmount <= 0 || betAmount > balance}
                                className="h-7 w-full rounded-md text-[8px] font-bold uppercase tracking-widest shadow-sm"
                            >
                                <Play className="mr-1 h-2 w-2 fill-current" />
                                {processing ? "Starting..." : "Start Game"}
                            </Button>
                        ) : (
                            <Button
                                onClick={() => cashOut()}
                                disabled={processing || revealedCount === 0}
                                className="h-7 w-full rounded-md bg-green-500 text-white hover:bg-green-600 text-[8px] font-bold uppercase tracking-widest shadow-sm"
                            >
                                <CheckCircle2 className="mr-1 h-2 w-2" />
                                Cashout · {nextPayout.toFixed(2)} ETB
                            </Button>
                        )
                    ) : (
                        <Button
                            onClick={toggleAuto}
                            variant={autoActive ? "destructive" : "default"}
                            disabled={processing && !autoActive}
                            className="h-7 w-full rounded-md text-[8px] font-bold uppercase tracking-widest shadow-sm"
                        >
                            {autoActive ? (
                                <>
                                    <Square className="mr-1 h-2 w-2 fill-current" />
                                    Stop Auto
                                    {autoBetsRemaining !== 999999 && (
                                        <span className="ml-1 text-[7px] font-normal opacity-80">
                                            · {autoBetsRemaining} left
                                        </span>
                                    )}
                                </>
                            ) : (
                                <>
                                    <Sparkles className="mr-1 h-2 w-2" />
                                    Start Auto Play
                                </>
                            )}
                        </Button>
                    )}

                    {/* Auto info */}
                    {mode === 'AUTO' && !autoActive && (
                        <p className="text-center text-[6px] text-muted-foreground">
                            Auto plays 3 random tiles then cashes out
                        </p>
                    )}
                </CardContent>
            </Card>

            {/* ==================== RESULT POPUP ==================== */}
            <Dialog open={gameOver} onOpenChange={(open) => !open && !autoActive && setGameOver(false)}>
                <DialogContent
                    className="max-w-[260px] rounded-xl p-3"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <DialogHeader className="space-y-0.5">
                        <DialogTitle className="flex items-center gap-1.5 text-xs">
                            {win ? (
                                <>
                                    <Trophy className="h-3 w-3 text-green-500" />
                                    You Won!
                                </>
                            ) : (
                                <>
                                    <Bomb className="h-3 w-3 text-red-500" />
                                    Game Over
                                </>
                            )}
                        </DialogTitle>
                        <DialogDescription className="text-[8px]">
                            {win
                                ? `You revealed ${revealedCount} gems at ${multiplier.toFixed(2)}x.`
                                : `You hit a mine after ${revealedCount} gem${revealedCount === 1 ? '' : 's'}.`}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Result panel */}
                    <div
                        className={`rounded-lg p-2 text-center ${win
                            ? "bg-gradient-to-r from-green-500/15 to-green-500/5"
                            : "bg-muted/40"
                            }`}
                    >
                        <p className="text-[7px] uppercase tracking-widest text-muted-foreground">
                            {win ? "Payout" : "Lost"}
                        </p>
                        <p
                            className={`mt-0.5 text-base font-black italic tracking-tight ${win ? "text-green-500" : "text-red-500"
                                }`}
                        >
                            {win
                                ? `+${lastPayout.toFixed(2)} ETB`
                                : `-${lastBet.toFixed(2)} ETB`}
                        </p>
                        <p className="mt-0.5 text-[7px] text-muted-foreground">
                            {revealedCount} gems · {multiplier.toFixed(2)}x
                        </p>
                    </div>

                    {/* Actions */}
                    {!autoActive && (
                        <div className="mt-1 flex gap-1">
                            <Button
                                onClick={() => setGameOver(false)}
                                variant="outline"
                                className="h-6 flex-1 rounded-md text-[7px] font-bold uppercase tracking-widest"
                            >
                                Dismiss
                            </Button>
                            {win && (
                                <Button
                                    onClick={() => {
                                        setGameOver(false);
                                        start();
                                    }}
                                    className="h-6 flex-1 rounded-md text-[7px] font-bold uppercase tracking-widest"
                                >
                                    <Play className="mr-1 h-2 w-2 fill-current" />
                                    Again
                                </Button>
                            )}
                        </div>
                    )}

                    {autoActive && (
                        <p className="mt-1 text-center text-[7px] text-muted-foreground">
                            Auto continues in 1.5s
                        </p>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}