/* eslint-disable */

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import CrashGraph from "./CrashGraph";

interface GameHistoryItem {
    crashPoint: number | null;
}

interface GameContainerProps {
    crashPoint: number | null;
    multiplier: number;
    gameStarted: boolean;
    gameEnded: boolean;
    countDown: number;
    up: string;
    idle: string;
    falling: string;
    history: GameHistoryItem[];
}

const BETTING_COUNTDOWN_S = 12;

/* ============================================================
   COLOR TIERS
   Plain functions, not hooks -- cheap enough to call inline,
   no need to memoize the call itself.
============================================================ */

function liveMultiplierClass(value: number): string {
    if (value < 2) return "text-white drop-shadow-[0_2px_12px_rgba(255,255,255,0.18)]";
    if (value < 5) return "text-amber-300 drop-shadow-[0_2px_16px_rgba(252,211,77,0.35)]";
    if (value < 15) return "text-orange-400 drop-shadow-[0_2px_18px_rgba(251,146,60,0.4)]";
    return "text-rose-400 drop-shadow-[0_2px_20px_rgba(251,113,133,0.45)]";
}

function historyChipClass(value: number): string {
    if (value < 2) return "bg-sky-500/15 text-sky-400";
    if (value < 10) return "bg-violet-500/15 text-violet-400";
    return "bg-pink-500/15 text-pink-400";
}

/* ============================================================
   MULTIPLIER READOUT
   The one piece of UI that genuinely must update ~10x/sec while
   a round is running. Isolated so ticking it doesn't force React
   to re-diff the countdown ring, history strip, or graph.
============================================================ */

interface MultiplierReadoutProps {
    multiplier: number;
    gameStarted: boolean;
    gameEnded: boolean;
    crashPoint: number | null;
}

