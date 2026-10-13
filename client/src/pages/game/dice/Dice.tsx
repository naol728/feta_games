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
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
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
    CircleHelp,
} from "lucide-react";
import { useAppSelector, useAppDispatch } from "@/store/hook";

const AUTO_DELAY_MS = 400;
const BET_TIMEOUT_MS = 10_000;
const GUIDE_KEY = "dice:hideGuide";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const readHideGuide = () => {
    try {
        return localStorage.getItem(GUIDE_KEY) === "1";
    } catch {
        return false;
    }
};

// Same formula as the server (floored to 4 decimals) so what is shown is what is paid.
const calcMultiplier = (houseEdge: number, winChance: number) =>
    Math.floor(((100 - houseEdge * 100) / winChance) * 10_000) / 10_000;

// ============================================================
// How to play popup
// ============================================================
function GuideSection({
    step,
    title,
    children,
}: {
    step: number;
    title: string;
    children: React.ReactNode;
}) {
    return (
        <section className="space-y-1.5">
            <h3 className="flex items-center gap-2 text-sm font-bold">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-black text-primary-foreground">
                    {step}
                </span>
                {title}
            </h3>
            <div className="space-y-1.5 pl-7 text-xs leading-relaxed text-muted-foreground">
                {children}
            </div>
        </section>
    );
}

function HowToPlayDialog({
    open,
    onClose,
    houseEdge,
    limits,
}: {
    open: boolean;
    onClose: (dontShowAgain: boolean) => void;
    houseEdge: number;
    limits: { minBet: number; maxBet: number };
}) {
    const [dontShow, setDontShow] = useState<boolean>(readHideGuide());
    const sampleChances = [10, 25, 50, 75, 90];
    const exampleMulti = calcMultiplier(houseEdge, 50);

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose(dontShow)}>
            <DialogContent className="flex max-h-[88vh] w-[calc(100%-1.5rem)] max-w-md flex-col gap-0 p-0">
                <DialogHeader className="space-y-1 border-b px-4 py-3 text-left">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <Dice5 className="h-4 w-4 text-primary" />
                        How to play Dice
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Set your win chance, choose Over or Under, and roll. Lower chances
                        pay more.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                    <GuideSection step={1} title="Place your bet">
                        <p>
                            Enter your bet amount (between{" "}
                            <b className="text-foreground">
                                {limits.minBet} and {limits.maxBet.toLocaleString()} ETB
                            </b>
                            ). Use <b className="text-foreground">½</b> and{" "}
                            <b className="text-foreground">2×</b> to halve or double it
                            quickly.
                        </p>
                    </GuideSection>

                    <GuideSection step={2} title="Set your win chance">
                        <p>
                            Use the slider to choose your win chance, from{" "}
                            <b className="text-foreground">2% to 98%</b>. A low chance is
                            risky but pays a big multiplier. A high chance wins often but
                            pays less.
                        </p>
                    </GuideSection>

                    <GuideSection step={3} title="Roll Over or Roll Under">
                        <p>
                            The dice rolls a number from 0 to 100. Press the{" "}
                            <b className="text-foreground">Over / Under</b> button to pick
                            your direction. Your win chance decides the target number:
                        </p>
                        <ul className="space-y-1">
                            <li className="rounded-md border bg-muted/30 px-2 py-1.5">
                                <span className="font-semibold text-emerald-500">
                                    Roll Over
                                </span>
                                <span className="block">
                                    You win if the roll is higher than the target. Target = 100
                                    − win chance.
                                </span>
                            </li>
                            <li className="rounded-md border bg-muted/30 px-2 py-1.5">
                                <span className="font-semibold text-rose-500">
                                    Roll Under
                                </span>
                                <span className="block">
                                    You win if the roll is lower than the target. Target = win
                                    chance.
                                </span>
                            </li>
                        </ul>
                        <p>
                            The colored bar shows your winning zone and the white line shows
                            the target. After each roll, your result appears on the bar.
                        </p>
                    </GuideSection>

                    <GuideSection step={4} title="Multiplier and payout">
                        <p>
                            Your multiplier depends only on your win chance. If you win, you
                            receive <b className="text-foreground">bet × multiplier</b>.
                            The house edge is{" "}
                            <b className="text-foreground">
                                {Number((houseEdge * 100).toFixed(2))}%
                            </b>
                            .
                        </p>
                        <div className="overflow-hidden rounded-md border">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b bg-muted/50 text-[10px] uppercase tracking-wider">
                                        <th className="px-2 py-1 font-semibold">Win chance</th>
                                        <th className="px-2 py-1 font-semibold">Multiplier</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {sampleChances.map((c) => (
                                        <tr key={c}>
                                            <td className="px-2 py-1 font-bold text-foreground">
                                                {c}%
                                            </td>
                                            <td className="px-2 py-1 tabular-nums">
                                                {calcMultiplier(houseEdge, c).toFixed(4)}×
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p>
                            Example: bet 100 ETB at 50% win chance. The multiplier is{" "}
                            {exampleMulti.toFixed(4)}×, so a win pays{" "}
                            {(100 * exampleMulti).toFixed(2)} ETB.
                        </p>
                    </GuideSection>

                    <GuideSection step={5} title="Auto bet">
                        <p>
                            Switch to the <b className="text-foreground">Auto</b> tab to
                            place bets one after another with the same settings.
                        </p>
                        <ul className="list-disc space-y-0.5 pl-4">
                            <li>
                                Set the number of bets, or enter{" "}
                                <b className="text-foreground">0</b> to keep going with no
                                limit.
                            </li>
                            <li>Press Start Auto to begin and Stop Auto to end it.</li>
                            <li>
                                Auto stops by itself if you run out of funds or an error
                                happens.
                            </li>
                        </ul>
                    </GuideSection>

                    <GuideSection step={6} title="Fair and server-controlled">
                        <p>
                            Every roll is generated by the server, and the result and your
                            payout are calculated there, not on your device.
                        </p>
                    </GuideSection>

                    <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[11px] text-amber-700 dark:text-amber-400">
                        Play responsibly. Only bet what you can afford to lose.
                    </p>
                </div>

                <DialogFooter className="flex-col gap-2 border-t px-4 py-3 sm:flex-col sm:space-x-0">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                        <Checkbox
                            checked={dontShow}
                            onCheckedChange={(v) => setDontShow(v === true)}
                        />
                        Don't show this again
                    </label>
                    <Button className="w-full" onClick={() => onClose(dontShow)}>
                        <Play className="mr-1.5 h-3.5 w-3.5 fill-current" />
                        Got it, let's play
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

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

    // How-to-play popup: opens when the user enters the page.
    const [guideOpen, setGuideOpen] = useState<boolean>(() => !readHideGuide());

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

    const closeGuide = (dontShowAgain: boolean) => {
        try {
            if (dontShowAgain) localStorage.setItem(GUIDE_KEY, "1");
            else localStorage.removeItem(GUIDE_KEY);
        } catch {
            /* storage unavailable, ignore */
        }
        setGuideOpen(false);
    };

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
            {/* ==================== HOW TO PLAY POPUP ==================== */}
            <HowToPlayDialog
                open={guideOpen}
                onClose={closeGuide}
                houseEdge={houseEdge}
                limits={limits}
            />

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

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setGuideOpen(true)}
                            aria-label="How to play"
                            className="flex h-6 w-6 items-center justify-center rounded-full bg-primary-foreground/15 transition-colors hover:bg-primary-foreground/25 active:scale-95"
                        >
                            <CircleHelp className="h-3.5 w-3.5" />
                        </button>
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