/* eslint-disable */
import { useState, useEffect, useRef, useCallback } from "react";
import { toast } from "react-toastify";
import { audio } from "./../../../service/audio";
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
    Target,
    Dices,
    Trophy,
    Timer,
    CheckCircle2,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hook";
import { setUserWallet } from "@/store/slice/auth";
import { getSocket } from "@/lib/socket";

/* ============================================================
   NOTE ON WHAT CHANGED
   The old `engine` was a client-side, localStorage-backed fake wallet
   (SimulationEngine) -- fake balance, fake RNG, nothing real. It's
   gone. Phase, timer, the draw itself, and payouts are now all
   authoritative on the server (backend/keno/game.ts): every client
   sees the exact same round, the exact same 10 drawn numbers, and
   real wallet balances via Redux + the wallet socket events, the same
   pattern used by the crash and slots games.

   One behavior change worth flagging: since a bet now locks real
   money server-side the instant it's placed, there's no "Cancel bet"
   button anymore -- the mock version could undo a bet for free
   because nothing was actually at stake. If you want cancellation,
   it needs a corresponding "keno:cancel-bet" endpoint on the backend
   that unlocks the wallet hold; it doesn't exist yet.
============================================================ */

type Phase = "BETTING" | "DRAWING" | "RESULT";

const PHASE_BY_CODE: Record<number, Phase> = {
    0: "BETTING",
    1: "DRAWING",
    2: "RESULT",
};

const BOARD_SIZE = 40;
const MAX_PICKS = 10;

// ============================================================
// TELEGRAM MINI APP HELPERS
// ============================================================
// Telegram's in-app WebView doesn't have real hover states, is prone
// to the browser's default double-tap-to-zoom and text-selection
// long-press menu firing on rapid taps, and (unlike a native app) has
// no built-in tap feedback -- Telegram's own WebApp SDK exposes
// haptics for exactly this. All calls are optional-chained since this
// component may also render outside Telegram (e.g. a browser preview)
// where `window.Telegram` won't exist.
const haptic = {
    /**
     * HapticFeedback was added after Telegram Web Apps 6.0.
     * Calling it on 6.0 (or older) can produce:
     * "HapticFeedback is not supported in version 6.0".
     *
     * Keep haptics optional so the game also works in normal browsers
     * and in older Telegram WebViews.
     */
    isSupported: () => {
        try {
            const webApp = (window as any)?.Telegram?.WebApp;

            if (!webApp) return false;

            // Telegram exposes this helper on supported WebApp versions.
            if (typeof webApp.isVersionAtLeast === "function") {
                if (!webApp.isVersionAtLeast("6.1")) return false;
            } else {
                // If the helper is unavailable, do not call HapticFeedback.
                // This avoids triggering Telegram's unsupported-version warning.
                return false;
            }

            return Boolean(webApp.HapticFeedback);
        } catch {
            return false;
        }
    },

    tap: () => {
        try {
            const webApp = (window as any)?.Telegram?.WebApp;

            if (
                !webApp ||
                typeof webApp.isVersionAtLeast !== "function" ||
                !webApp.isVersionAtLeast("6.1") ||
                !webApp.HapticFeedback ||
                typeof webApp.HapticFeedback.impactOccurred !== "function"
            ) {
                return;
            }

            webApp.HapticFeedback.impactOccurred("light");
        } catch {
            // Haptics are optional; never let them break gameplay.
        }
    },

    success: () => {
        try {
            const webApp = (window as any)?.Telegram?.WebApp;

            if (
                !webApp ||
                typeof webApp.isVersionAtLeast !== "function" ||
                !webApp.isVersionAtLeast("6.1") ||
                !webApp.HapticFeedback ||
                typeof webApp.HapticFeedback.notificationOccurred !== "function"
            ) {
                return;
            }

            webApp.HapticFeedback.notificationOccurred("success");
        } catch {
            // Haptics are optional; never let them break gameplay.
        }
    },

    error: () => {
        try {
            const webApp = (window as any)?.Telegram?.WebApp;

            if (
                !webApp ||
                typeof webApp.isVersionAtLeast !== "function" ||
                !webApp.isVersionAtLeast("6.1") ||
                !webApp.HapticFeedback ||
                typeof webApp.HapticFeedback.notificationOccurred !== "function"
            ) {
                return;
            }

            webApp.HapticFeedback.notificationOccurred("error");
        } catch {
            // Haptics are optional; never let them break gameplay.
        }
    },
};

