// roulette.tsx — Telegram mini-app layout (300×600)
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type ReactNode,
} from "react";
import {
    LayoutGrid,
    Repeat,
    Trash2,
    Undo2,
    X,
    Check,
} from "lucide-react";
import type { Socket } from "socket.io-client";

import RouletteGame from "./rouletteGame";
import RouletteTable from "./rouletteTable";
import { get_roulette_bets, preloadImage } from "./game";
import { getWindowDimensions } from "./util";
import {
    CHIPS,
    MAX_RECENT,
    payoutMultiplier,
    sumBets,
    toList,
    type Pocket,
    type SpinParams,
    type TableType,
} from "./rouletteLogic";
import carrot_img from "/icons/carrot_icon.png";
import { useAppDispatch, useAppSelector } from "@/store/hook";
// ⚠️ adjust this path to wherever your auth slice lives
import { setUserWallet } from "@/store/slice/auth";
import { connectSocket, getSocket } from "@/lib/socket";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// ============================================================
// Telegram helpers
// ============================================================
const tg = () => (window as any).Telegram?.WebApp;

const haptic = {
    tap: () => tg()?.HapticFeedback?.selectionChanged?.(),
    impact: (s: "light" | "medium" | "heavy" = "light") =>
        tg()?.HapticFeedback?.impactOccurred?.(s),
    notify: (t: "success" | "error" | "warning") =>
        tg()?.HapticFeedback?.notificationOccurred?.(t),
};

// ============================================================
// Server contract
// ============================================================
type ServerPhase = 0 | 1 | 2;

interface ServerPocket {
    nr: string;
    color: "red" | "black" | "green";
}

interface ServerResult {
    staked: number;
    returned: number;
    net: number;
    winning?: ServerPocket;
    wallet?: any;
}

const SPIN_TIME_FRAMES = 600;
const SPIN_ARC = Math.PI / 18.5;
const BETTING_MS = 15_000;

// auto-submit this many ms before the betting phase ends
const AUTOSUBMIT_AT_MS = 2000;

const DEFAULT_TABLE: TableType = "european";
const PAGE = { game: { table_name: "roulette", table_type: DEFAULT_TABLE } };

const buildSpin = (winning: string): SpinParams => ({
    arc: SPIN_ARC,
    spin_time: SPIN_TIME_FRAMES,
    ball_speed: 0.05,
    monkey: winning,
});

const toPocket = (p: ServerPocket): Pocket => ({
    nr: String(p.nr),
    color: p.color,
});

const pocketBg = (color: string) =>
    color === "red"
        ? "bg-red-600"
        : color === "black"
            ? "bg-neutral-900"
            : "bg-green-600";

// ============================================================
// Popup shell
// ============================================================
function Popup({
    open,
    onClose,
    z = 60,
    maxW = 280,
    children,
}: {
    open: boolean;
    onClose: () => void;
    z?: number;
    maxW?: number;
    children: ReactNode;
}) {
    if (!open) return null;
    return (
        <div
            className="fixed inset-0 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm animate-in fade-in"
            style={{
                zIndex: z,
                paddingTop: "max(0.75rem, var(--tg-content-safe-area-inset-top, 0px))",
                paddingBottom: "max(0.75rem, var(--tg-content-safe-area-inset-bottom, 0px))",
            }}
            onClick={onClose}
        >
            <div
                role="dialog"
                aria-modal="true"
                className="flex max-h-full w-full flex-col overflow-hidden rounded-2xl border border-border/60 bg-card shadow-2xl animate-in zoom-in-95"
                style={{ maxWidth: maxW }}
                onClick={(e) => e.stopPropagation()}
            >
                {children}
            </div>
        </div>
    );
}