const MultiplierReadout = React.memo<MultiplierReadoutProps>(
    ({ multiplier, gameStarted, gameEnded, crashPoint }) => {
        if (gameEnded) {
            return (
                <motion.div
                    initial={{ scale: 0.85, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="flex flex-col items-center"
                >
                    <span className="text-4xl font-black tracking-tight text-rose-500 drop-shadow-[0_2px_14px_rgba(244,63,94,0.4)] sm:text-5xl">
                        {crashPoint?.toFixed(2) ?? "0.00"}x
                    </span>
                    <span className="mt-1 text-[9px] font-bold uppercase tracking-[0.25em] text-white/40">
                        Flew away
                    </span>
                </motion.div>
            );
        }

        // No per-tick remount here (no `key={multiplier}`): a full
        // enter/exit animation on every single 100ms tick is wasted
        // GPU/JS work at scale. A plain text node with a CSS color
        // transition is far cheaper and still feels alive.
        return (
            <span
                className={`text-4xl font-black tracking-tight transition-colors duration-150 sm:text-5xl ${gameStarted ? liveMultiplierClass(multiplier) : "text-white/30"
                    }`}
            >
                {multiplier.toFixed(2)}x
            </span>
        );
    },
);

MultiplierReadout.displayName = "MultiplierReadout";

/* ============================================================
   COUNTDOWN RING
   Only re-renders when countDown/gameEnded actually change.
============================================================ */

interface CountdownRingProps {
    countDown: number;
    gameEnded: boolean;
}

const RING_SIZE = 168;
const RING_STROKE = 3;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

const CountdownRing = React.memo<CountdownRingProps>(
    ({ countDown, gameEnded }) => {
        const progress = useMemo(() => {
            if (!gameEnded) return 0;
            return Math.min(1, Math.max(0, countDown / BETTING_COUNTDOWN_S));
        }, [countDown, gameEnded]);

        if (!gameEnded) return null;

        const urgent = countDown <= 3;

        return (
            <svg
                width={RING_SIZE}
                height={RING_SIZE}
                viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
                className={`pointer-events-none absolute z-[5] -rotate-90 transition-opacity duration-200 ${urgent ? "opacity-90" : "opacity-60"
                    }`}
            >
                <circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_RADIUS}
                    fill="none"
                    stroke="rgba(255,255,255,0.08)"
                    strokeWidth={RING_STROKE}
                />
                <circle
                    cx={RING_SIZE / 2}
                    cy={RING_SIZE / 2}
                    r={RING_RADIUS}
                    fill="none"
                    stroke={urgent ? "#fb7185" : "#f5b83d"}
                    strokeWidth={RING_STROKE}
                    strokeLinecap="round"
                    strokeDasharray={RING_CIRCUMFERENCE}
                    strokeDashoffset={RING_CIRCUMFERENCE * (1 - progress)}
                    style={{ transition: "stroke-dashoffset 100ms linear, stroke 200ms ease" }}
                />
            </svg>
        );
    },
);

CountdownRing.displayName = "CountdownRing";

/* ============================================================
   NEXT-ROUND LABEL
============================================================ */

const NextRoundLabel = React.memo<{ countDown: number }>(({ countDown }) => (
    <div className="absolute left-2 top-2 z-20">
        <div className="rounded-md bg-black/45 px-2 py-1 text-[10px] font-medium text-white/70 backdrop-blur-sm">
            Next round{" "}
            <span className="font-bold text-white">
                {Math.max(0, countDown).toFixed(1)}s
            </span>
        </div>
    </div>
));

NextRoundLabel.displayName = "NextRoundLabel";

/* ============================================================
   HISTORY STRIP
   Only re-renders when the history array reference changes,
   i.e. once per crash -- not once per tick.
============================================================ */

const HistoryStrip = React.memo<{ history: GameHistoryItem[] }>(
    ({ history }) => {
        const visibleHistory = useMemo(() => history.slice(-8), [history]);

        return (
            <div className="w-full px-2 pb-1 pt-2">
                <div className="flex w-full items-center justify-between rounded-lg bg-[#191923] px-2.5 py-2">
                    <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-white/45">
                        History
                    </span>

                    <div className="ml-2 flex min-w-0 flex-1 items-center justify-end gap-1.5 overflow-hidden">
                        {visibleHistory.map((entry, index) => {
                            const value = entry.crashPoint ?? 0;
                            const isLatest = index === visibleHistory.length - 1;

                            return (
                                <motion.div
                                    key={`${value}-${index}`}
                                    initial={
                                        isLatest
                                            ? { opacity: 0, scale: 0.7, x: 10 }
                                            : { opacity: 1, scale: 1, x: 0 }
                                    }
                                    animate={{ opacity: 1, scale: 1, x: 0 }}
                                    transition={{ duration: 0.25, ease: "easeOut" }}
                                    className={`flex h-[22px] min-w-[38px] items-center justify-center rounded-md px-1.5 text-[9px] font-bold ${historyChipClass(
                                        value,
                                    )}`}
                                >
                                    {value.toFixed(2)}x
                                </motion.div>
                            );
                        })}
                    </div>
                </div>
            </div>
        );
    },
);

HistoryStrip.displayName = "HistoryStrip";

/* ============================================================
   MAIN CONTAINER
============================================================ */

const GameContainer: React.FC<GameContainerProps> = ({
    crashPoint,
    multiplier,
    gameStarted,
    gameEnded,
    countDown,
    up,
    idle,
    falling,
    history,
}) => {
    return (
        <div className="w-full min-w-0 overflow-hidden bg-gradient-to-b from-[#14141f] to-[#0d0d15] text-white">
            {/* =========================
          GAME AREA
      ========================== */}
            <div className="w-full px-2 pt-2">
                <div className="relative w-full overflow-hidden rounded-xl border border-white/5 bg-[#171720] shadow-[inset_0_0_60px_rgba(245,184,61,0.03)]">
                    {/* =========================
              GRAPH
          ========================== */}
                    <div className="relative aspect-[1.55/1] max-h-[360px] min-h-[230px] w-full overflow-hidden bg-[#14141c]">
                        <CrashGraph
                            gameStarted={gameStarted}
                            gameEnded={gameEnded}
                            multiplier={multiplier}
                            crashPoint={crashPoint}
                            up={up}
                            idle={idle}
                            falling={falling}
                        />

                        {/* Ambient engine-glow gradient, purely decorative */}
                        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_60%,rgba(245,184,61,0.06),transparent_60%)]" />
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/25 to-transparent" />

                        {gameEnded && <NextRoundLabel countDown={countDown} />}

                        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center">
                            <CountdownRing countDown={countDown} gameEnded={gameEnded} />
                            <MultiplierReadout
                                multiplier={multiplier}
                                gameStarted={gameStarted}
                                gameEnded={gameEnded}
                                crashPoint={crashPoint}
                            />
                        </div>
                    </div>

                    {/* =========================
              BETTING PROGRESS (thin accent line, ring above carries
              the primary countdown affordance now)
          ========================== */}
                    <div className="h-[3px] w-full bg-black/30">
                        <motion.div
                            className="h-full bg-gradient-to-r from-amber-400 to-rose-400"
                            animate={{
                                width: gameEnded
                                    ? `${Math.min(
                                        Math.max((countDown / BETTING_COUNTDOWN_S) * 100, 0),
                                        100,
                                    )}%`
                                    : "0%",
                            }}
                            transition={{ duration: 0.1, ease: "linear" }}
                        />
                    </div>
                </div>
            </div>

            <HistoryStrip history={history} />
        </div>
    );
};

export default React.memo(GameContainer);