interface Wallet {
    balance: number;
    locked_balance: number;
    withdrawable_balance: number;
    available_balance: number;
}

interface KenoEntry {
    numbers: number[];
    amount: number;
}

interface KenoSyncPayload {
    phase: 0 | 1 | 2;
    roundNumber: number;
    phaseEndsAt: number | null;
    drawn: number[];
    yourEntry: KenoEntry | null;
}

interface KenoRoundStartPayload {
    roundNumber: number;
    phaseEndsAt: number;
}

interface KenoDrawingStartPayload {
    phaseEndsAt: number;
}

interface KenoNumberDrawnPayload {
    number: number;
    drawn: number[];
}

interface KenoResultPayload {
    drawn: number[];
    roundId: string | null;
    phaseEndsAt: number;
}

interface KenoMyResultPayload {
    hits: number;
    multiplier: number;
    payout: number;
    wallet: Wallet;
}

interface KenoBetAck {
    ok?: boolean;
    numbers?: number[];
    amount?: number;
    wallet?: Wallet;
    error?: string;
}

export default function Keno() {
    const dispatch = useAppDispatch();
    const socket = getSocket();
    const user = useAppSelector((state) => state.auth.user);

    const [betAmount, setBetAmount] = useState<number>(100);
    const [selected, setSelected] = useState<number[]>([]);
    const [drawn, setDrawn] = useState<number[]>([]);
    const [phase, setPhase] = useState<Phase>("BETTING");
    const [phaseEndsAt, setPhaseEndsAt] = useState<number | null>(null);
    const [phaseTimeLeft, setPhaseTimeLeft] = useState<number>(0);
    const [roundId, setRoundId] = useState<number>(0);

    const [myEntry, setMyEntry] = useState<KenoEntry | null>(null);
    const [roundResult, setRoundResult] = useState<{ hits: number; payout: number } | null>(null);
    const [isBetPending, setIsBetPending] = useState(false);

    const [mode, setMode] = useState<"MANUAL" | "AUTO">("MANUAL");
    const [autoActive, setAutoActive] = useState(false);
    const [autoBetCount, setAutoBetCount] = useState<number>(0);
    const [autoBetsRemaining, setAutoBetsRemaining] = useState<number>(0);

    const [drawPopupOpen, setDrawPopupOpen] = useState(false);

    const autoRef = useRef({ active: false, count: 0, remaining: 0 });
    const selectedRef = useRef<number[]>([]);
    const betAmountRef = useRef(betAmount);
    const myEntryRef = useRef<KenoEntry | null>(null);
    const countdownRAF = useRef<number | null>(null);

    useEffect(() => {
        autoRef.current = { active: autoActive, count: autoBetCount, remaining: autoBetsRemaining };
    }, [autoActive, autoBetCount, autoBetsRemaining]);

    useEffect(() => {
        selectedRef.current = selected;
    }, [selected]);

    useEffect(() => {
        betAmountRef.current = betAmount;
    }, [betAmount]);

    useEffect(() => {
        myEntryRef.current = myEntry;
    }, [myEntry]);

    // Open popup during drawing/result only
    useEffect(() => {
        if (phase === "DRAWING" || phase === "RESULT") setDrawPopupOpen(true);
        else setDrawPopupOpen(false);
    }, [phase]);

    // =====================================================
    // PLACE BET (socket)
    // =====================================================
    const placeBet = useCallback(() => {
        if (phase !== "BETTING") return;
        if (myEntryRef.current) return;

        const numbers = selectedRef.current;
        const amount = betAmountRef.current;

        if (numbers.length === 0 || amount <= 0) return;
        if (amount > Number(user?.wallets?.available_balance ?? 0)) return;

        setIsBetPending(true);

        socket.emit("keno:bet", { numbers, amount }, (result: KenoBetAck) => {
            setIsBetPending(false);

            if (!result || !result.ok) {
                toast.error(result?.error || "Could not place bet.");
                haptic.error();
                return;
            }

            setMyEntry({ numbers, amount });
            audio.playBet();
            haptic.success();

            if (result.wallet) {
                dispatch(setUserWallet(result.wallet));
            }

            if (autoRef.current.active && autoRef.current.count > 0) {
                setAutoBetsRemaining((prev) => Math.max(prev - 1, 0));
            }
        });
    }, [phase, socket, user, dispatch]);

    // =====================================================
    // SOCKET: SYNC (on connect / reconnect)
    // =====================================================
    useEffect(() => {
        const handleSync = (payload: KenoSyncPayload) => {
            setPhase(PHASE_BY_CODE[payload.phase] ?? "BETTING");
            setRoundId(payload.roundNumber);
            setPhaseEndsAt(payload.phaseEndsAt);
            setDrawn(payload.drawn);
            setMyEntry(payload.yourEntry);
            setRoundResult(null);
        };

        socket.on("keno:sync", handleSync);
        socket.emit("keno:requestState");

        return () => {
            socket.off("keno:sync", handleSync);
        };
    }, [socket]);

    // =====================================================
    // SOCKET: ROUND START (new betting phase)
    // =====================================================
    useEffect(() => {
        const handleRoundStart = (payload: KenoRoundStartPayload) => {
            setPhase("BETTING");
            setRoundId(payload.roundNumber);
            setPhaseEndsAt(payload.phaseEndsAt);
            setDrawn([]);
            setMyEntry(null);
            setRoundResult(null);
        };

        socket.on("keno:round-start", handleRoundStart);
        return () => {
            socket.off("keno:round-start", handleRoundStart);
        };
    }, [socket]);

    // =====================================================
    // SOCKET: DRAWING START
    // =====================================================
    useEffect(() => {
        const handleDrawingStart = (payload: KenoDrawingStartPayload) => {
            setPhase("DRAWING");
            setPhaseEndsAt(payload.phaseEndsAt);
            setDrawn([]);
        };

        socket.on("keno:drawing-start", handleDrawingStart);
        return () => {
            socket.off("keno:drawing-start", handleDrawingStart);
        };
    }, [socket]);

    // =====================================================
    // SOCKET: NUMBER DRAWN
    // =====================================================
    useEffect(() => {
        const handleNumberDrawn = (payload: KenoNumberDrawnPayload) => {
            setDrawn(payload.drawn);
            audio.playSpin();
        };

        socket.on("keno:number-drawn", handleNumberDrawn);
        return () => {
            socket.off("keno:number-drawn", handleNumberDrawn);
        };
    }, [socket]);

    // =====================================================
    // SOCKET: RESULT (public -- drawn numbers + phase timing,
    // for everyone including spectators who didn't bet)
    // =====================================================
    useEffect(() => {
        const handleResult = (payload: KenoResultPayload) => {
            setPhase("RESULT");
            setPhaseEndsAt(payload.phaseEndsAt);
            setDrawn(payload.drawn);
        };

        socket.on("keno:result", handleResult);
        return () => {
            socket.off("keno:result", handleResult);
        };
    }, [socket]);

    // =====================================================
    // SOCKET: MY RESULT (private -- only fires if you bet)
    // =====================================================
    useEffect(() => {
        const handleMyResult = (payload: KenoMyResultPayload) => {
            setRoundResult({ hits: payload.hits, payout: payload.payout });

            if (payload.hits > 0) {
                audio.playWin();
                haptic.success();
            } else {
                audio.playLoss();
                haptic.error();
            }

            if (payload.wallet) {
                dispatch(setUserWallet(payload.wallet));
            }
        };

        socket.on("keno:my-result", handleMyResult);
        return () => {
            socket.off("keno:my-result", handleMyResult);
        };
    }, [socket, dispatch]);

    // =====================================================
    // SOCKET: WALLET (any out-of-band wallet push)
    // =====================================================
    useEffect(() => {
        const handleWallet = (wallet: Wallet) => {
            if (!wallet) return;
            dispatch(setUserWallet(wallet));
        };

        socket.on("keno:wallet", handleWallet);
        return () => {
            socket.off("keno:wallet", handleWallet);
        };
    }, [socket, dispatch]);

    // =====================================================
    // COUNTDOWN -- derived locally from the server's
    // phaseEndsAt timestamp via requestAnimationFrame, so it's
    // smooth without needing a server tick every 100ms.
    // =====================================================
    useEffect(() => {
        if (countdownRAF.current) {
            cancelAnimationFrame(countdownRAF.current);
            countdownRAF.current = null;
        }

        if (!phaseEndsAt) {
            setPhaseTimeLeft(0);
            return;
        }

        const update = () => {
            const remaining = Math.max(0, (phaseEndsAt - Date.now()) / 1000);
            setPhaseTimeLeft(remaining);

            if (remaining > 0) {
                countdownRAF.current = requestAnimationFrame(update);
            }
        };

        countdownRAF.current = requestAnimationFrame(update);

        return () => {
            if (countdownRAF.current) {
                cancelAnimationFrame(countdownRAF.current);
                countdownRAF.current = null;
            }
        };
    }, [phaseEndsAt]);

    // =====================================================
    // AUTO MODE -- auto place a bet as soon as a new betting
    // phase starts, reusing the same `selected` numbers.
    // =====================================================
    useEffect(() => {
        if (phase !== "BETTING") return;
        if (!autoRef.current.active) return;

        const { count, remaining } = autoRef.current;

        if (count > 0 && remaining <= 0) {
            setAutoActive(false);
            return;
        }
        if (Number(user?.wallets?.available_balance ?? 0) < betAmountRef.current) {
            setAutoActive(false);
            return;
        }
        if (selectedRef.current.length === 0) {
            setAutoActive(false);
            return;
        }

        if (!myEntryRef.current) {
            placeBet();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [phase, roundId, autoActive]);

    // =====================================================
    // UI HELPERS
    // =====================================================
    const toggle = (n: number) => {
        if (phase !== "BETTING") return;
        if (myEntry) return; // bet already placed
        if (selected.includes(n)) setSelected(selected.filter((x) => x !== n));
        else if (selected.length < MAX_PICKS) setSelected([...selected, n]);
        audio.playClick();
        haptic.tap();
    };

    const toggleAuto = () => {
        haptic.tap();
        if (autoActive) {
            setAutoActive(false);
        } else {
            if (selected.length === 0) return;
            setAutoBetsRemaining(autoBetCount === 0 ? 999999 : autoBetCount);
            setAutoActive(true);
        }
    };

    const isBetted = myEntry !== null;
    const hits = roundResult?.hits ?? 0;
    const payout = roundResult?.payout ?? 0;
    const odds = (selected.length * 1.5).toFixed(1);
    const balance = Number(user?.wallets?.available_balance ?? 0);

    const drawnSlots = Array.from({ length: 10 }, (_, i) => drawn[i] ?? null);

    const mikeStatus: "normal" | "win" | "losing" | "jackpot" =
        roundResult && roundResult.hits > 0 ? "win" : "normal";

    // =====================================================
    // RENDER
    // =====================================================
    return (
        <div
            className="space-y-1 px-1.5 py-1.5 sm:px-2 sm:py-2"
            style={{
                // Telegram's WebView applies the browser's default
                // double-tap-zoom, tap-highlight flash, and long-press
                // text-selection/callout on rapid taps -- all fight
                // against a game board people are tapping quickly.
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
                userSelect: "none",
                WebkitUserSelect: "none",
                overscrollBehavior: "contain",
            }}
        >
            {/* ==================== HEADER ==================== */}
            <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary via-primary to-primary/85 px-2 py-1.5 text-primary-foreground shadow-sm">
                <div className="pointer-events-none absolute -right-6 -top-6 h-16 w-16 rounded-full border-2 border-primary-foreground/15" />
                <div className="pointer-events-none absolute -bottom-5 -left-5 h-14 w-14 rounded-full border border-primary-foreground/10" />

                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary-foreground/15 shadow-inner">
                            <Dices className="h-3 w-3" strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-[11px] font-black uppercase leading-none tracking-wider">
                                Keno · R{roundId}
                            </h1>
                            <p className="text-[8px] font-medium uppercase tracking-widest text-primary-foreground/70">
                                {phase === "BETTING"
                                    ? "Place your bets"
                                    : phase === "DRAWING"
                                        ? "Numbers are being drawn"
                                        : "Round result"}
                            </p>
                        </div>
                    </div>

                    <div className="flex flex-col items-end">
                        <span className="text-[8px] uppercase tracking-wider text-primary-foreground/70">
                            Balance
                        </span>
                        <span className="text-[12px] font-bold leading-tight">
                            {balance.toFixed(2)}
                            <span className="ml-0.5 text-[8px] font-normal opacity-80">
                                ETB
                            </span>
                        </span>
                    </div>
                </div>

                {/* Stats + phase */}
                <div className="relative z-10 mt-1.5 grid grid-cols-4 gap-1">
                    <div className="rounded bg-primary-foreground/10 px-1 py-1 text-center backdrop-blur-sm">
                        <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
                            <Target className="h-2 w-2" />
                            <span className="text-[7px] uppercase tracking-wider">
                                Picks
                            </span>
                        </div>
                        <p className="mt-0.5 text-[11px] font-bold leading-none">
                            {selected.length}
                            <span className="text-[8px] font-normal opacity-70">/{MAX_PICKS}</span>
                        </p>
                    </div>

                    <div className="rounded bg-primary-foreground/10 px-1 py-1 text-center backdrop-blur-sm">
                        <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
                            <Sparkles className="h-2 w-2" />
                            <span className="text-[7px] uppercase tracking-wider">
                                Odds
                            </span>
                        </div>
                        <p className="mt-0.5 text-[11px] font-bold leading-none">
                            {odds}x
                        </p>
                    </div>

                    <div className="rounded bg-primary-foreground/10 px-1 py-1 text-center backdrop-blur-sm">
                        <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
                            <Target className="h-2 w-2" />
                            <span className="text-[7px] uppercase tracking-wider">
                                Hits
                            </span>
                        </div>
                        <p className="mt-0.5 text-[11px] font-bold leading-none">
                            {hits}
                        </p>
                    </div>

                    {/* Timer chip */}
                    <div
                        className={`rounded px-1 py-1 text-center backdrop-blur-sm ${phase === "BETTING"
                            ? "bg-primary-foreground/10"
                            : phase === "DRAWING"
                                ? "bg-primary-foreground/20 animate-pulse"
                                : "bg-primary-foreground/10"
                            }`}
                    >
                        <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
                            <Timer className="h-2 w-2" />
                            <span className="text-[7px] uppercase tracking-wider">
                                {phase === "BETTING"
                                    ? "Bet In"
                                    : phase === "DRAWING"
                                        ? "Draw"
                                        : "Next"}
                            </span>
                        </div>
                        <p className="mt-0.5 text-[11px] font-bold leading-none">
                            {phaseTimeLeft.toFixed(0)}s
                        </p>
                    </div>
                </div>
            </div>

            {/* ==================== BOARD ==================== */}
            <Card className="overflow-hidden rounded-lg border-border/60 shadow-sm">
                <CardContent className="p-1">
                    <div className="grid grid-cols-5 gap-0.5">
                        {[...Array(BOARD_SIZE)].map((_, i) => {
                            const n = i + 1;
                            const isSelected = selected.includes(n);
                            const isDrawn = drawn.includes(n);
                            const isHit = isSelected && isDrawn;
                            const locked = phase !== "BETTING" || isBetted;

                            let stateClass =
                                "bg-muted/30 text-foreground border-border/40 hover:border-primary/50 hover:bg-muted/50";
                            if (isHit)
                                stateClass =
                                    "bg-green-500 text-white border-green-500 shadow-[0_0_6px_rgba(34,197,94,0.55)] scale-105 z-10";
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
                                    className={`relative flex aspect-square min-h-[38px] items-center justify-center rounded-md border text-[12px] font-bold transition-all duration-150 active:scale-95 disabled:cursor-not-allowed ${stateClass}`}
                                >
                                    {n}
                                    {isHit && (
                                        <span className="pointer-events-none absolute inset-0 animate-pulse rounded-md bg-white/25" />
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
            <Card className="rounded-lg border-border/60 shadow-sm">
                <CardContent className="space-y-2 p-2">
                    {/* Manual / Auto tabs */}
                    <Tabs
                        value={mode}
                        onValueChange={(v) => setMode(v as "MANUAL" | "AUTO")}
                    >
                        <TabsList className="grid h-8 w-full grid-cols-2 rounded-md bg-muted/70 p-0.5">
                            <TabsTrigger
                                value="MANUAL"
                                disabled={autoActive}
                                className="h-7 rounded text-[10px] font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                Manual
                            </TabsTrigger>
                            <TabsTrigger
                                value="AUTO"
                                disabled={autoActive}
                                className="h-7 rounded text-[10px] font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                Auto
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {/* Bet amount + auto rounds */}
                    <div className={mode === "AUTO" ? "grid grid-cols-2 gap-1.5" : ""}>
                        <div className="space-y-1">
                            <Label className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                                <Coins className="h-2.5 w-2.5" />
                                Bet Amount
                            </Label>
                            <div className="relative">
                                <Input
                                    type="number"
                                    value={betAmount}
                                    onChange={(e) => setBetAmount(Number(e.target.value))}
                                    disabled={isBetted || autoActive || phase !== "BETTING"}
                                    className="h-9 rounded-md pr-8 text-center text-[13px] font-bold"
                                />
                                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-medium text-muted-foreground">
                                    ETB
                                </span>
                            </div>
                        </div>

                        {mode === "AUTO" && (
                            <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                                <Label className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
                                    <Hash className="h-2.5 w-2.5" />
                                    Rounds
                                </Label>
                                <Input
                                    type="number"
                                    value={autoBetCount}
                                    onChange={(e) => setAutoBetCount(Number(e.target.value))}
                                    disabled={autoActive}
                                    placeholder="0 = ∞"
                                    className="h-9 rounded-md text-center text-[13px] font-bold"
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
                                isBetPending ||
                                selected.length === 0 ||
                                betAmount <= 0 ||
                                betAmount > balance
                            }
                            className="h-11 w-full rounded-md text-[11px] font-bold uppercase tracking-widest shadow-sm"
                        >
                            <Play className="mr-1.5 h-3 w-3 fill-current" />
                            {isBetPending ? "Placing..." : "Place Bet"}
                            {!isBetPending && selected.length > 0 && betAmount > 0 && (
                                <span className="ml-1.5 text-[9px] font-normal opacity-80">
                                    · {betAmount} ETB
                                </span>
                            )}
                        </Button>
                    )}

                    {isBetted && !autoActive && (
                        <div className="flex h-11 items-center justify-center gap-1 rounded-md border border-green-500/30 bg-green-500/10 text-[10px] font-bold text-green-600 dark:text-green-400">
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Bet placed · {myEntry?.amount} ETB
                        </div>
                    )}

                    {autoActive && (
                        <div className="space-y-1.5">
                            <div className="flex h-9 items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 text-[10px] font-bold text-primary">
                                <Sparkles className="h-3 w-3" />
                                Auto running
                                {autoBetsRemaining !== 999999 && (
                                    <Badge
                                        variant="secondary"
                                        className="h-4 rounded px-1 text-[9px]"
                                    >
                                        {autoBetsRemaining} left
                                    </Badge>
                                )}
                            </div>
                            <Button
                                onClick={toggleAuto}
                                variant="destructive"
                                className="h-11 w-full rounded-md text-[11px] font-bold uppercase tracking-widest shadow-sm"
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
                            className="h-11 w-full rounded-md text-[11px] font-bold uppercase tracking-widest"
                        >
                            <Sparkles className="mr-1.5 h-3 w-3" />
                            Start Auto Betting
                        </Button>
                    )}
                </CardContent>
            </Card>

            <div className="h-0.5" />

            {/* ==================== DRAW POPUP ==================== */}
            <Dialog
                open={drawPopupOpen}
                onOpenChange={(open) => !open && setDrawPopupOpen(false)}
            >
                <DialogContent
                    className="max-w-[280px] rounded-xl p-3"
                    onPointerDownOutside={(e) => e.preventDefault()}
                    onEscapeKeyDown={(e) => e.preventDefault()}
                >
                    <DialogHeader className="space-y-1">
                        <DialogTitle className="flex items-center gap-1.5 text-sm">
                            <Dices className="h-3.5 w-3.5 text-primary" />
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
                    <div className="grid grid-cols-5 gap-1.5 py-1.5">
                        {drawnSlots.map((num, idx) => {
                            const isHit =
                                num !== null && myEntry?.numbers.includes(num);
                            return (
                                <div
                                    key={idx}
                                    className={`flex aspect-square items-center justify-center rounded-full text-[13px] font-bold transition-all duration-300 ${num === null
                                        ? "border border-dashed border-border/50 bg-muted/20 text-muted-foreground/30"
                                        : isHit
                                            ? "scale-110 bg-green-500 text-white shadow-[0_0_10px_rgba(34,197,94,0.6)] ring-1 ring-green-500/40"
                                            : "bg-primary text-primary-foreground shadow-md ring-1 ring-primary/20"
                                        }`}
                                >
                                    {num ?? "?"}
                                </div>
                            );
                        })}
                    </div>

                    {/* Progress while drawing */}
                    {phase === "DRAWING" && (
                        <div className="mt-1.5">
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
                    {phase === "RESULT" && (
                        <div
                            className={`mt-1.5 rounded-lg p-2.5 text-center ${hits > 0
                                ? "bg-gradient-to-r from-green-500/15 to-green-500/5"
                                : "bg-muted/40"
                                }`}
                        >
                            <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                                Outcome
                            </p>
                            <p
                                className={`mt-0.5 text-lg font-black italic tracking-tight ${hits > 0
                                    ? "text-green-500"
                                    : "text-muted-foreground"
                                    }`}
                            >
                                {myEntry
                                    ? hits > 0
                                        ? `${hits} HITS!`
                                        : "ZERO HITS"
                                    : "--"}
                            </p>
                            {payout > 0 && (
                                <p className="mt-1 text-[10px] font-medium text-green-600 dark:text-green-400">
                                    <Trophy className="mr-1 inline h-3 w-3" />
                                    Payout: {payout.toFixed(2)} ETB
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
                            Next round starts in {phaseTimeLeft.toFixed(0)}s
                        </p>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}