function PopupHeader({
    icon,
    title,
    right,
    onClose,
}: {
    icon: ReactNode;
    title: string;
    right?: ReactNode;
    onClose: () => void;
}) {
    return (
        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
            <div className="flex min-w-0 items-center gap-1.5">
                {icon}
                <span className="truncate text-[11px] font-bold uppercase tracking-wider">
                    {title}
                </span>
            </div>
            <div className="flex items-center gap-1">
                {right}
                <button
                    type="button"
                    onClick={onClose}
                    aria-label="Close"
                    className="flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground hover:bg-muted"
                >
                    <X className="h-3.5 w-3.5" />
                </button>
            </div>
        </div>
    );
}

// ============================================================
// Table popup (chip strip + number grid + your picks) — all-in-one
// ============================================================
interface TablePopupProps {
    open: boolean;
    disabled: boolean;
    submitting: boolean;
    tableType: TableType;
    balance: number;
    chip: number;
    chips: readonly number[];
    secondsLeft: number;
    images: HTMLImageElement[] | null;
    tokenImages: HTMLImageElement[] | null;
    width: number;
    bets: Record<string, number>;
    canUndo: boolean;
    onChipSelect: (v: number) => void;
    onSpotClick: (text: string) => void;
    onUndo: () => void;
    onClear: () => void;
    onConfirm: () => void;
    onClose: () => void;
}

