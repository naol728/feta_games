/* eslint-disable */
// @ts-nocheck
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Phaser from "phaser";
import { toast } from "sonner";
import Chart from "chart.js/auto";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

import {
    BarChart3,
    Bug,
    CheckCircle2,
    CircleHelp,
    Flame,
    LineChart,
    Play,
    RefreshCw,
    Star,
    Target,
    TrendingUp,
    Trophy,
    X,
    Zap,
} from "lucide-react";

import CONFIG from "./core/config/game";
import BootScene from "./core/scenes/boot/BootScene";
import GameScene from "./core/scenes/game/GameScene";

import { useAppDispatch, useAppSelector } from "@/store/hook";
import { setUserWallet } from "@/store/slice/auth";
import { getSocket } from "@/lib/socket";

// ============================================================
// Constants
// ============================================================
const DIFFICULTIES = {
    easy: { label: "Easy", survivalChance: 0.85, color: "#35d06f" },
    medium: { label: "Medium", survivalChance: 0.65, color: "#f7931a" },
    hard: { label: "Hard", survivalChance: 0.45, color: "#ed4245" },
} as const;

type DifficultyKey = keyof typeof DIFFICULTIES;

type Phase =
    | "idle"
    | "betting"
    | "running"
    | "waiting"
    | "crashed"
    | "cashed_out";

const BET_TIMEOUT_MS = 10_000;
const GUIDE_KEY = "dino:hideGuide";

const readHideGuide = () => {
    try {
        return localStorage.getItem(GUIDE_KEY) === "1";
    } catch {
        return false;
    }
};

// Same formula used for the multiplier track.
const multiplierFor = (survivalChance: number, jump: number) => {
    const prob = Math.pow(survivalChance, jump);
    return parseFloat((Math.floor((0.99 / prob) * 100) / 100).toFixed(2));
};

// ============================================================
// Socket payload types
// ============================================================
interface Wallet {
    balance: number;
    locked_balance: number;
    withdrawable_balance: number;
    available_balance: number;
}

interface DenoSyncPayload {
    minBet?: number;
    maxBet?: number;
}

interface DenoStartOk {
    ok: true;
    wallet: Wallet;
    nextMultiplier?: number;
    betAmount?: number;
    difficulty?: DifficultyKey;
}

interface DenoJumpOk {
    ok: true;
    survived: boolean;
    cleared: number;
    multiplier: number;
    nextMultiplier?: number;
    wallet?: Wallet;
}

interface DenoCashoutOk {
    ok: true;
    cleared: number;
    multiplier: number;
    payout: number;
    wallet: Wallet;
}

interface DenoCrashOk {
    ok: true;
    /** True when the server ignored a race-induced crash. */
    ignored?: boolean;
    cleared?: number;
    multiplier?: number;
    payout?: number;
    wallet?: Wallet | null;
}

interface DenoError {
    ok: false;
    error: string;
}

type DenoStartResponse = DenoStartOk | DenoError;
type DenoJumpResponse = DenoJumpOk | DenoError;
type DenoCashoutResponse = DenoCashoutOk | DenoError;
type DenoCrashResponse = DenoCrashOk | DenoError;

// ============================================================
// Result discriminated union
// ============================================================
interface LossResult {
    type: "loss";
    obstaclesCleared: number;
    amount: number;
}

interface WinResult {
    type: "win";
    obstaclesCleared: number;
    multiplier: number;
    amount: number;
}

type RoundResult = LossResult | WinResult;

// ============================================================
// Phaser wrapper
// ============================================================
type PhaserGameConfig = Phaser.Types.Core.GameConfig;

class DinoGameInstance extends Phaser.Game {
    static CONFIG = CONFIG.GAME;

    private prevParentWidth = 0;
    private prevParentHeight = 0;

    constructor(config: PhaserGameConfig) {
        super(config);
        this.registerResizeHandler();
        this.addScenes();
        this.startScene();
    }

    private registerResizeHandler(): void {
        this.scale.on("resize", () => {
            const { width, height } = this.scale.parentSize;
            if (
                width === this.prevParentWidth &&
                height === this.prevParentHeight
            ) {
                return;
            }
            this.prevParentWidth = width;
            this.prevParentHeight = height;
        });
    }

    private addScenes(): void {
        this.scene.add(BootScene.CONFIG.NAME, BootScene);
        this.scene.add(GameScene.CONFIG.NAME, GameScene);
    }

