/*eslint-disable*/
import { useState, useEffect, useRef } from "react";
import { getSocket } from "@/lib/socket";
import { setUserWallet } from "@/store/slice/auth";
import { audio } from "@/service/audio";
import { HOUSE_EDGES } from "../type";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Coins,
    Hash,
    Play,
    Square,
    Dice5,
    Target,
    TrendingUp,
    ArrowUpDown,
    Zap,
} from "lucide-react";
import { useAppSelector, useAppDispatch } from "@/store/hook";

const AUTO_DELAY_MS = 400;
const BET_TIMEOUT_MS = 10_000;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Same formula as the server (floored to 4 decimals) so what is shown is what is paid.
const calcMultiplier = (houseEdge: number, winChance: number) =>
    Math.floor(((100 - houseEdge * 100) / winChance) * 10_000) / 10_000;

export default function Dice() {
    const user = useAppSelector((state) => state.auth.user);
    const dispatch = useAppDispatch();
    const socket = getSocket()
    const [betAmount, setBetAmount] = useState<number>(100);
    const [winChance, setWinChance] = useState<number>(50);
    const [rollOver, setRollOver] = useState<boolean>(true);
    const [lastRoll, setLastRoll] = useState<number | null>(null);
    const [lastWin, setLastWin] = useState<boolean | null>(null);
    const [rolling, setRolling] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [mode, setMode] = useState<"MANUAL" | "AUTO">("MANUAL");
    const [autoActive, setAutoActive] = useState(false);
    const [autoBetCount, setAutoBetCount] = useState<number>(0);
    const [autoBetsRemaining, setAutoBetsRemaining] = useState<number>(0);

    // Server-driven config + balance.
    const [houseEdge, setHouseEdge] = useState<number>(HOUSE_EDGES.DICE);
    const [limits, setLimits] = useState({ minBet: 1, maxBet: 50_000 });
    // Wallet lives in redux; the server's wallet is pushed in via setUserWallet.
    const balance = Number(user?.wallets?.available_balance ?? 0);
    const multiplier = calcMultiplier(houseEdge, winChance);
    const target = rollOver ? 100 - winChance : winChance;
    const potentialPayout = betAmount * multiplier;

    // Always-fresh values for the async bet / auto loop (no stale closures).
    const latest = useRef({ betAmount, winChance, rollOver, balance, limits });
    latest.current = { betAmount, winChance, rollOver, balance, limits };
    const busyRef = useRef(false);

    // ---------------- socket wiring ----------------
    useEffect(() => {
        const onSync = (cfg: any) => {
            if (typeof cfg?.houseEdge === "number") setHouseEdge(cfg.houseEdge);
            if (cfg?.minBet && cfg?.maxBet)
                setLimits({ minBet: cfg.minBet, maxBet: cfg.maxBet });
        };
        const onWallet = (wallet: any) => {
            dispatch(setUserWallet(wallet));
        };
        const onConnect = () => socket.emit("dice:requestState");

        socket.on("dice:sync", onSync);
        socket.on("dice:wallet", onWallet);
        socket.on("connect", onConnect);
        socket.emit("dice:requestState");

        return () => {
            socket.off("dice:sync", onSync);
            socket.off("dice:wallet", onWallet);
            socket.off("connect", onConnect);
        };
    }, []);

    // ---------------- betting ----------------
    // Resolves true if the bet was placed and settled, false otherwise.
    const placeBet = (): Promise<boolean> =>
        new Promise((resolve) => {
            const { betAmount, winChance, rollOver, balance, limits } =
                latest.current;

            if (busyRef.current) return resolve(false);
            if (betAmount < limits.minBet || betAmount > limits.maxBet) {
                setError(`Bet must be ${limits.minBet}–${limits.maxBet} ETB`);
                return resolve(false);
            }
            if (betAmount > balance) {
                setError("Insufficient funds");
                return resolve(false);
            }
            if (!socket.connected) {
                setError("Not connected, please wait...");
                return resolve(false);
            }

            busyRef.current = true;
            setRolling(true);
            setError(null);
            audio.playBet();

            socket
                .timeout(BET_TIMEOUT_MS)
                .emit(
                    "dice:bet",
                    { amount: betAmount, winChance, rollOver },
                    (err: any, res: any) => {
                        busyRef.current = false;
                        setRolling(false);

                        if (err || !res || res.error) {
                            setError(res?.error ?? "No response from server");
                            return resolve(false);
                        }

                        setLastRoll(res.roll);
                        setLastWin(res.won);
                        dispatch(setUserWallet(res.wallet));

                        if (res.won) audio.playWin();
                        else audio.playLoss();

                        resolve(true);
                    }
                );
        });

    const handleRoll = () => {
        void placeBet();
    };

    // ---------------- auto bet ----------------
    useEffect(() => {
        if (!autoActive) return;

        let cancelled = false;

        (async () => {
            let remaining = autoBetCount === 0 ? Infinity : autoBetCount;

            while (!cancelled && remaining > 0) {
                const ok = await placeBet();
                if (!ok || cancelled) break; // out of funds / error / stopped

                remaining--;
                setAutoBetsRemaining(remaining === Infinity ? 999999 : remaining);
                await sleep(AUTO_DELAY_MS);
            }

            if (!cancelled) setAutoActive(false);
        })();

        return () => {
            cancelled = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [autoActive]);

    const toggleAuto = () => {
        if (autoActive) {
            setAutoActive(false);
        } else {
            setAutoBetsRemaining(autoBetCount === 0 ? 999999 : autoBetCount);
            setAutoActive(true);
        }
    };

    return (
        <div className="space-y-1.5 px-2 py-2 sm:px-2.5 sm:py-2.5">
            {/* ==================== HERO HEADER ==================== */}
            <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary via-primary to-primary/85 px-3 py-2.5 text-primary-foreground shadow-sm">
                <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full border-4 border-primary-foreground/15" />
                <div className="pointer-events-none absolute -bottom-6 -left-6 h-20 w-20 rounded-full border border-primary-foreground/10" />

                <div className="relative z-10 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-foreground/15 shadow-inner">
                            <Dice5 className="h-3.5 w-3.5" strokeWidth={2.5} />
                        </div>
                        <div>
                            <h1 className="text-sm font-black uppercase leading-none tracking-wider">
                                Dice
                            </h1>
                            <p className="text-[7px] font-medium uppercase tracking-widest text-primary-foreground/70">
                                Roll · Over/Under · Win
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

                <div className="relative z-10 mt-2 grid grid-cols-4 gap-1">
                    <div className="rounded-md bg-primary-foreground/10 px-1 py-1 text-center backdrop-blur-sm">
                        <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
                            <Coins className="h-2 w-2" />
                            <span className="text-[6px] uppercase tracking-wider">Bet</span>
                        </div>
                        <p className="mt-0.5 text-[10px] font-bold leading-none">
                            {betAmount}
                        </p>
                    </div>

                    <div className="rounded-md bg-primary-foreground/10 px-1 py-1 text-center backdrop-blur-sm">
                        <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
                            <Target className="h-2 w-2" />
                            <span className="text-[6px] uppercase tracking-wider">Chance</span>
                        </div>
                        <p className="mt-0.5 text-[10px] font-bold leading-none">
                            {winChance}%
                        </p>
                    </div>

                    <div className="rounded-md bg-primary-foreground/10 px-1 py-1 text-center backdrop-blur-sm">
                        <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
                            <TrendingUp className="h-2 w-2" />
                            <span className="text-[6px] uppercase tracking-wider">Multi</span>
                        </div>
                        <p className="mt-0.5 text-[10px] font-bold leading-none">
                            {multiplier.toFixed(2)}x
                        </p>
                    </div>

                    <div className="rounded-md bg-primary-foreground/10 px-1 py-1 text-center backdrop-blur-sm">
                        <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
                            <Dice5 className="h-2 w-2" />
                            <span className="text-[6px] uppercase tracking-wider">Last</span>
                        </div>
                        <p
                            className={`mt-0.5 text-[10px] font-bold leading-none ${lastWin === true
                                ? "text-emerald-300"
                                : lastWin === false
                                    ? "text-rose-300"
                                    : ""
                                }`}
                        >
                            {lastRoll !== null ? lastRoll.toFixed(0) : "—"}
                        </p>
                    </div>
                </div>
            </div>

            {/* ==================== ROLL BAR ==================== */}
            <Card className="overflow-hidden rounded-xl border-border/60 shadow-sm">
                <CardContent className="p-2">
                    <div className="relative h-14 overflow-hidden rounded-lg border border-border/40 bg-muted/20">
                        {/* Win zone */}
                        <div
                            className={`absolute top-1/2 h-2 -translate-y-1/2 rounded-full transition-all duration-300 ${rollOver
                                ? "bg-emerald-500/80 shadow-[0_0_10px_rgba(16,185,129,0.4)]"
                                : "bg-rose-500/80 shadow-[0_0_10px_rgba(244,63,94,0.4)]"
                                }`}
                            style={{
                                width: `${rollOver ? winChance : 100 - winChance}%`,
                                left: rollOver ? `${100 - winChance}%` : "0%",
                            }}
                        />

                        {/* Target marker */}
                        <div
                            className="absolute top-0 z-20 h-full w-0.5 bg-foreground shadow-[0_0_6px_rgba(255,255,255,0.9)]"
                            style={{ left: `${target}%` }}
                        />

                        {/* Last roll indicator */}
                        {lastRoll !== null && (
                            <div
                                className={`absolute top-1/2 z-30 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-lg border-2 text-[10px] font-black shadow-md transition-all duration-200 ${lastWin
                                    ? "border-emerald-300 bg-emerald-500 text-white"
                                    : "border-rose-300 bg-rose-500 text-white"
                                    }`}
                                style={{ left: `${lastRoll}%` }}
                            >
                                {lastRoll.toFixed(0)}
                            </div>
                        )}

                        {/* Scale marks */}
                        <div className="pointer-events-none absolute bottom-0 left-0 right-0 flex justify-between px-1 text-[6px] text-muted-foreground">
                            <span>0</span>
                            <span>25</span>
                            <span>50</span>
                            <span>75</span>
                            <span>100</span>
                        </div>
                    </div>

                    {/* Target label */}
                    <div className="mt-1.5 flex items-center justify-between px-0.5 text-[8px]">
                        <span className="text-muted-foreground">
                            Target:{" "}
                            <span className="font-bold text-foreground">
                                {target.toFixed(0)}
                            </span>
                        </span>
                        <span
                            className={`font-bold uppercase tracking-wider ${rollOver ? "text-emerald-500" : "text-rose-500"
                                }`}
                        >
                            Roll {rollOver ? "Over" : "Under"}
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* ==================== CONTROLS ==================== */}
            <Card className="rounded-xl border-border/60 shadow-sm">
                <CardContent className="space-y-2 p-2">
                    {/* Manual / Auto tabs */}
                    <Tabs
                        value={mode}
                        onValueChange={(v) => {
                            if (autoActive || rolling) return;
                            setMode(v as "MANUAL" | "AUTO");
                        }}
                    >
                        <TabsList className="grid h-6 w-full grid-cols-2 rounded-lg bg-muted/70 p-0.5">
                            <TabsTrigger
                                value="MANUAL"
                                disabled={autoActive || rolling}
                                className="h-5 rounded-md text-[9px] font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                Manual
                            </TabsTrigger>
                            <TabsTrigger
                                value="AUTO"
                                disabled={autoActive || rolling}
                                className="h-5 rounded-md text-[9px] font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
                            >
                                Auto
                            </TabsTrigger>
                        </TabsList>
                    </Tabs>

                    {/* Bet amount + Auto count */}
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
                                    disabled={autoActive || rolling}
                                    className="h-8 rounded-lg pr-16 text-center text-[11px] font-bold"
                                />
                                <div className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            setBetAmount(Math.max(1, Math.floor(betAmount / 2)))
                                        }
                                        disabled={autoActive || rolling}
                                        className="rounded-md bg-muted px-1.5 py-1 text-[7px] font-bold text-muted-foreground transition hover:bg-muted/70 disabled:opacity-40"
                                    >
                                        ½
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setBetAmount(betAmount * 2)}
                                        disabled={autoActive || rolling}
                                        className="rounded-md bg-muted px-1.5 py-1 text-[7px] font-bold text-muted-foreground transition hover:bg-muted/70 disabled:opacity-40"
                                    >
                                        2×
                                    </button>
                                </div>
                            </div>
                        </div>

                        {mode === "AUTO" && (
                            <div className="space-y-1 animate-in fade-in slide-in-from-top-1">
                                <Label className="flex items-center gap-1 text-[8px] uppercase tracking-wider text-muted-foreground">
                                    <Hash className="h-2.5 w-2.5" />
                                    Bets
                                    <span className="text-[7px] font-normal normal-case">
                                        (0 = ∞)
                                    </span>
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

                    {/* Win chance slider + Over/Under toggle */}
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <Label className="flex items-center gap-1 text-[8px] uppercase tracking-wider text-muted-foreground">
                                <Target className="h-2.5 w-2.5" />
                                Win Chance
                            </Label>
                            <button
                                type="button"
                                onClick={() => setRollOver(!rollOver)}
                                disabled={autoActive || rolling}
                                className="flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wider text-foreground transition hover:bg-muted/70 disabled:opacity-40"
                            >
                                <ArrowUpDown className="h-2.5 w-2.5" />
                                {rollOver ? "Over" : "Under"}
                            </button>
                        </div>

                        <div className="flex items-center gap-2">
                            <input
                                type="range"
                                min="2"
                                max="98"
                                step="1"
                                value={winChance}
                                onChange={(e) => setWinChance(Number(e.target.value))}
                                disabled={autoActive || rolling}
                                className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary disabled:opacity-50"
                            />
                            <span className="w-9 shrink-0 text-right text-[10px] font-bold tabular-nums">
                                {winChance}%
                            </span>
                        </div>
                    </div>

                    {/* Stats row */}
                    <div className="grid grid-cols-2 gap-1.5">
                        <div className="rounded-lg border border-border/50 bg-muted/30 p-1.5">
                            <div className="flex items-center gap-1">
                                <TrendingUp className="h-2.5 w-2.5 text-primary" />
                                <span className="text-[7px] uppercase tracking-wider text-muted-foreground">
                                    Multiplier
                                </span>
                            </div>
                            <p className="mt-0.5 text-[11px] font-bold tabular-nums">
                                {multiplier.toFixed(4)}x
                            </p>
                        </div>

                        <div className="rounded-lg border border-border/50 bg-muted/30 p-1.5">
                            <div className="flex items-center gap-1">
                                <Coins className="h-2.5 w-2.5 text-emerald-500" />
                                <span className="text-[7px] uppercase tracking-wider text-muted-foreground">
                                    Payout
                                </span>
                            </div>
                            <p className="mt-0.5 text-[11px] font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                                {potentialPayout.toFixed(0)} ETB
                            </p>
                        </div>
                    </div>

                    {/* Action button */}
                    {mode === "MANUAL" ? (
                        <Button
                            onClick={handleRoll}
                            disabled={rolling || betAmount <= 0 || betAmount > balance}
                            className="h-9 w-full rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-sm"
                        >
                            {rolling ? (
                                <>
                                    <span className="mr-1.5 h-3 w-3 animate-spin rounded-full border-2 border-primary-foreground/40 border-t-primary-foreground" />
                                    Rolling...
                                </>
                            ) : (
                                <>
                                    <Play className="mr-1.5 h-3 w-3 fill-current" />
                                    Roll Dice
                                    <span className="ml-1.5 text-[9px] font-normal opacity-80">
                                        · {betAmount} ETB
                                    </span>
                                </>
                            )}
                        </Button>
                    ) : !autoActive ? (
                        <Button
                            onClick={toggleAuto}
                            disabled={betAmount <= 0 || betAmount > balance}
                            className="h-9 w-full rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-sm"
                        >
                            <Zap className="mr-1.5 h-3 w-3 fill-current" />
                            Start Auto
                            {autoBetCount > 0 && (
                                <Badge
                                    variant="secondary"
                                    className="ml-1.5 h-4 rounded-md px-1 text-[8px]"
                                >
                                    {autoBetCount}
                                </Badge>
                            )}
                        </Button>
                    ) : (
                        <Button
                            onClick={toggleAuto}
                            variant="destructive"
                            className="h-9 w-full rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-sm"
                        >
                            <Square className="mr-1.5 h-3 w-3 fill-current" />
                            Stop Auto
                            {autoBetsRemaining !== 999999 && (
                                <Badge
                                    variant="secondary"
                                    className="ml-1.5 h-4 rounded-md px-1 text-[8px]"
                                >
                                    {autoBetsRemaining}
                                </Badge>
                            )}
                        </Button>
                    )}

                    {error && (
                        <p className="text-center text-[8px] font-medium text-rose-500">
                            {error}
                        </p>
                    )}
                </CardContent>
            </Card>

            <div className="h-1" />
        </div>
    );
}