function TablePopup({
    open,
    disabled,
    submitting,
    tableType,
    balance,
    chip,
    chips,
    secondsLeft,
    images,
    tokenImages,
    width,
    bets,
    canUndo,
    onChipSelect,
    onSpotClick,
    onUndo,
    onClear,
    onConfirm,
    onClose,
}: TablePopupProps) {
    const total = sumBets(bets);
    const picks = Object.entries(bets);

    return (
        <Popup open={open} onClose={onClose} z={60} maxW={360}>
            <PopupHeader
                icon={<LayoutGrid className="h-3.5 w-3.5 text-primary" />}
                title={tableType}
                onClose={onClose}
                right={
                    <>
                        <Badge
                            variant="outline"
                            className={`h-5 px-1.5 text-[10px] tabular-nums ${secondsLeft <= 5 ? "border-rose-500 text-rose-500" : ""
                                }`}
                        >
                            {disabled ? "closed" : `${secondsLeft}s`}
                        </Badge>
                        <Badge
                            variant="secondary"
                            className="h-5 px-1.5 text-[10px] tabular-nums"
                        >
                            {balance.toFixed(2)}
                        </Badge>
                    </>
                }
            />

            {/* ============ CHIP STRIP (tap to pick chip) ============ */}
            <div className="shrink-0 border-b border-border/60 px-2 py-2">
                <div className="mb-1 flex items-center justify-between">
                    <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        Chip
                    </span>
                    <span className="text-[10px] font-bold tabular-nums text-amber-500">
                        {chip} ETB
                    </span>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                    {chips.map((v) => {
                        const active = v === chip;
                        const tooMuch = v > balance;
                        return (
                            <button
                                key={v}
                                type="button"
                                disabled={disabled || tooMuch}
                                onClick={() => onChipSelect(v)}
                                aria-label={`Select ${v} chip`}
                                className={`relative flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-[10px] font-black tabular-nums transition-all active:scale-95 ${active
                                    ? "border-amber-400 bg-amber-500 text-white shadow-[0_0_10px_rgba(245,158,11,0.55)]"
                                    : tooMuch
                                        ? "border-border/40 bg-muted/20 text-muted-foreground/50"
                                        : "border-border/60 bg-muted/40 text-foreground"
                                    }`}
                            >
                                <span className="absolute inset-[3px] rounded-full border border-white/25" />
                                {v}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* ============ TABLE (numbers) ============ */}
            <div className="min-h-0 flex-1 overflow-auto p-2">
                {images && tokenImages ? (
                    <RouletteTable
                        images={images}
                        tokenImages={tokenImages}
                        tableType={tableType}
                        width={width}
                        bets={bets}
                        disabled={disabled}
                        onSpotClick={onSpotClick}
                    />
                ) : (
                    <div className="flex h-40 items-center justify-center text-[10px] text-muted-foreground">
                        Loading table…
                    </div>
                )}
            </div>

            {/* ============ YOUR PICKS ============ */}
            <div className="shrink-0 border-t border-border/60 px-3 py-1.5">
                {picks.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground">
                        No picks yet.
                    </p>
                ) : (
                    <div className="flex gap-1 overflow-x-auto pb-0.5">
                        {picks.map(([text, amount]) => (
                            <span
                                key={text}
                                className="flex shrink-0 items-center gap-1 rounded-full border border-amber-400/40 bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold tabular-nums"
                            >
                                {text}
                                <span className="text-amber-500">{amount}</span>
                            </span>
                        ))}
                    </div>
                )}
            </div>

            {/* ============ ACTIONS ============ */}
            <div className="flex shrink-0 items-center gap-1.5 border-t border-border/60 px-3 py-2">
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Undo"
                    onClick={onUndo}
                    disabled={disabled || !canUndo}
                    className="h-8 w-8 shrink-0 rounded-lg"
                >
                    <Undo2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    aria-label="Clear"
                    onClick={onClear}
                    disabled={disabled || picks.length === 0}
                    className="h-8 w-8 shrink-0 rounded-lg"
                >
                    <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                    type="button"
                    onClick={onConfirm}
                    disabled={disabled || submitting || total <= 0}
                    className="h-8 flex-1 rounded-lg text-[11px] font-bold"
                >
                    <Check className="mr-1 h-3.5 w-3.5" />
                    {submitting ? "Placing…" : `Place bet · ${total} ETB`}
                </Button>
            </div>
        </Popup>
    );
}

// ============================================================
// Main component
// ============================================================
export default function Roulette() {
    const dispatch = useAppDispatch();
    const wallet = useAppSelector((s) => s.auth.user?.wallets);
    const tableType = PAGE.game.table_type;

    // -------- Local betting slip --------
    const [bets, setBets] = useState<Record<string, number>>({});
    const [placements, setPlacements] = useState<
        { text: string; amount: number }[]
    >([]);
    const [lastBets, setLastBets] = useState<Record<string, number>>({});
    const [chip, setChip] = useState<number>(CHIPS[2] ?? 10);

    // -------- Server-driven --------
    const [phase, setPhase] = useState<ServerPhase>(0);
    const [roundNumber, setRoundNumber] = useState(0);
    const [winning, setWinning] = useState<Pocket | null>(null);
    const [recent, setRecent] = useState<Pocket[]>([]);
    const [myResult, setMyResult] = useState<ServerResult | null>(null);
    const [submitted, setSubmitted] = useState(false);
    const [submitting, setSubmitting] = useState(false);

    // -------- Timing --------
    const [now, setNow] = useState(Date.now());
    const [phaseEndsAt, setPhaseEndsAt] = useState(Date.now() + BETTING_MS);
    const [offset, setOffset] = useState(0);

    // -------- Wheel --------
    const [spin, setSpin] = useState<SpinParams | null>(null);

    // -------- UI --------
    const [open, setOpen] = useState(false);

    const autoSubmittedRef = useRef(false);
    const phaseRef = useRef<ServerPhase>(0);
    const myResultRef = useRef<ServerResult | null>(null);
    useEffect(() => {
        phaseRef.current = phase;
    }, [phase]);
    useEffect(() => {
        myResultRef.current = myResult;
    }, [myResult]);

    // -------- Wallet (Redux is the single source of truth) --------
    // While the wheel is spinning we hold the payout back so the balance
    // doesn't reveal the result before the ball lands.
    const pendingWalletRef = useRef<any>(null);

    const applyWallet = useCallback(
        (w: any) => {
            if (!w || w.available_balance === undefined) return;
            dispatch(setUserWallet(w));
        },
        [dispatch],
    );

    const applyOrHoldWallet = useCallback(
        (w: any) => {
            if (!w) return;
            if (phaseRef.current === 1) pendingWalletRef.current = w;
            else applyWallet(w);
        },
        [applyWallet],
    );

    const flushWallet = useCallback(() => {
        if (!pendingWalletRef.current) return;
        applyWallet(pendingWalletRef.current);
        pendingWalletRef.current = null;
    }, [applyWallet]);

    // -------- Notice toast --------
    const [notice, setNotice] = useState<string | null>(null);
    const noticeTimer = useRef<number | undefined>(undefined);
    const flash = useCallback((msg: string) => {
        setNotice(msg);
        haptic.notify("error");
        window.clearTimeout(noticeTimer.current);
        noticeTimer.current = window.setTimeout(() => setNotice(null), 2000);
    }, []);
    useEffect(() => () => window.clearTimeout(noticeTimer.current), []);

    // -------- Telegram WebApp setup --------
    useEffect(() => {
        const w = tg();
        if (!w) return;
        w.ready?.();
        w.expand?.();
        w.disableVerticalSwipes?.(); // don't close the app by swiping while playing
    }, []);

    // Telegram back button closes the popup first
    useEffect(() => {
        const w = tg();
        const back = w?.BackButton;
        if (!back) return;
        const onBack = () => setOpen(false);
        if (open) {
            back.show();
            back.onClick(onBack);
        } else {
            back.hide();
        }
        return () => back.offClick?.(onBack);
    }, [open]);

    // -------- Viewport --------
    const [width, setWidth] = useState(() => getWindowDimensions().width);
    useEffect(() => {
        const onResize = () => setWidth(getWindowDimensions().width);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    // -------- Preload images --------
    const [images, setImages] = useState<HTMLImageElement[] | null>(null);
    const [tokenImages, setTokenImages] = useState<HTMLImageElement[] | null>(
        null,
    );
    useEffect(() => {
        Promise.all(get_roulette_bets().map((it) => preloadImage(it.src, it.id)))
            .then(setImages)
            .catch(() => setImages(null));
        preloadImage(carrot_img, "carrot_img")
            .then((img) => setTokenImages([img]))
            .catch(() => setTokenImages(null));
    }, []);

    // -------- Clock tick --------
    useEffect(() => {
        const iv = window.setInterval(() => setNow(Date.now()), 200);
        return () => window.clearInterval(iv);
    }, []);

    // -------- Socket wiring --------
    useEffect(() => {
        let alive = true;
        let sock: Socket | null = null;

        const onSync = (d: any) => {
            if (!alive) return;
            setOffset(Date.now() - d.serverTime);
            phaseRef.current = d.phase as ServerPhase;
            setPhase(d.phase as ServerPhase);
            setRoundNumber(d.roundNumber);
            setPhaseEndsAt(d.phaseEndsAt);
            setRecent((d.recent ?? []).map(toPocket));

            if (d.winning) {
                const p = toPocket(d.winning);
                setWinning(p);
                if (d.phase === 1) setSpin((prev) => prev ?? buildSpin(p.nr));
            } else {
                setWinning(null);
            }

            if (d.yourEntry) {
                setBets(d.yourEntry.bets);
                setPlacements(toList(d.yourEntry.bets));
                setSubmitted(true);
            } else {
                setSubmitted(false);
            }

            if (d.yourResult) setMyResult(d.yourResult);
            // a fresh sync always carries the real balance
            if (d.wallet) applyWallet(d.wallet);
        };

        const onRoundStart = (d: any) => {
            if (!alive) return;
            setOffset(Date.now() - d.serverTime);
            phaseRef.current = 0;
            setPhase(0);
            setRoundNumber(d.roundNumber);
            setPhaseEndsAt(d.phaseEndsAt);

            flushWallet();

            // Reset the slip for the new round.
            setBets({});
            setPlacements([]);
            setWinning(null);
            setMyResult(null);
            setSubmitted(false);
            setSubmitting(false);
            setSpin(null);
            autoSubmittedRef.current = false;

            // open the table popup for the new round (single popup: chips + numbers)
            setOpen(true);
            haptic.impact("medium");
        };

        const onSpinStart = (d: any) => {
            if (!alive) return;
            setOffset(Date.now() - d.serverTime);
            phaseRef.current = 1;
            setPhase(1);
            setPhaseEndsAt(d.phaseEndsAt);

            const p: Pocket = { nr: String(d.winning), color: d.color };
            setWinning(p);
            setSpin(buildSpin(p.nr));

            // hide the popup when the wheel starts
            setOpen(false);
        };

        const onResult = (d: any) => {
            if (!alive) return;
            phaseRef.current = 2;
            setPhase(2);
            setPhaseEndsAt(d.phaseEndsAt);
            setRecent((d.recent ?? []).map(toPocket));
            flushWallet(); // fallback if the wheel callback never fired
        };

        const onMyResult = (d: any) => {
            if (!alive) return;
            setMyResult(d);
            if (d.wallet) applyOrHoldWallet(d.wallet);
        };

        const onWallet = (w: any) => {
            if (!alive) return;
            applyOrHoldWallet(w);
        };

        connectSocket()
            .then((s) => {
                if (!alive) return;
                sock = s;

                s.on("roulette:sync", onSync);
                s.on("roulette:round-start", onRoundStart);
                s.on("roulette:spin-start", onSpinStart);
                s.on("roulette:result", onResult);
                s.on("roulette:my-result", onMyResult);
                s.on("roulette:wallet", onWallet);

                s.emit("roulette:requestState");
            })
            .catch((err) => {
                console.error("[roulette] socket:", err);
                flash("Connection failed");
            });

        return () => {
            alive = false;
            if (sock) {
                sock.off("roulette:sync", onSync);
                sock.off("roulette:round-start", onRoundStart);
                sock.off("roulette:spin-start", onSpinStart);
                sock.off("roulette:result", onResult);
                sock.off("roulette:my-result", onMyResult);
                sock.off("roulette:wallet", onWallet);
            }
        };
    }, [flash, applyWallet, applyOrHoldWallet, flushWallet]);

    // -------- Derived --------
    const serverNow = now - offset;
    const msLeft = Math.max(0, phaseEndsAt - serverNow);
    const secondsLeft = Math.ceil(msLeft / 1000);

    const staked = sumBets(bets);
    // `available_balance` from Redux already has a submitted bet deducted.
    const balance = Number(wallet?.available_balance ?? 0);
    const displayBalance = submitted ? balance : Math.max(0, balance - staked);

    const canEditSlip = phase === 0 && msLeft > 0 && !submitted && !submitting;

    const potentialWin = useMemo(() => {
        const list = toList(bets);
        if (list.length === 0) return 0;
        return Math.max(
            ...list.map((p) => p.amount * (payoutMultiplier(p.text) + 1)),
        );
    }, [bets]);

    // -------- Wheel finished --------
    const handleSpinEnd = useCallback(() => {
        flushWallet();
        const r = myResultRef.current;
        if (r && r.staked > 0) haptic.notify(r.net > 0 ? "success" : "warning");
    }, [flushWallet]);

    // -------- Bet actions --------
    const handleSpotClick = useCallback(
        (text: string) => {
            if (!canEditSlip) return;
            if (chip > displayBalance) {
                flash("Insufficient funds");
                return;
            }
            haptic.impact("light");
            setBets((prev) => ({ ...prev, [text]: (prev[text] ?? 0) + chip }));
            setPlacements((prev) => [...prev, { text, amount: chip }]);
        },
        [canEditSlip, chip, displayBalance, flash],
    );

    const handleUndo = useCallback(() => {
        if (!canEditSlip) return;
        haptic.tap();
        setPlacements((prev) => {
            const last = prev[prev.length - 1];
            if (!last) return prev;
            setBets((b) => {
                const next = { ...b };
                const left = (next[last.text] ?? 0) - last.amount;
                if (left <= 0) delete next[last.text];
                else next[last.text] = left;
                return next;
            });
            return prev.slice(0, -1);
        });
    }, [canEditSlip]);

    const handleClear = useCallback(() => {
        if (!canEditSlip) return;
        haptic.tap();
        setBets({});
        setPlacements([]);
    }, [canEditSlip]);

    const handleRebet = useCallback(() => {
        if (!canEditSlip) return;
        const total = sumBets(lastBets);
        if (total <= 0) return;
        if (total > balance) {
            flash("Not enough balance to repeat last bet");
            return;
        }
        haptic.impact("light");
        setBets({ ...lastBets });
        setPlacements(toList(lastBets));
        setOpen(true);
    }, [canEditSlip, lastBets, balance, flash]);

    // -------- Submit --------
    const handleConfirmBet = useCallback(() => {
        if (phase !== 0) return;
        if (submitted || submitting) return;

        const amount = sumBets(bets);
        if (amount <= 0) return;

        let s: Socket;
        try {
            s = getSocket();
        } catch {
            flash("Not connected");
            return;
        }

        setSubmitting(true);
        s.emit("roulette:bet", { bets }, (res: any) => {
            setSubmitting(false);
            if (res?.error) {
                autoSubmittedRef.current = false;
                flash(res.error);
                return;
            }
            setSubmitted(true);
            setLastBets(bets);
            // stake is deducted server-side → push the new wallet into Redux
            applyWallet(res?.wallet);
            haptic.notify("success");
            setOpen(false);
        });
    }, [phase, submitted, submitting, bets, flash, applyWallet]);

    // -------- Auto-submit near the end of the betting phase --------
    useEffect(() => {
        if (phase !== 0) return;
        if (submitted || submitting) return;
        if (autoSubmittedRef.current) return;
        if (sumBets(bets) <= 0) return;
        if (msLeft > AUTOSUBMIT_AT_MS) return;

        autoSubmittedRef.current = true;
        handleConfirmBet();
    }, [phase, submitted, submitting, bets, msLeft, handleConfirmBet]);

    // -------- Chip selection (inline in the table popup) --------
    const handleChipSelect = useCallback((v: number) => {
        haptic.tap();
        setChip(v);
    }, []);

    // -------- UI labels --------
    const timerProgress =
        phase === 0
            ? Math.max(0, Math.min(100, (msLeft / BETTING_MS) * 100))
            : 0;

    const statusLabel = (() => {
        if (phase === 0) return `${secondsLeft}s`;
        if (phase === 1) return submitted ? "Spinning · bet in" : "Spinning…";
        if (phase === 2) return `Next · ${secondsLeft}s`;
        return "";
    })();

    // never show the outcome before the wheel result phase
    const result = phase === 2 ? myResult : null;
    const winningPocket = winning;

    // ============================================================
    // Render
    // ============================================================
    return (
        <div
            id="roulette"
            className="game_container relative mx-auto flex w-full max-w-md flex-col overflow-hidden bg-background"
            style={{
                height: "var(--tg-viewport-stable-height, 100dvh)",
                paddingTop: "var(--tg-content-safe-area-inset-top, 0px)",
                WebkitTapHighlightColor: "transparent",
                touchAction: "manipulation",
                userSelect: "none",
                WebkitUserSelect: "none",
            }}
        >
            {/* ============ COMPACT HEADER ============ */}
            <div className="mx-2 mt-2 rounded-xl bg-gradient-to-br from-primary via-primary to-primary/85 px-2.5 py-2 text-primary-foreground shadow-sm">
                <div className="flex items-center justify-between gap-2">
                    <div className="flex min-w-0 items-center gap-1.5">
                        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-primary-foreground/15 text-sm">
                            🎰
                        </div>
                        <div className="min-w-0">
                            <h1 className="truncate text-[11px] font-black uppercase leading-none tracking-wider">
                                Roulette
                            </h1>
                            <p className="truncate text-[8px] font-medium uppercase tracking-widest text-primary-foreground/70">
                                R#{roundNumber} · {statusLabel}
                            </p>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-[8px] uppercase tracking-wider text-primary-foreground/70">
                            Balance
                        </div>
                        <div className="text-[12px] font-bold leading-tight tabular-nums">
                            {displayBalance.toFixed(2)}
                        </div>
                    </div>
                </div>

                <div className="mt-1.5 grid grid-cols-2 gap-1">
                    <div className="rounded-md bg-primary-foreground/10 px-1 py-1 text-center backdrop-blur-sm">
                        <div className="text-[7px] uppercase tracking-wider text-primary-foreground/70">
                            Bet
                        </div>
                        <p className="text-[10px] font-bold leading-none tabular-nums">
                            {submitted ? (myResult?.staked ?? staked) : staked}
                        </p>
                    </div>
                    <div className="rounded-md bg-primary-foreground/10 px-1 py-1 text-center backdrop-blur-sm">
                        <div className="text-[7px] uppercase tracking-wider text-primary-foreground/70">
                            {phase === 0 ? "Bets close" : "Result"}
                        </div>
                        <p className="text-[10px] font-bold leading-none tabular-nums">
                            {phase === 0
                                ? `${secondsLeft}s`
                                : result
                                    ? result.staked === 0
                                        ? "—"
                                        : result.net > 0
                                            ? `+${result.net}`
                                            : `${result.net}`
                                    : "—"}
                        </p>
                    </div>
                </div>
            </div>

            {/* ============ COUNTDOWN BAR ============ */}
            <div className="mx-2 mt-1.5 h-1 overflow-hidden rounded-full bg-muted">
                <div
                    className={`h-full rounded-full transition-[width] duration-300 ease-linear ${phase === 0
                        ? secondsLeft <= 5
                            ? "bg-rose-500"
                            : secondsLeft <= 8
                                ? "bg-amber-500"
                                : "bg-primary"
                        : phase === 1
                            ? "animate-pulse bg-primary/60"
                            : "bg-emerald-500"
                        }`}
                    style={{ width: `${phase === 0 ? timerProgress : 100}%` }}
                />
            </div>

            {/* ============ WHEEL ============ */}
            <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden px-2 py-2">
                <RouletteGame
                    tableType={tableType}
                    width={width}
                    spin={spin}
                    onSpinEnd={handleSpinEnd}
                />
            </div>

            {/* ============ RESULT BANNER ============ */}
            {phase === 2 && winningPocket && (
                <div className="mx-2 mb-2 animate-in fade-in slide-in-from-bottom-2">
                    <div
                        className={`rounded-xl border px-2.5 py-2 ${!result || result.staked === 0
                            ? "border-border/60 bg-muted/40"
                            : result.net > 0
                                ? "border-emerald-500/30 bg-emerald-500/10"
                                : "border-rose-500/30 bg-rose-500/10"
                            }`}
                    >
                        <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <div
                                    className={`flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-black text-white ${pocketBg(winningPocket.color)}`}
                                >
                                    {winningPocket.nr}
                                </div>
                                <div>
                                    <p className="text-[8px] uppercase tracking-widest text-muted-foreground">
                                        {winningPocket.color}
                                    </p>
                                    {!result || result.staked === 0 ? (
                                        <p className="text-[11px] font-bold text-muted-foreground">
                                            No bets
                                        </p>
                                    ) : (
                                        <p
                                            className={`text-base font-black leading-tight tabular-nums ${result.net > 0
                                                ? "text-emerald-600 dark:text-emerald-400"
                                                : "text-rose-600 dark:text-rose-400"
                                                }`}
                                        >
                                            {result.net > 0 ? "+" : ""}
                                            {result.net} ETB
                                        </p>
                                    )}
                                </div>
                            </div>
                            {result && result.staked > 0 && (
                                <div className="text-right text-[9px] text-muted-foreground">
                                    <p>
                                        Staked{" "}
                                        <span className="tabular-nums text-foreground">
                                            {result.staked}
                                        </span>
                                    </p>
                                    <p>
                                        Returned{" "}
                                        <span className="tabular-nums text-foreground">
                                            {result.returned}
                                        </span>
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ============ RECENT ============ */}
            {recent.length > 0 && (
                <div className="mx-2 mb-1.5 flex gap-1 overflow-x-auto pb-1">
                    {recent.slice(0, MAX_RECENT).map((p, i) => (
                        <div
                            key={`${p.nr}-${i}`}
                            className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[8px] font-bold text-white ${p.color === "red"
                                ? "border-red-700 bg-red-600"
                                : p.color === "black"
                                    ? "border-neutral-800 bg-neutral-900"
                                    : "border-green-700 bg-green-600"
                                }`}
                        >
                            {p.nr}
                        </div>
                    ))}
                </div>
            )}

            {/* ============ BOTTOM BAR ============ */}
            <div
                className="shrink-0 border-t border-border/60 bg-card/95 backdrop-blur-md"
                style={{
                    paddingBottom:
                        "max(0.5rem, var(--tg-safe-area-inset-bottom, 0px), env(safe-area-inset-bottom))",
                }}
            >
                <div className="mx-auto flex w-full max-w-md items-center gap-1.5 px-2.5 pt-2">
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Undo"
                        onClick={handleUndo}
                        disabled={!canEditSlip || placements.length === 0}
                        className="h-10 w-9 shrink-0 rounded-xl"
                    >
                        <Undo2 className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        aria-label="Rebet"
                        onClick={handleRebet}
                        disabled={!canEditSlip || sumBets(lastBets) <= 0}
                        className="h-10 w-9 shrink-0 rounded-xl"
                    >
                        <Repeat className="h-3.5 w-3.5" />
                    </Button>

                    <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setOpen(true)}
                        disabled={!canEditSlip}
                        className="h-10 flex-1 rounded-xl text-[10px] font-bold uppercase tracking-widest shadow-sm"
                    >
                        {submitted ? (
                            <>
                                <Check className="mr-1.5 h-3.5 w-3.5" />
                                Bet placed
                            </>
                        ) : (
                            <>
                                <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
                                {staked > 0 ? `Table · ${staked}` : "Open table"}
                            </>
                        )}
                    </Button>
                </div>

                <div className="mx-auto flex w-full max-w-md items-center justify-between px-3 pt-1 text-[9px] text-muted-foreground">
                    <span>
                        Spots:{" "}
                        <span className="font-bold text-foreground">
                            {Object.keys(bets).length}
                        </span>
                    </span>
                    <span>
                        Best:{" "}
                        <span className="font-bold tabular-nums text-emerald-500">
                            {potentialWin.toFixed(0)} ETB
                        </span>
                    </span>
                    {canEditSlip && staked > 0 && (
                        <span className="font-medium text-amber-500">
                            Auto-submits at {Math.max(0, secondsLeft - 2)}s
                        </span>
                    )}
                </div>
            </div>

            {/* ============ TABLE POPUP (chips + numbers in one place) ============ */}
            <TablePopup
                open={open && canEditSlip}
                disabled={!canEditSlip}
                submitting={submitting}
                tableType={tableType}
                balance={displayBalance}
                chip={chip}
                chips={CHIPS}
                secondsLeft={secondsLeft}
                images={images}
                tokenImages={tokenImages}
                width={width}
                bets={bets}
                canUndo={placements.length > 0}
                onChipSelect={handleChipSelect}
                onSpotClick={handleSpotClick}
                onUndo={handleUndo}
                onClear={handleClear}
                onConfirm={handleConfirmBet}
                onClose={() => setOpen(false)}
            />

            {/* ============ TOAST ============ */}
            {notice && (
                <div
                    className="pointer-events-none fixed inset-x-0 z-[90] mx-auto flex max-w-xs justify-center px-4"
                    style={{ top: "calc(var(--tg-content-safe-area-inset-top, 0px) + 0.5rem)" }}
                >
                    <div className="rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-[10px] font-medium text-rose-600 backdrop-blur-sm dark:text-rose-400">
                        {notice}
                    </div>
                </div>
            )}
        </div>
    );
}