    private startScene(): void {
        this.scene.start(BootScene.CONFIG.NAME);
    }
}

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
    minBet,
    maxBet,
}: {
    open: boolean;
    onClose: (dontShowAgain: boolean) => void;
    minBet: number;
    maxBet: number;
}) {
    const [dontShow, setDontShow] = useState<boolean>(readHideGuide());
    const sampleJumps = [1, 2, 3, 5, 8];

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose(dontShow)}>
            <DialogContent className="flex max-h-[88vh] w-[calc(100%-1.5rem)] max-w-md flex-col gap-0 p-0">
                <DialogHeader className="space-y-1 border-b px-4 py-3 text-left">
                    <DialogTitle className="flex items-center gap-2 text-base">
                        <span className="text-lg">🦖</span>
                        How to play Dino
                    </DialogTitle>
                    <DialogDescription className="text-xs">
                        Jump over obstacles to grow your multiplier, then cash out before
                        the dino crashes.
                    </DialogDescription>
                </DialogHeader>

                <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
                    <GuideSection step={1} title="Place your bet">
                        <p>
                            Enter your bet amount (between{" "}
                            <b className="text-foreground">
                                {minBet} and {maxBet.toLocaleString()} ETB
                            </b>
                            ) and choose a difficulty. Then press{" "}
                            <b className="text-foreground">Place Bet</b>. Your bet is taken
                            from your balance when the game starts.
                        </p>
                    </GuideSection>

                    <GuideSection step={2} title="Pick a difficulty">
                        <p>
                            Difficulty sets the chance of surviving each jump. Harder
                            difficulties are riskier but grow the multiplier faster.
                        </p>
                        <ul className="space-y-1">
                            {(Object.keys(DIFFICULTIES) as DifficultyKey[]).map((key) => {
                                const d = DIFFICULTIES[key];
                                return (
                                    <li
                                        key={key}
                                        className="flex items-center justify-between rounded-md border bg-muted/30 px-2 py-1.5"
                                    >
                                        <span className="flex items-center gap-1.5 font-semibold text-foreground">
                                            <span
                                                className="h-2 w-2 rounded-full"
                                                style={{ background: d.color }}
                                            />
                                            {d.label}
                                        </span>
                                        <span className="font-bold" style={{ color: d.color }}>
                                            {Math.round(d.survivalChance * 100)}% survive
                                        </span>
                                    </li>
                                );
                            })}
                        </ul>
                    </GuideSection>

                    <GuideSection step={3} title="Jump or cash out">
                        <p>
                            The dino runs by itself. When an obstacle gets close, the game
                            pauses and shows{" "}
                            <b className="text-foreground">"Obstacle Ahead!"</b>. Now you
                            decide:
                        </p>
                        <ul className="space-y-1">
                            <li className="rounded-md border bg-muted/30 px-2 py-1.5">
                                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                                    <Zap className="h-3 w-3 fill-current" /> Jump
                                </span>
                                <span>
                                    Risk it. If the dino survives, your multiplier goes up and
                                    the run continues. If it fails, the dino crashes and you
                                    lose your bet.
                                </span>
                            </li>
                            <li className="rounded-md border bg-muted/30 px-2 py-1.5">
                                <span className="flex items-center gap-1.5 font-semibold text-foreground">
                                    <Trophy className="h-3 w-3" /> Cash Out
                                </span>
                                <span>
                                    Take your winnings now: bet × current multiplier. You need
                                    to clear at least 1 obstacle before you can cash out.
                                </span>
                            </li>
                        </ul>
                    </GuideSection>

                    <GuideSection step={4} title="How the multiplier grows">
                        <p>
                            Each cleared obstacle raises the multiplier. The longer you
                            survive, the more you can win, but the odds of surviving every
                            jump in a row get smaller.
                        </p>
                        <div className="overflow-hidden rounded-md border">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="border-b bg-muted/50 text-[10px] uppercase tracking-wider">
                                        <th className="px-2 py-1 font-semibold">Jumps</th>
                                        {(Object.keys(DIFFICULTIES) as DifficultyKey[]).map(
                                            (key) => (
                                                <th
                                                    key={key}
                                                    className="px-2 py-1 font-semibold"
                                                    style={{ color: DIFFICULTIES[key].color }}
                                                >
                                                    {DIFFICULTIES[key].label}
                                                </th>
                                            ),
                                        )}
                                    </tr>
                                </thead>
                                <tbody className="divide-y">
                                    {sampleJumps.map((j) => (
                                        <tr key={j}>
                                            <td className="px-2 py-1 font-bold text-foreground">
                                                {j}
                                            </td>
                                            {(Object.keys(DIFFICULTIES) as DifficultyKey[]).map(
                                                (key) => (
                                                    <td
                                                        key={key}
                                                        className="px-2 py-1 tabular-nums"
                                                    >
                                                        {multiplierFor(
                                                            DIFFICULTIES[key].survivalChance,
                                                            j,
                                                        ).toFixed(2)}
                                                        ×
                                                    </td>
                                                ),
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <p>
                            Example: bet 100 ETB on Medium, clear 3 jumps and cash out at{" "}
                            {multiplierFor(DIFFICULTIES.medium.survivalChance, 3).toFixed(2)}
                            × to receive{" "}
                            {(
                                100 * multiplierFor(DIFFICULTIES.medium.survivalChance, 3)
                            ).toFixed(2)}{" "}
                            ETB.
                        </p>
                    </GuideSection>

                    <GuideSection step={5} title="Fair and server-controlled">
                        <p>
                            Every jump result is decided by the server, not by your device.
                            Your bet, multiplier and payouts are always calculated on the
                            server, so the game cannot be affected from your side.
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

// ============================================================
// Component
// ============================================================
export default function DinoGame() {
    const dispatch = useAppDispatch();
    const user = useAppSelector((s) => s.auth.user);
    const socket = useMemo(() => getSocket(), []);

    const wallet = user?.wallets;
    const balance = Number(wallet?.available_balance ?? 0);

    // -------- server config --------
    const [serverMin, setServerMin] = useState<number>(10);
    const [serverMax, setServerMax] = useState<number>(50_000);

    // -------- game state --------
    const [betAmount, setBetAmount] = useState<number>(10);
    const [difficulty, setDifficulty] = useState<DifficultyKey>("medium");
    const [phase, setPhase] = useState<Phase>("idle");
    const [obstaclesCleared, setObstaclesCleared] = useState<number>(0);
    const [currentMultiplier, setCurrentMultiplier] = useState<number>(1.0);
    const [nextMultiplier, setNextMultiplier] = useState<number>(1.0);
    const [lastResult, setLastResult] = useState<RoundResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const [gamesPlayed, setGamesPlayed] = useState<number>(0);
    const [highScore, setHighScore] = useState<number>(0);
    const [totalWagered, setTotalWagered] = useState<number>(0);
    const [totalProfit, setTotalProfit] = useState<number>(0);
    const [winRecords, setWinRecords] = useState<number[]>([]);

    const [statsOpen, setStatsOpen] = useState<boolean>(false);
    const [historyOpen, setHistoryOpen] = useState<boolean>(false);
    const [debugOpen, setDebugOpen] = useState<boolean>(false);
    const [hoveredProfitValue, setHoveredProfitValue] = useState<number | null>(
        null,
    );

    // How-to-play popup: opens when the user enters the page.
    const [guideOpen, setGuideOpen] = useState<boolean>(() => !readHideGuide());

    // -------- refs --------
    const gameContainerRef = useRef<HTMLDivElement>(null);
    const phaserContainerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<DinoGameInstance | null>(null);
    const gameSceneRef = useRef<GameScene | null>(null);
    const betAmountRef = useRef<number>(1);
    const difficultyRef = useRef<DifficultyKey>("medium");
    const phaseRef = useRef<Phase>("idle");
    const busyRef = useRef<boolean>(false);

    const widgetRef = useRef<HTMLDivElement>(null);
    const chartCanvasRef = useRef<HTMLCanvasElement>(null);
    const chartInstanceRef = useRef<Chart | null>(null);
    const profitHistoryRef = useRef<number[]>([0]);
    const isDragging = useRef<boolean>(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    const debugWidgetRef = useRef<HTMLDivElement>(null);
    const isDebugDragging = useRef<boolean>(false);
    const debugDragOffset = useRef({ x: 0, y: 0 });

    // -------- refs sync --------
    useEffect(() => {
        betAmountRef.current = betAmount;
    }, [betAmount]);
    useEffect(() => {
        difficultyRef.current = difficulty;
    }, [difficulty]);
    useEffect(() => {
        phaseRef.current = phase;
    }, [phase]);

    const closeGuide = (dontShowAgain: boolean) => {
        try {
            if (dontShowAgain) localStorage.setItem(GUIDE_KEY, "1");
            else localStorage.removeItem(GUIDE_KEY);
        } catch {
            /* storage unavailable, ignore */
        }
        setGuideOpen(false);
    };

    // ============================================================
    // SOCKET: config + wallet sync
    // ============================================================
    useEffect(() => {
        const onSync = (cfg: DenoSyncPayload) => {
            if (typeof cfg?.minBet === "number") setServerMin(cfg.minBet);
            if (typeof cfg?.maxBet === "number") setServerMax(cfg.maxBet);
        };
        const onWallet = (w: Wallet) => dispatch(setUserWallet(w));
        const onConnect = () => socket.emit("deno:requestState");

        socket.on("deno:sync", onSync);
        socket.on("deno:wallet", onWallet);
        socket.on("connect", onConnect);
        socket.emit("deno:requestState");

        return () => {
            socket.off("deno:sync", onSync);
            socket.off("deno:wallet", onWallet);
            socket.off("connect", onConnect);
        };
    }, [socket, dispatch]);

    // ============================================================
    // PHASER INIT
    // ============================================================
    useEffect(() => {
        if (!phaserContainerRef.current || gameRef.current) return;

        const config: PhaserGameConfig = {
            type: Phaser.AUTO,
            parent: phaserContainerRef.current,
            backgroundColor: "#fff",
            render: { antialias: false },
            scale: {
                width: CONFIG.GAME.WIDTH.LANDSCAPE,
                height: CONFIG.GAME.HEIGHT,
                mode: Phaser.Scale.ScaleModes.FIT,
                autoCenter: Phaser.Scale.CENTER_BOTH,
            },
            physics: {
                default: "arcade",
                arcade: { gravity: { x: 0, y: 0 }, debug: false },
            },
        };

        gameRef.current = new DinoGameInstance(config);

        const checkGame = window.setInterval(() => {
            const game = gameRef.current;
            if (!game || game.scene.scenes.length <= 1) return;

            const gameScene = game.scene.getScene(
                "SCENE_GAME",
            ) as GameScene | null;
            if (!gameScene?.events) return;

            gameSceneRef.current = gameScene;

            const onGameStartOrRestart = () => {
                setPhase("running");
                phaseRef.current = "running";
                gameScene.events.emit(CONFIG.EVENTS.BETTING_MODE_ON);
            };

            gameScene.events.on(CONFIG.EVENTS.GAME_START, onGameStartOrRestart);
            gameScene.events.on(CONFIG.EVENTS.GAME_RESTART, onGameStartOrRestart);

            gameScene.events.on(
                CONFIG.EVENTS.WAITING_FOR_JUMP,
                (cleared: number) => {
                    socket.emit("deno:obstacle", {});
                    setPhase("waiting");
                    phaseRef.current = "waiting";
                    setObstaclesCleared(cleared);
                },
            );

            // ⚠️ THE KEY CLIENT FIX.
            //
            // Phaser fires GAME_OVER when the physics overlap triggers — but in
            // betting mode, we pause the game by setting speed=0, which doesn't
            // stop the physics engine. That means we can get a spurious GAME_OVER
            // while the server is still waiting for a jump decision.
            //
            // Ignore GAME_OVER unless the dino was actually running between
            // obstacles. If we're in "waiting", the crash signal would wipe the
            // server's game state and the next jump would say "No active game".
            gameScene.events.on(CONFIG.EVENTS.GAME_OVER, () => {
                gameScene.events.emit(CONFIG.EVENTS.BETTING_MODE_OFF);

                if (phaseRef.current !== "running") {
                    // Spurious GAME_OVER during "waiting" / "idle" / "crashed" /
                    // "cashed_out" — ignore entirely.
                    return;
                }

                setPhase("crashed");
                phaseRef.current = "crashed";

                if (!socket.connected) return;

                socket.emit(
                    "deno:crash",
                    {},
                    (res: DenoCrashResponse | undefined) => {
                        // Server said the crash was a race and ignored it — put the
                        // client back into "waiting" so the player can jump.
                        if (res && "ok" in res && res.ok && res.ignored) {
                            setPhase("waiting");
                            phaseRef.current = "waiting";
                            return;
                        }
                        // Real crash — apply wallet if provided.
                        if (res && "ok" in res && res.ok && res.wallet) {
                            dispatch(setUserWallet(res.wallet));
                        }
                    },
                );
            });

            window.clearInterval(checkGame);
        }, 100);

        return () => {
            window.clearInterval(checkGame);
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
                gameSceneRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ============================================================
    // PLACE BET
    // ============================================================
    const placeBet = useCallback(async () => {
        if (busyRef.current) return;

        if (betAmount < serverMin || betAmount > serverMax) {
            setError(`Bet must be ${serverMin}–${serverMax} ETB`);
            return;
        }
        if (betAmount > balance) {
            setError("Insufficient funds");
            return;
        }
        if (!socket.connected) {
            setError("Not connected, please wait...");
            return;
        }

        busyRef.current = true;
        setError(null);
        setPhase("betting");
        phaseRef.current = "betting";
        setObstaclesCleared(0);
        setCurrentMultiplier(1.0);
        setNextMultiplier(1.0);
        setLastResult(null);

        const res = await new Promise<DenoStartResponse>((resolve) => {
            socket
                .timeout(BET_TIMEOUT_MS)
                .emit(
                    "deno:start",
                    { amount: betAmount, difficulty: difficultyRef.current },
                    (err: Error | null, response: DenoStartResponse) =>
                        resolve(
                            err
                                ? { ok: false, error: "No response from server" }
                                : response,
                        ),
                );
        });

        busyRef.current = false;

        if (!res || !res.ok) {
            setError(res?.error ?? "Could not start game");
            setPhase("idle");
            phaseRef.current = "idle";
            return;
        }

        if (res.wallet) dispatch(setUserWallet(res.wallet));
        if (typeof res.nextMultiplier === "number") {
            setNextMultiplier(res.nextMultiplier);
        }
        setTotalWagered((p) => p + betAmount);
        setGamesPlayed((p) => p + 1);

        toast("Game Started", {
            description: `${betAmount.toFixed(2)} ETB — ${DIFFICULTIES[difficultyRef.current].label
                }`,
            duration: 2500,
        });

        const scene = gameSceneRef.current;
        if (scene) {
            if (scene.isInitialStart) scene.events.emit(CONFIG.EVENTS.GAME_START);
            else scene.events.emit(CONFIG.EVENTS.GAME_RESTART);
        }
    }, [betAmount, balance, serverMin, serverMax, socket, dispatch]);

    // ============================================================
    // JUMP
    // ============================================================
    const handleJump = useCallback(async () => {
        if (phaseRef.current !== "waiting") return;
        if (busyRef.current) return;

        const scene = gameSceneRef.current;
        if (!scene) return;

        busyRef.current = true;

        const res = await new Promise<DenoJumpResponse>((resolve) => {
            socket
                .timeout(BET_TIMEOUT_MS)
                .emit(
                    "deno:jump",
                    {},
                    (err: Error | null, response: DenoJumpResponse) =>
                        resolve(
                            err
                                ? { ok: false, error: "No response from server" }
                                : response,
                        ),
                );
        });

        busyRef.current = false;

        if (!res || !res.ok) {
            setError(res?.error ?? "Jump failed");

            // Recover if the server lost our game (should be rare).
            if (res?.error === "No active game") {
                setPhase("idle");
                phaseRef.current = "idle";
                scene.events.emit(CONFIG.EVENTS.BETTING_MODE_OFF);
            }
            return;
        }

        if (res.survived) {
            scene.events.emit(CONFIG.EVENTS.JUMP_SUCCESS);
            const cleared = Number(res.cleared);
            const mult = Number(res.multiplier);
            setObstaclesCleared(cleared);
            setCurrentMultiplier(mult);
            if (typeof res.nextMultiplier === "number") {
                setNextMultiplier(res.nextMultiplier);
            }
            setPhase("running");
            phaseRef.current = "running";
            setHighScore((prev) => (cleared > prev ? cleared : prev));
            toast.success("Cleared!", {
                description: `Jump ${cleared} — ${mult.toFixed(2)}×`,
                duration: 1200,
            });
        } else {
            scene.events.emit(CONFIG.EVENTS.JUMP_FAIL);
            const lost = betAmountRef.current;
            setTotalProfit((p) => p - lost);
            setWinRecords((p) => [...p, -lost]);
            setLastResult({
                type: "loss",
                obstaclesCleared: Number(res.cleared ?? 0),
                amount: lost,
            });
            setPhase("crashed");
            phaseRef.current = "crashed";
            if (res.wallet) dispatch(setUserWallet(res.wallet));
            toast.error("Dino Crashed!", {
                description: `-${lost.toFixed(2)} ETB`,
                duration: 3000,
            });
        }
    }, [socket, dispatch]);

    // ============================================================
    // CASH OUT
    // ============================================================
    const cashOut = useCallback(async () => {
        if (phaseRef.current !== "waiting") return;
        if (busyRef.current) return;

        busyRef.current = true;

        const res = await new Promise<DenoCashoutResponse>((resolve) => {
            socket
                .timeout(BET_TIMEOUT_MS)
                .emit(
                    "deno:cashout",
                    {},
                    (err: Error | null, response: DenoCashoutResponse) =>
                        resolve(
                            err
                                ? { ok: false, error: "No response from server" }
                                : response,
                        ),
                );
        });

        busyRef.current = false;

        if (!res || !res.ok) {
            setError(res?.error ?? "Cashout failed");
            if (res?.error === "No active game") {
                setPhase("idle");
                phaseRef.current = "idle";
            }
            return;
        }

        if (res.wallet) dispatch(setUserWallet(res.wallet));

        const winAmount = Number(res.payout);
        const profit = winAmount - betAmountRef.current;
        setTotalProfit((p) => p + profit);
        setWinRecords((p) => [...p, profit]);
        setLastResult({
            type: "win",
            obstaclesCleared: Number(res.cleared),
            multiplier: Number(res.multiplier),
            amount: winAmount,
        });
        setPhase("cashed_out");
        phaseRef.current = "cashed_out";

        const scene = gameSceneRef.current;
        if (scene) {
            scene.events.emit(CONFIG.EVENTS.BETTING_MODE_OFF);
            scene.events.emit(
                CONFIG.EVENTS.GAME_OVER,
                scene.score,
                scene.highScore,
            );
        }

        toast.success("Cashed Out!", {
            description: `+${profit.toFixed(2)} ETB at ${Number(
                res.multiplier,
            ).toFixed(2)}×`,
            duration: 4000,
        });
    }, [socket, dispatch]);

    // ============================================================
    // Chart lifecycle
    // ============================================================
    useEffect(() => {
        if (!statsOpen && chartInstanceRef.current) {
            chartInstanceRef.current.destroy();
            chartInstanceRef.current = null;
        }
    }, [statsOpen]);

    useEffect(() => {
        if (!statsOpen || !chartCanvasRef.current) return;

        const WIN = "rgb(74, 222, 128)";
        const WIN_F = "rgba(74, 222, 128, 0.3)";
        const LOSS = "rgb(248, 113, 113)";
        const LOSS_F = "rgba(248, 113, 113, 0.3)";

        const history: number[] = [0];
        let running = 0;
        for (let i = 0; i < winRecords.length; i += 1) {
            running += winRecords[i];
            history.push(running);
        }
        profitHistoryRef.current = history;

        if (chartInstanceRef.current) {
            chartInstanceRef.current.data.labels = Array(history.length).fill(0);
            chartInstanceRef.current.data.datasets[0].data = history;
            chartInstanceRef.current.update();
            return;
        }

        chartInstanceRef.current = new Chart(chartCanvasRef.current, {
            type: "line",
            data: {
                labels: Array(history.length).fill(0),
                datasets: [
                    {
                        label: "Profit",
                        data: history,
                        fill: { target: "origin", above: WIN_F, below: LOSS_F },
                        cubicInterpolationMode: "monotone",
                        segment: {
                            borderColor: (ctx: {
                                p0?: { parsed: { y: number } };
                                p1?: { parsed: { y: number } };
                            }) =>
                                !ctx.p0 || !ctx.p1
                                    ? WIN
                                    : ctx.p1.parsed.y < 0
                                        ? LOSS
                                        : WIN,
                        },
                        pointRadius: 0,
                        pointHoverRadius: 4,
                        pointHoverBackgroundColor: "#fff",
                        pointHoverBorderColor: "#fff",
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animations: { y: { duration: 0 } },
                interaction: { intersect: false, mode: "index" },
                plugins: { legend: { display: false }, tooltip: { enabled: false } },
                scales: {
                    x: { display: false },
                    y: {
                        border: { display: false },
                        grid: {
                            color: (ctx: { tick: { value: number } }) =>
                                ctx.tick.value === 0 ? "#2a3f4d" : "transparent",
                            lineWidth: 2,
                        },
                        ticks: { display: false },
                        grace: "1%",
                    },
                },
                onHover: (
                    _event: unknown,
                    elements: { index: number }[],
                ): void => {
                    if (elements.length) {
                        const idx = elements[0].index;
                        const val = profitHistoryRef.current[idx];
                        setHoveredProfitValue(val !== undefined ? val : null);
                    } else {
                        setHoveredProfitValue(null);
                    }
                },
            },
        });
    }, [statsOpen, winRecords]);

    // ============================================================
    // Drag helper
    // ============================================================
    const startDrag = useCallback(
        (
            e: React.MouseEvent<HTMLDivElement>,
            ref: React.RefObject<HTMLDivElement>,
            flag: React.MutableRefObject<boolean>,
            offset: React.MutableRefObject<{ x: number; y: number }>,
        ) => {
            if (!ref.current) return;
            flag.current = true;
            const rect = ref.current.getBoundingClientRect();
            offset.current = {
                x: e.clientX - rect.left,
                y: e.clientY - rect.top,
            };

            const onMove = (ev: MouseEvent) => {
                const el = ref.current;
                if (!flag.current || !el) return;
                const nx = ev.clientX - offset.current.x;
                const ny = ev.clientY - offset.current.y;
                const maxX = window.innerWidth - el.offsetWidth;
                const maxY = window.innerHeight - el.offsetHeight;
                el.style.left = `${Math.max(0, Math.min(nx, maxX))}px`;
                el.style.top = `${Math.max(0, Math.min(ny, maxY))}px`;
                el.style.right = "auto";
                el.style.bottom = "auto";
                el.style.transform = "none";
            };
            const onUp = () => {
                flag.current = false;
                document.removeEventListener("mousemove", onMove);
                document.removeEventListener("mouseup", onUp);
            };
            document.addEventListener("mousemove", onMove);
            document.addEventListener("mouseup", onUp);
        },
        [],
    );

    // ============================================================
    // Derived values
    // ============================================================
    const diffConfig = DIFFICULTIES[difficulty];
    const isPlaying = phase === "running" || phase === "waiting";
    const canBet =
        phase === "idle" || phase === "crashed" || phase === "cashed_out";
    const winsCount = useMemo(
        () => winRecords.filter((r) => r > 0).length,
        [winRecords],
    );
    const lossesCount = useMemo(
        () => winRecords.filter((r) => r < 0).length,
        [winRecords],
    );

    const statsHeaderChips = useMemo(
        () => [
            { Icon: Target, label: "Jumps", val: obstaclesCleared },
            { Icon: Trophy, label: "Best", val: highScore },
            {
                Icon: TrendingUp,
                label: "Multi",
                val: `${currentMultiplier.toFixed(2)}×`,
            },
            {
                Icon: Flame,
                label: "State",
                val:
                    phase === "waiting"
                        ? "JUMP!"
                        : phase === "idle"
                            ? "—"
                            : phase.slice(0, 4).toUpperCase(),
            },
        ],
        [obstaclesCleared, highScore, currentMultiplier, phase],
    );

    const multiplierTrack = useMemo(() => {
        const out: { jump: number; mult: number }[] = [];
        for (let jump = 1; jump <= 12; jump += 1) {
            out.push({ jump, mult: multiplierFor(diffConfig.survivalChance, jump) });
        }
        return out;
    }, [diffConfig.survivalChance]);

    // ============================================================
    // RENDER
    // ============================================================
    return (
        <TooltipProvider delayDuration={200}>
            <div
                ref={gameContainerRef}
                className="w-full bg-background pb-3"
                style={{
                    WebkitTapHighlightColor: "transparent",
                    touchAction: "manipulation",
                    userSelect: "none",
                    WebkitUserSelect: "none",
                }}
            >
                {/* HOW TO PLAY POPUP */}
                <HowToPlayDialog
                    open={guideOpen}
                    onClose={closeGuide}
                    minBet={serverMin}
                    maxBet={serverMax}
                />

                {/* HERO HEADER */}
                <div className="relative mx-2 mt-2 overflow-hidden rounded-xl bg-gradient-to-br from-primary via-primary to-primary/85 px-3 py-2 text-primary-foreground shadow-sm">
                    <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full border-4 border-primary-foreground/15" />
                    <div className="relative z-10 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-foreground/15 text-base shadow-inner">
                                🦖
                            </div>
                            <div>
                                <h1 className="text-sm font-black uppercase leading-none tracking-wider">
                                    Dino
                                </h1>
                                <p className="text-[7px] font-medium uppercase tracking-widest text-primary-foreground/70">
                                    Jump · Survive · Cash Out
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
                        {statsHeaderChips.map(({ Icon, label, val }) => (
                            <div
                                key={label}
                                className="rounded-md bg-primary-foreground/10 px-1 py-1 text-center backdrop-blur-sm"
                            >
                                <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
                                    <Icon className="h-2 w-2" />
                                    <span className="text-[6px] uppercase tracking-wider">
                                        {label}
                                    </span>
                                </div>
                                <p className="mt-0.5 text-[10px] font-bold leading-none">
                                    {val}
                                </p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* GAME CANVAS */}
                <div className="relative mx-2 mt-1.5 overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm">
                    <div
                        ref={phaserContainerRef}
                        className="relative w-full"
                        style={{ aspectRatio: "16 / 9" }}
                    />

                    {phase === "idle" && (
                        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-background/60 backdrop-blur-[2px]">
                            <div className="text-center">
                                <div className="mb-1 text-4xl">🦖</div>
                                <p className="text-sm font-bold uppercase tracking-wider">
                                    Dino Gamble
                                </p>
                                <p className="mt-0.5 text-[10px] text-muted-foreground">
                                    Place your bet to start
                                </p>
                            </div>
                        </div>
                    )}

                    {phase === "waiting" && (
                        <div className="pointer-events-none absolute inset-x-0 top-2 z-20 flex flex-col items-center gap-0.5">
                            <div className="animate-pulse rounded-full bg-destructive px-3 py-1 text-[10px] font-black uppercase tracking-widest text-destructive-foreground shadow-lg">
                                ⚠️ Obstacle Ahead!
                            </div>
                            <div className="text-[9px] font-semibold text-white drop-shadow-lg">
                                Jump or Cash Out?
                            </div>
                        </div>
                    )}
                </div>

                {/* CONTROLS */}
                <div className="mx-2 mt-1.5 space-y-1.5">
                    <Card className="rounded-xl border-border/60 shadow-sm">
                        <CardContent className="space-y-2 p-2">
                            {/* Bet amount */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[8px] uppercase tracking-wider text-muted-foreground">
                                        Bet Amount
                                    </Label>
                                    <span className="text-[9px] font-medium text-muted-foreground">
                                        {betAmount.toFixed(2)} ETB
                                    </span>
                                </div>
                                <div className="flex gap-1.5">
                                    <div className="relative flex-1">
                                        <Input
                                            type="number"
                                            value={betAmount}
                                            onChange={(e) =>
                                                setBetAmount(
                                                    Math.max(
                                                        0.1,
                                                        isNaN(Number(e.target.value))
                                                            ? 0.1
                                                            : Number(e.target.value),
                                                    ),
                                                )
                                            }
                                            min={0.1}
                                            step={0.1}
                                            disabled={!canBet}
                                            className="h-8 rounded-lg pr-10 text-center text-[11px] font-bold"
                                        />
                                        <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[8px] text-muted-foreground">
                                            ETB
                                        </span>
                                    </div>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-8 rounded-lg px-2 text-[9px] font-bold"
                                        disabled={!canBet}
                                        onClick={() =>
                                            setBetAmount((p) =>
                                                Math.max(
                                                    0.1,
                                                    parseFloat((Number(p || 0.1) / 2).toFixed(2)),
                                                ),
                                            )
                                        }
                                    >
                                        ½
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="secondary"
                                        className="h-8 rounded-lg px-2 text-[9px] font-bold"
                                        disabled={!canBet}
                                        onClick={() =>
                                            setBetAmount((p) =>
                                                Math.min(
                                                    balance,
                                                    parseFloat((Number(p || 0.1) * 2).toFixed(2)),
                                                ),
                                            )
                                        }
                                    >
                                        2×
                                    </Button>
                                </div>
                                {betAmount > balance && (
                                    <p className="text-[9px] text-destructive">
                                        Can't bet more than your balance
                                    </p>
                                )}
                            </div>

                            {/* Difficulty */}
                            <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                    <Label className="text-[8px] uppercase tracking-wider text-muted-foreground">
                                        Difficulty
                                    </Label>
                                    <Badge
                                        variant="outline"
                                        className="h-4 gap-1 border-transparent px-1.5 text-[8px]"
                                        style={{
                                            backgroundColor: `${diffConfig.color}20`,
                                            color: diffConfig.color,
                                        }}
                                    >
                                        <span
                                            className="h-1 w-1 rounded-full"
                                            style={{ background: diffConfig.color }}
                                        />
                                        {Math.round(diffConfig.survivalChance * 100)}% Survive
                                    </Badge>
                                </div>
                                <div className="grid grid-cols-3 gap-1">
                                    {(Object.keys(DIFFICULTIES) as DifficultyKey[]).map(
                                        (key) => {
                                            const val = DIFFICULTIES[key];
                                            const active = difficulty === key;
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    onClick={() => setDifficulty(key)}
                                                    disabled={!canBet}
                                                    className={`rounded-lg border px-1 py-1.5 text-[10px] font-bold uppercase tracking-wider transition ${active
                                                        ? "border-transparent text-white shadow-sm"
                                                        : "border-border/60 bg-muted/20 text-muted-foreground hover:bg-muted/40"
                                                        } disabled:cursor-not-allowed disabled:opacity-60`}
                                                    style={
                                                        active ? { background: val.color } : undefined
                                                    }
                                                >
                                                    {val.label}
                                                </button>
                                            );
                                        },
                                    )}
                                </div>
                            </div>

                            {/* Action button */}
                            {canBet && (
                                <Button
                                    onClick={placeBet}
                                    disabled={betAmount <= 0 || betAmount > balance}
                                    className="h-9 w-full rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-sm"
                                >
                                    <Play className="mr-1.5 h-3 w-3 fill-current" />
                                    {phase === "idle" ? "Place Bet" : "Play Again"}
                                </Button>
                            )}

                            {isPlaying && (
                                <div className="grid grid-cols-2 gap-1.5">
                                    <Button
                                        onClick={handleJump}
                                        disabled={phase !== "waiting"}
                                        className="h-auto flex-col gap-0 rounded-lg py-2 text-[11px] font-black uppercase tracking-widest"
                                    >
                                        <div className="flex items-center gap-1">
                                            <Zap className="h-3.5 w-3.5 fill-current" /> JUMP!
                                        </div>
                                        <div className="mt-0.5 text-[8px] font-medium normal-case opacity-80">
                                            Risk to {nextMultiplier.toFixed(2)}×
                                        </div>
                                    </Button>
                                    <Button
                                        onClick={cashOut}
                                        disabled={
                                            phase !== "waiting" || obstaclesCleared <= 0
                                        }
                                        variant="secondary"
                                        className="h-auto flex-col gap-0 rounded-lg py-2 text-[11px] font-black uppercase tracking-widest"
                                    >
                                        <div className="flex items-center gap-1">
                                            <Trophy className="h-3.5 w-3.5" /> Cash Out
                                        </div>
                                        <div className="mt-0.5 text-[8px] font-medium normal-case opacity-80">
                                            {(betAmount * currentMultiplier).toFixed(2)} ETB
                                        </div>
                                    </Button>
                                </div>
                            )}

                            {/* Last result */}
                            {lastResult && (
                                <div
                                    className={`rounded-lg border p-2 ${lastResult.type === "loss"
                                        ? "border-rose-500/30 bg-rose-500/5"
                                        : "border-emerald-500/30 bg-emerald-500/5"
                                        }`}
                                >
                                    <div className="flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                        <Trophy className="h-3 w-3" /> Last Game
                                    </div>
                                    {lastResult.type === "loss" ? (
                                        <p className="mt-0.5 text-xs font-bold text-rose-500">
                                            💀 Crashed!
                                        </p>
                                    ) : (
                                        <div className="mt-0.5 flex items-baseline justify-between">
                                            <span className="text-sm font-black">
                                                {lastResult.multiplier.toFixed(2)}×
                                            </span>
                                            <span className="text-[11px] font-bold text-emerald-500">
                                                +{lastResult.amount.toFixed(2)}
                                            </span>
                                        </div>
                                    )}
                                    <p className="mt-0.5 text-[9px] text-muted-foreground">
                                        Cleared {lastResult.obstaclesCleared} obstacles
                                    </p>
                                </div>
                            )}

                            {error && (
                                <p className="text-center text-[9px] font-medium text-rose-500">
                                    {error}
                                </p>
                            )}
                        </CardContent>
                    </Card>

                    {/* Multiplier track */}
                    <Card className="rounded-xl border-border/60 shadow-sm">
                        <CardContent className="p-2">
                            <div className="mb-1.5 flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                <Zap className="h-3 w-3" />
                                Multiplier Track ({diffConfig.label})
                            </div>
                            <div className="flex gap-1 overflow-x-auto pb-1">
                                {multiplierTrack.map(({ jump, mult }) => {
                                    const achieved = obstaclesCleared >= jump;
                                    const next = obstaclesCleared + 1 === jump;
                                    return (
                                        <Badge
                                            key={jump}
                                            variant="outline"
                                            className={`h-6 shrink-0 gap-0.5 rounded-md px-1.5 text-[9px] font-bold tabular-nums ${achieved
                                                ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                                : next
                                                    ? "border-primary bg-primary/15 text-primary"
                                                    : "border-border/60 bg-muted/20 text-muted-foreground"
                                                }`}
                                        >
                                            {jump}: {mult.toFixed(2)}×
                                        </Badge>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Footer tools */}
                    <div className="flex items-center justify-between rounded-xl border border-border/60 bg-card p-1">
                        <div className="flex gap-0.5">
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => setStatsOpen(true)}
                                    >
                                        <LineChart className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Live Stats</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className="h-7 w-7"
                                        onClick={() => setHistoryOpen(true)}
                                    >
                                        <BarChart3 className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Dashboard</TooltipContent>
                            </Tooltip>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        className={`h-7 w-7 ${debugOpen ? "text-primary" : ""
                                            }`}
                                        onClick={() => setDebugOpen((v) => !v)}
                                    >
                                        <Bug className="h-3.5 w-3.5" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>Server Debug</TooltipContent>
                            </Tooltip>
                        </div>
                        <div className="flex items-center gap-1 pr-1 text-[9px] text-muted-foreground">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            Server-authoritative
                        </div>
                    </div>
                </div>

                {/* LIVE STATS */}
                {statsOpen && (
                    <div
                        ref={widgetRef}
                        className="fixed bottom-4 right-4 z-40 w-64 overflow-hidden rounded-xl border border-border/60 bg-card shadow-xl animate-in fade-in zoom-in-95"
                    >
                        <div
                            className="flex cursor-move items-center justify-between border-b border-border/60 px-2 py-1.5"
                            onMouseDown={(e) =>
                                startDrag(e, widgetRef, isDragging, dragOffset)
                            }
                        >
                            <div className="flex items-center gap-1.5">
                                <LineChart className="h-3.5 w-3.5 text-muted-foreground" />
                                <span className="text-[10px] font-bold uppercase tracking-wider">
                                    Live Stats
                                </span>
                            </div>
                            <div className="flex items-center gap-0.5">
                                <button
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={() => setWinRecords([])}
                                    className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted"
                                >
                                    <RefreshCw className="h-3 w-3" />
                                </button>
                                <button
                                    onMouseDown={(e) => e.stopPropagation()}
                                    onClick={() => setStatsOpen(false)}
                                    className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted"
                                >
                                    <X className="h-3 w-3" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2 p-2">
                            <div className="flex items-center gap-2">
                                <div className="flex-1 rounded-lg bg-muted/40 p-2">
                                    <p className="text-[8px] uppercase tracking-wider text-muted-foreground">
                                        Profit
                                    </p>
                                    <p
                                        className={`text-sm font-bold tabular-nums ${totalProfit >= 0
                                            ? "text-emerald-500"
                                            : "text-rose-500"
                                            }`}
                                    >
                                        {totalProfit.toFixed(2)}
                                    </p>
                                </div>
                                <Separator orientation="vertical" className="h-10" />
                                <div className="flex flex-1 flex-col gap-0.5">
                                    <div className="flex justify-between text-[9px]">
                                        <span className="text-muted-foreground">Wins</span>
                                        <span className="font-bold text-emerald-500">
                                            {winsCount}
                                        </span>
                                    </div>
                                    <div className="flex justify-between text-[9px]">
                                        <span className="text-muted-foreground">Losses</span>
                                        <span className="font-bold text-rose-500">
                                            {lossesCount}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div onMouseLeave={() => setHoveredProfitValue(null)}>
                                <div className="mb-1 flex items-center justify-between">
                                    <span className="text-[8px] uppercase tracking-wider text-muted-foreground">
                                        Profit History
                                    </span>
                                    {hoveredProfitValue !== null && (
                                        <span
                                            className={`text-[10px] font-bold tabular-nums ${hoveredProfitValue >= 0
                                                ? "text-emerald-500"
                                                : "text-rose-500"
                                                }`}
                                        >
                                            {hoveredProfitValue >= 0 ? "" : "-"}
                                            {Math.abs(hoveredProfitValue).toFixed(2)}
                                        </span>
                                    )}
                                </div>
                                <div className="h-16 w-full">
                                    <canvas ref={chartCanvasRef} />
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* DEBUG */}
                {debugOpen && (
                    <div
                        ref={debugWidgetRef}
                        className="fixed bottom-4 left-4 z-40 w-60 overflow-hidden rounded-xl border border-primary/40 bg-card shadow-xl animate-in fade-in zoom-in-95"
                    >
                        <div
                            className="flex cursor-move items-center justify-between border-b border-border/60 bg-primary/10 px-2 py-1.5"
                            onMouseDown={(e) =>
                                startDrag(
                                    e,
                                    debugWidgetRef,
                                    isDebugDragging,
                                    debugDragOffset,
                                )
                            }
                        >
                            <div className="flex items-center gap-1.5">
                                <Bug className="h-3.5 w-3.5 text-primary" />
                                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                                    Server Debug
                                </span>
                            </div>
                            <button
                                onMouseDown={(e) => e.stopPropagation()}
                                onClick={() => setDebugOpen(false)}
                                className="flex h-5 w-5 items-center justify-center rounded hover:bg-muted"
                            >
                                <X className="h-3 w-3" />
                            </button>
                        </div>
                        <div className="space-y-1.5 p-2 text-[10px]">
                            <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Bet range:</span>
                                <span className="font-mono text-[9px]">
                                    {serverMin}–{serverMax}
                                </span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Difficulty:</span>
                                <span className="font-mono text-[9px]">{difficulty}</span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Survive%:</span>
                                <span className="font-mono text-[9px]">
                                    {Math.round(diffConfig.survivalChance * 100)}%
                                </span>
                            </div>
                            <div className="flex justify-between gap-2">
                                <span className="text-muted-foreground">Phase:</span>
                                <span className="font-mono text-[9px]">{phase}</span>
                            </div>
                            <div className="rounded-md bg-muted/40 p-1.5 text-center">
                                <p className="text-[9px] font-semibold text-primary">
                                    Outcomes decided server-side
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* HISTORY */}
                <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                    <DialogContent className="w-[calc(100%-20px)] max-w-sm gap-0 overflow-hidden rounded-2xl border-border/60 bg-card p-0">
                        <DialogHeader className="border-b border-border/50 px-3 py-2.5 text-left">
                            <DialogTitle className="flex items-center gap-1.5 text-[13px] font-bold">
                                <Zap className="h-3.5 w-3.5 text-primary" />
                                Play History & Dashboard
                            </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-3 p-3">
                            <div>
                                <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Lifetime Stats
                                </p>
                                <div className="rounded-lg border border-border/60 bg-muted/20 p-2">
                                    <div className="mb-2 text-center">
                                        <p className="text-[8px] uppercase tracking-wider text-muted-foreground">
                                            Total Profit
                                        </p>
                                        <p
                                            className={`mt-0.5 text-lg font-black tabular-nums ${totalProfit >= 0
                                                ? "text-emerald-500"
                                                : "text-rose-500"
                                                }`}
                                        >
                                            {totalProfit >= 0 ? "+" : ""}
                                            {totalProfit.toFixed(2)}
                                        </p>
                                    </div>
                                    <Separator className="my-2" />
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-muted-foreground">
                                                Total Wagered
                                            </span>
                                            <span className="font-bold text-primary tabular-nums">
                                                {totalWagered.toFixed(2)}
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-muted-foreground">Best Run</span>
                                            <span className="font-bold text-yellow-500">
                                                {highScore} jumps
                                            </span>
                                        </div>
                                        <div className="flex justify-between text-[10px]">
                                            <span className="text-muted-foreground">
                                                Games Played
                                            </span>
                                            <span className="font-bold">{gamesPlayed}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div>
                                <p className="mb-1.5 text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                                    Achievements
                                </p>
                                <div className="grid grid-cols-3 gap-1.5">
                                    {(
                                        [
                                            {
                                                key: "first",
                                                unlocked: gamesPlayed > 0,
                                                Icon: Star,
                                                label: "First Run",
                                            },
                                            {
                                                key: "survivor",
                                                unlocked: highScore >= 5,
                                                Icon: Flame,
                                                label: "Survivor 5",
                                            },
                                            {
                                                key: "profit",
                                                unlocked: totalProfit > 0,
                                                Icon: Trophy,
                                                label: "In Profit",
                                            },
                                        ] as const
                                    ).map(({ key, unlocked, Icon, label }) => (
                                        <div
                                            key={key}
                                            className={`flex flex-col items-center gap-1 rounded-lg border p-2 text-center ${unlocked
                                                ? "border-primary/40 bg-primary/5"
                                                : "border-border/60 bg-muted/20 opacity-50"
                                                }`}
                                        >
                                            <Icon
                                                className={`h-4 w-4 ${unlocked
                                                    ? "text-primary"
                                                    : "text-muted-foreground"
                                                    }`}
                                            />
                                            <span className="text-[8px] font-bold uppercase tracking-wider">
                                                {label}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </DialogContent>
                </Dialog>
            </div>
        </TooltipProvider>
    );
}