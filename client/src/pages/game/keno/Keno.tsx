/* eslint-disable */
import { useState, useEffect, useRef, useCallback } from "react";
import { engine } from "./../../../service/engine";
import { audio } from "./../../../service/audio";
import { GameType } from "./type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
    RotateCcw,
    Target,
    Dices,
    Trophy,
    Timer,
    CheckCircle2,
} from "lucide-react";
import { useAppSelector } from "@/store/hook";

type Phase = "BETTING" | "DRAWING" | "RESULT";

const BETTING_DURATION = 15; // seconds
const RESULT_DURATION = 4;   // seconds

export default function Keno() {
    const user = useAppSelector((state) => state.auth.user);

    const [betAmount, setBetAmount] = useState<number>(100);
    const [selected, setSelected] = useState<number[]>([]);
    const [drawn, setDrawn] = useState<number[]>([]);
    const [phase, setPhase] = useState<Phase>("BETTING");
    const [phaseTimeLeft, setPhaseTimeLeft] = useState<number>(BETTING_DURATION);
    const [roundId, setRoundId] = useState<number>(1);

    // The user's entry for the current round
    const [myEntry, setMyEntry] = useState<{
        numbers: number[];
        amount: number;
    } | null>(null);
    const [roundResult, setRoundResult] = useState<{
        hits: number;
        payout: number;
    } | null>(null);

    const [mode, setMode] = useState<"MANUAL" | "AUTO">("MANUAL");
    const [autoActive, setAutoActive] = useState(false);
    const [autoBetCount, setAutoBetCount] = useState<number>(0);
    const [autoBetsRemaining, setAutoBetsRemaining] = useState<number>(0);

    const [drawPopupOpen, setDrawPopupOpen] = useState(false);

    const autoRef = useRef({ active: false, count: 0, remaining: 0 });
    const bettingEndAtRef = useRef<number | null>(null);

    // Keep refs in sync
    useEffect(() => {
        autoRef.current = {
            active: autoActive,
            count: autoBetCount,
            remaining: autoBetsRemaining,
        };
    }, [autoActive, autoBetCount, autoBetsRemaining]);

    // Open popup during drawing/result only
    useEffect(() => {
        if (phase === "DRAWING" || phase === "RESULT") setDrawPopupOpen(true);
        else setDrawPopupOpen(false);
    }, [phase]);

    // =====================================================
    // PHASE TIMER
    // =====================================================
    useEffect(() => {
        const interval = setInterval(() => {
            setPhaseTimeLeft((prev) => {
                if (prev <= 1) return 0;
                return prev - 1;
            });
        }, 1000);
        return () => clearInterval(interval);
    }, [phase, roundId]);

    // Phase transitions when timer hits 0
    useEffect(() => {
        if (phaseTimeLeft !== 0) return;

        if (phase === "BETTING") {
            // → Start DRAWING
            setPhase("DRAWING");
        } else if (phase === "RESULT") {
            // → Next round: reset to BETTING
            setRoundId((r) => r + 1);
            setDrawn([]);
            setMyEntry(null);
            setRoundResult(null);
            setPhase("BETTING");
            setPhaseTimeLeft(BETTING_DURATION);
        }
    }, [phaseTimeLeft, phase]);

    // =====================================================
    // HANDLE BET PLACEMENT
    // =====================================================
    const placeBet = useCallback(() => {
        if (phase !== "BETTING") return;
        if (selected.length === 0 || betAmount <= 0) return;
        if (betAmount > engine.getSession().balance) return;

        setMyEntry({ numbers: [...selected], amount: betAmount });
        audio.playBet();

        // If auto mode, decrement remaining
        if (autoRef.current.active && autoRef.current.count > 0) {
            setAutoBetsRemaining((prev) => Math.max(prev - 1, 0));
        }
    }, [phase, selected, betAmount]);

    // =====================================================
    // AUTO MODE - auto place bets at start of BETTING
    // =====================================================
    useEffect(() => {
        if (phase !== "BETTING") return;
        if (!autoRef.current.active) return;

        const { count, remaining } = autoRef.current;

        // Check auto-stop conditions
        if (count > 0 && remaining <= 0) {
            setAutoActive(false);
            return;
        }
        if (engine.getSession().balance < betAmount) {
            setAutoActive(false);
            return;
        }
        if (selected.length === 0) {
            setAutoActive(false);
            return;
        }

        // Auto place bet (if not already placed this round)
        if (!myEntry) {
            setMyEntry({ numbers: [...selected], amount: betAmount });
            if (count > 0) {
                setAutoBetsRemaining((prev) => Math.max(prev - 1, 0));
            }
        }
    }, [phase, roundId, autoActive]); // eslint-disable-line

    // =====================================================
    // DRAWING LOGIC
    // =====================================================
    useEffect(() => {
        if (phase !== "DRAWING") return;

        setDrawn([]);
        let count = 0;
        let currentDrawn: number[] = [];
        const localSelected = myEntry?.numbers ?? [];

        const interval = setInterval(() => {
            let next: number;
            do {
                next = Math.floor(Math.random() * 40) + 1;
            } while (currentDrawn.includes(next));

            currentDrawn = [...currentDrawn, next];
            setDrawn([...currentDrawn]);
            count++;
            audio.playSpin();

            if (count >= 10) {
                clearInterval(interval);

                setTimeout(() => {
                    // Calculate result
                    const finalHits = localSelected.filter((x) =>
                        currentDrawn.includes(x)
                    ).length;
                    const multi = finalHits > 0 ? finalHits * 1.5 : 0;
                    const payout =
                        myEntry != null ? multi * myEntry.amount : 0;

                    if (myEntry) {
                        if (finalHits > 0) audio.playWin();
                        else audio.playLoss();
                        engine.placeBet(
                            GameType.KENO,
                            myEntry.amount,
                            multi,
                            `Keno Round #${roundId}: ${finalHits} hits`
                        );
                    }

                    setRoundResult({ hits: finalHits, payout });
                    setPhase("RESULT");
                    setPhaseTimeLeft(RESULT_DURATION);
                }, 200);
            }
        }, 200); // 10 numbers over 2s

        return () => clearInterval(interval);
    }, [phase, roundId]); // eslint-disable-line

    // =====================================================
    // UI HELPERS
    // =====================================================
    const toggle = (n: number) => {
        if (phase !== "BETTING") return;
        if (myEntry) return; // bet already placed
        if (selected.includes(n)) setSelected(selected.filter((x) => x !== n));
        else if (selected.length < 10) setSelected([...selected, n]);
        audio.playClick();
    };

    const toggleAuto = () => {
        if (autoActive) {
            setAutoActive(false);
        } else {
            if (selected.length === 0) return;
            setAutoBetsRemaining(autoBetCount === 0 ? 999999 : autoBetCount);
            setAutoActive(true);
        }
    };

    const cancelBet = () => {
        if (phase !== "BETTING") return;
        if (autoActive) return;
        setMyEntry(null);
    };

    const isBetted = myEntry !== null;
    const hits = roundResult?.hits ?? 0;
    const payout = roundResult?.payout ?? 0;
    const odds = (selected.length * 1.5).toFixed(1);
    const balance = Number(user?.wallets?.available_balance ?? 0);

    const drawnSlots = Array.from({ length: 10 }, (_, i) => drawn[i] ?? null);

    // =====================================================
    // RENDER
    // =====================================================
    return (
        <div className="space-y-1.5 px-2 py-2 sm:px-2.5 sm:py-2.5">
            {/* ==================== HEADER ==================== */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary via-primary to-primary/85 px-3 py-2.5 text-primary-foreground shadow-sm">
                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full border-4 border-primary-foreground/15" />
                <div className="pointer-events-none absolute -bottom-6 -left-6 h-20 w-20 rounded-full border border-primary-foreground/10" />

                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-foreground/15 shadow-inner">
                            <Dices className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-sm font-black uppercase leading-none tracking-wider">
                                Keno · R{roundId}
                            </h1>
                            <p className="text-[7px] font-medium uppercase tracking-widest text-primary-foreground/70">
                                {phase === "BETTING"
                                    ? "Place your bets"
                                    : phase === "DRAWING"
                                        ? "Numbers are being drawn"
                                        : "Round result"}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-end">
                        <span className="text-[7px] uppercase tracking-wider text-primary-foreground/70">
                            Balance
                        </span>
                        <span className="text-[11px] font-bold leading-tight">
                            {balance.toFixed(2)}
                            <span className="ml-0.5 text-[7px] font-normal opacity-80">
                                ETB
                            </span>
                        </span>
                    </div>
                </div>

                {/* Stats + phase */}
                <div className="relative z-10 mt-2 grid grid-cols-4 gap-1">
                    <div className="rounded-md bg-primary-foreground/10 px-1.5 py-1 text-center backdrop-blur-sm">
                        <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
                            <Target className="h-2 w-2" />
                            <span className="text-[6px] uppercase tracking-wider">
                                Picks
                            </span>
                        </div>
                        <p className="mt-0.5 text-[11px] font-bold leading-none">
                            {selected.length}
                            <span className="text-[7px] font-normal opacity-70">/10</span>
                        </p>
                    </div>

                    <div className="rounded-md bg-primary-foreground/10 px-1.5 py-1 text-center backdrop-blur-sm">
                        <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
                            <Sparkles className="h-2 w-2" />
                            <span className="text-[6px] uppercase tracking-wider">
                                Odds
                            </span>
                        </div>
                        <p className="mt-0.5 text-[11px] font-bold leading-none">
                            {odds}x
                        </p>
                    </div>

                    <div className="rounded-md bg-primary-foreground/10 px-1.5 py-1 text-center backdrop-blur-sm">
                        <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
                            <Target className="h-2 w-2" />
                            <span className="text-[6px] uppercase tracking-wider">
                                Hits
                            </span>
                        </div>
                        <p className="mt-0.5 text-[11px] font-bold leading-none">
                            {hits}
                        </p>
                    </div>

                    {/* Timer chip */}
                    <div
                        className={`rounded-md px-1.5 py-1 text-center backdrop-blur-sm ${phase === "BETTING"
                            ? "bg-primary-foreground/10"
                            : phase === "DRAWING"
                                ? "bg-primary-foreground/20 animate-pulse"
                                : "bg-primary-foreground/10"
                            }`}
                    >
                        <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
                            <Timer className="h-2 w-2" />
                            <span className="text-[6px] uppercase tracking-wider">
                                {phase === "BETTING"
                                    ? "Bet In"
                                    : phase === "DRAWING"
                                        ? "Draw"
                                        : "Next"}
                            </span>
                        </div>
                        <p className="mt-0.5 text-[11px] font-bold leading-none">
                            {phaseTimeLeft}s
                        </p>
                    </div>
                </div>
            </div>

            {/* ==================== BOARD ==================== */}
            <Card className="overflow-hidden rounded-xl border-border/60 shadow-sm">
                <CardContent className="p-1.5">
                    <div className="grid grid-cols-5 gap-1">
                        {[...Array(40)].map((_, i) => {
                            const n = i + 1;
                            const isSelected = selected.includes(n);
                            const isDrawn = drawn.includes(n);
                            const isHit = isSelected && isDrawn;
                            const locked = phase !== "BETTING" || isBetted;

                            let stateClass =
                                "bg-muted/30 text-foreground border-border/40 hover:border-primary/50 hover:bg-muted/50";
                            if (isHit)
                                stateClass =
                                    "bg-green-500 text-white border-green-500 shadow-[0_0_10px_rgba(34,197,94,0.55)] scale-105 z-10";
                            else if (isDrawn)
                                stateClass =
                                    "bg-foreground text-background border-foreground scale-105";
                            else if (isSelected)
                                stateClass =
                                    "bg-primary text-primary-foreground border-primary shadow-inner";

                            return (
                                <button
                                    key={n}
                                    onClick={() => toggle(n)}
                                    disabled={locked}
                                    className={`relative flex aspect-square items-center justify-center rounded-lg border text-[11px] font-bold transition-all duration-150 active:scale-95 disabled:cursor-not-allowed ${stateClass}`}
                                >
                                    {n}
                                    {isHit && (
                                        <span className="pointer-events-none absolute inset-0 animate-pulse rounded-lg bg-white/25" />
                                    )}
                                    {isSelected && !isDrawn && (
                                        <span className="pointer-events-none absolute -right-0.5 -top-0.5 h-1.5 w-1.5 rounded-full bg-primary-foreground shadow-sm" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </CardContent>
            </Card>

            {/* ==================== BET CONTROLS ==================== */}
            <Card className="rounded-xl border-border/60 shadow-sm">
                <CardContent className="space-y-2 p-2">
                    {/* Manual / Auto tabs */}
                    <Tabs
                        value={mode}
                        onValueChange={(v) => setMode(v as "MANUAL" | "AUTO")}
                    >
                        <TabsList className="grid h-7 w-full grid-cols-2 rounded-lg bg-muted/70 p-0.5">
                            <TabsTrigger
                                value="MANUAL"
                                disabled={autoActive}
                                className="h-6 rounded-md text-[9px] font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                Manual
                            </TabsTrigger>
                            <TabsTrigger
                                value="AUTO"
                                disabled={autoActive}
                                className="h-6 rounded-md text-[9px] font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                Auto
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {/* Bet amount + auto rounds */}
                    <div className={mode === "AUTO" ? "grid grid-cols-2 gap-1.5" : ""}>
                        <div className="space-y-1">
                            <Label className="flex items-center gap-1 text-[8px] uppercase tracking-wider text-muted-foreground">
                                <Coins className="h-2.5 w-2.5" />
                                Bet Amount
                            </Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    value={betAmount}
                                    onChange={(e) => setBetAmount(Number(e.target.value))}
                                    disabled={isBetted || autoActive || phase !== "BETTING"}
                                    className="h-8 rounded-lg pr-9 text-center text-[11px] font-bold"
                                />
                                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[7px] font-medium text-muted-foreground">
                                    ETB
                                </span>
                            </div>
                        </div>

                        {mode === "AUTO" && (
                            <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                                <Label className="flex items-center gap-1 text-[8px] uppercase tracking-wider text-muted-foreground">
                                    <Hash className="h-2.5 w-2.5" />
                                    Rounds
                                </Label>
                                <Input
                                    type="number"
                                    value={autoBetCount}
                                    onChange={(e) => setAutoBetCount(Number(e.target.value))}
                                    disabled={autoActive}
                                    placeholder="0 = ∞"
                                    className="h-8 rounded-lg text-center text-[11px] font-bold"
                                />
                            </div>
                        )}
                    </div>

                    {/* Action button */}
                    {!isBetted && !autoActive && (
                        <Button
                            onClick={placeBet}
                            disabled={
                                phase !== "BETTING" ||
                                selected.length === 0 ||
                                betAmount <= 0 ||
                                betAmount > balance
                            }
                            className="h-9 w-full rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-sm"
                        >
                            <Play className="mr-1.5 h-3 w-3 fill-current" />
                            Place Bet
                            {selected.length > 0 && betAmount > 0 && (
                                <span className="ml-1.5 text-[9px] font-normal opacity-80">
                                    · {betAmount} ETB
                                </span>
                            )}
                        </Button>
                    )}

                    {isBetted && !autoActive && (
                        <div className="flex gap-1.5">
                            <div className="flex h-9 flex-1 items-center justify-center gap-1 rounded-lg border border-green-500/30 bg-green-500/10 text-[10px] font-bold text-green-600 dark:text-green-400">
                                <CheckCircle2 className="h-3 w-3" />
                                Bet placed · {myEntry?.amount} ETB
                            </div>
                            {phase === "BETTING" && (
                                <Button
                                    onClick={cancelBet}
                                    variant="outline"
                                    size="sm"
                                    className="h-9 rounded-lg px-2 text-[9px]"
                                >
                                    Cancel
                                </Button>
                            )}
                        </div>
                    )}

                    {autoActive && (
                        <div className="space-y-1.5">
                            <div className="flex h-9 items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 text-[10px] font-bold text-primary">
                                <Sparkles className="h-3 w-3" />
                                Auto running
                                {autoBetsRemaining !== 999999 && (
                                    <Badge
                                        variant="secondary"
                                        className="h-4 rounded-md px-1 text-[8px]"
                                    >
                                        {autoBetsRemaining} left
                                    </Badge>
                                )}
                            </div>
                            <Button
                                onClick={toggleAuto}
                                variant="destructive"
                                className="h-9 w-full rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-sm"
                            >
                                <Square className="mr-1.5 h-3 w-3 fill-current" />
                                Stop Auto
                            </Button>
                        </div>
                    )}

                    {/* Auto toggle (when not active) */}
                    {!autoActive && mode === "AUTO" && (
                        <Button
                            onClick={toggleAuto}
                            variant="secondary"
                            disabled={selected.length === 0}
                            className="h-8 w-full rounded-lg text-[9px] font-bold uppercase tracking-widest"
                        >
                            <Sparkles className="mr-1.5 h-3 w-3" />
                            Start Auto Betting
                        </Button>
                    )}
                </CardContent>
            </Card>

            <div className="h-1" />

            {/* ==================== DRAW POPUP ==================== */}
            <Dialog
                open={drawPopupOpen}
                onOpenChange={(open) => !open && setDrawPopupOpen(false)}
            >
                <DialogContent
                    className="max-w-[340px] rounded-2xl p-4"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-base">
                            <Dices className="h-4 w-4 text-primary" />
                            {phase === "DRAWING"
                                ? `Round #${roundId} · Drawing...`
                                : `Round #${roundId} · Result`}
                        </DialogTitle>
                        <DialogDescription className="text-[10px]">
                            {phase === "DRAWING"
                                ? "Watch the numbers being drawn live."
                                : myEntry
                                    ? `You picked ${myEntry.numbers.length} numbers for ${myEntry.amount} ETB.`
                                    : "You didn't place a bet this round."}
                        </DialogDescription>
                    </DialogHeader>

                    {/* Drawn balls */}
                    <div className="grid grid-cols-5 gap-1.5 py-2">
                        {drawnSlots.map((num, idx) => {
                            const isHit =
                                num !== null && myEntry?.numbers.includes(num);
                            return (
                                <div
                                    key={idx}
                                    className={`flex aspect-square items-center justify-center rounded-full text-xs font-bold transition-all duration-300 ${num === null
                                        ? "border border-dashed border-border/50 bg-muted/20 text-muted-foreground/30"
                                        : isHit
                                            ? "scale-110 bg-green-500 text-white shadow-[0_0_14px_rgba(34,197,94,0.6)] ring-2 ring-green-500/40"
                                            : "bg-primary text-primary-foreground shadow-md ring-2 ring-primary/20"
                                        }`}
                                >
                                    {num ?? "?"}
                                </div>
                            );
                        })}
                    </div>

                    {/* Progress while drawing */}
                    {phase === "DRAWING" && (
                        <div className="mt-1">
                            <div className="mb-1 flex items-center justify-between text-[9px] text-muted-foreground">
                                <span>Progress</span>
                                <span>{drawn.length}/10</span>
                            </div>
                            <div className="h-1 w-full overflow-hidden rounded-full bg-muted">
                                <div
                                    className="h-full rounded-full bg-primary transition-all duration-200"
                                    style={{ width: `${(drawn.length / 10) * 100}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Result panel */}
                    {phase === "RESULT" && roundResult && (
                        <div
                            className={`mt-1 rounded-xl p-3 text-center ${roundResult.hits > 0
                                ? "bg-gradient-to-r from-green-500/15 to-green-500/5"
                                : "bg-muted/40"
                                }`}
                        >
                            <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                                Outcome
                            </p>
                            <p
                                className={`mt-0.5 text-xl font-black italic tracking-tight ${roundResult.hits > 0
                                    ? "text-green-500"
                                    : "text-muted-foreground"
                                    }`}
                            >
                                {roundResult.hits > 0
                                    ? `${roundResult.hits} HITS!`
                                    : "ZERO HITS"}
                            </p>
                            {roundResult.payout > 0 && (
                                <p className="mt-0.5 text-[10px] font-medium text-green-600 dark:text-green-400">
                                    <Trophy className="mr-1 inline h-3 w-3" />
                                    Payout: {roundResult.payout.toFixed(0)} ETB
                                </p>
                            )}
                            {!myEntry && (
                                <p className="mt-1 text-[9px] text-muted-foreground">
                                    No bet placed this round
                                </p>
                            )}
                        </div>
                    )}

                    {/* Next round timer */}
                    {phase === "RESULT" && (
                        <p className="mt-2 text-center text-[9px] text-muted-foreground">
                            Next round starts in {phaseTimeLeft}s
                        </p>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}