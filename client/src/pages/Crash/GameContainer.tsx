/* eslint-disable */

import { motion } from "framer-motion";
import CrashGraph from "./CrashGraph";
import { type Key } from "react";

interface GameHistory {
    crashPoint: number | null;
    multiplier: number;
    gameStarted: boolean;
    gameEnded: boolean;
    countDown: number;
    up: string;
    idle: string;
    falling: string;
    history: any[];
}

const BETTING_COUNTDOWN_S = 10.7;

const GameContainer: React.FC<GameHistory> = ({
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
        <div className="w-full min-w-0 overflow-hidden bg-[#12121a] text-white">

            {/* =========================
          GAME AREA
      ========================== */}
            <div className="w-full px-2 pt-2">

                <div
                    className="
            relative
            w-full
            overflow-hidden
            rounded-xl
            border border-white/5
            bg-[#191923]
          "
                >
                    {/* Graph */}
                    <div
                        className="
              relative
              w-full
              aspect-[1.55/1]
              min-h-[230px]
              max-h-[360px]
              overflow-hidden
              bg-[#171720]
            "
                    >
                        <CrashGraph
                            gameStarted={gameStarted}
                            gameEnded={gameEnded}
                            multiplier={multiplier}
                            crashPoint={crashPoint}
                            up={up}
                            idle={idle}
                            falling={falling}
                        />

                        {/* subtle top gradient */}
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/20 to-transparent" />

                        {/* =========================
                COUNTDOWN
            ========================== */}
                        {gameEnded && (
                            <div className="absolute left-2 top-2 z-20">
                                <div
                                    className="
                    rounded-md
                    bg-black/45
                    px-2 py-1
                    text-[10px]
                    font-medium
                    text-white/70
                    backdrop-blur-sm
                  "
                                >
                                    Next game in{" "}
                                    <span className="font-bold text-white">
                                        {countDown.toFixed(1)}s
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* =========================
                MULTIPLIER
            ========================== */}
                        <div
                            className="
                pointer-events-none
                absolute
                inset-0
                z-10
                flex
                items-center
                justify-center
              "
                        >
                            {gameEnded ? (
                                <motion.div
                                    initial={{ scale: 0.8, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    className="flex flex-col items-center"
                                >
                                    <span
                                        className="
                      text-4xl
                      font-black
                      tracking-tight
                      text-red-500
                      drop-shadow-[0_2px_10px_rgba(239,68,68,0.35)]
                      sm:text-5xl
                    "
                                    >
                                        {crashPoint?.toFixed(2)}x
                                    </span>

                                    <span
                                        className="
                      mt-0.5
                      text-[9px]
                      font-bold
                      uppercase
                      tracking-[0.2em]
                      text-white/45
                    "
                                    >
                                        Crashed
                                    </span>
                                </motion.div>
                            ) : (
                                <motion.span
                                    key={multiplier}
                                    className={`
                    text-4xl
                    font-black
                    tracking-tight
                    drop-shadow-[0_2px_12px_rgba(255,255,255,0.15)]
                    sm:text-5xl
                    ${gameStarted
                                            ? "text-white"
                                            : "text-white/35"
                                        }
                  `}
                                >
                                    {multiplier.toFixed(2)}x
                                </motion.span>
                            )}
                        </div>
                    </div>

                    {/* =========================
              BETTING PROGRESS
          ========================== */}
                    <div className="h-1 w-full bg-black/30">
                        <motion.div
                            className="h-full bg-[#f5b83d]"
                            initial={{ width: "100%" }}
                            animate={{
                                width: gameEnded
                                    ? `${Math.min(
                                        (countDown / BETTING_COUNTDOWN_S) * 100,
                                        100
                                    )}%`
                                    : "0%",
                            }}
                            transition={{
                                duration: 0.1,
                                ease: "linear",
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* =========================
          GAME HISTORY
      ========================== */}
            <div className="w-full px-2 pt-2 pb-1">

                <div
                    className="
            flex
            w-full
            items-center
            justify-between
            rounded-lg
            bg-[#191923]
            px-2.5
            py-2
          "
                >
                    <span
                        className="
              shrink-0
              text-[10px]
              font-semibold
              uppercase
              tracking-wider
              text-white/45
            "
                    >
                        History
                    </span>

                    <div
                        className="
              ml-2
              flex
              min-w-0
              flex-1
              items-center
              justify-end
              gap-1.5
              overflow-hidden
            "
                    >
                        {history
                            .slice(-8)
                            .map(
                                (
                                    e: { crashPoint: number | null },
                                    i: Key
                                ) => {
                                    const value = e.crashPoint ?? 0;

                                    return (
                                        <motion.div
                                            key={i}
                                            initial={
                                                i === history.slice(-8).length - 1
                                                    ? {
                                                        opacity: 0,
                                                        scale: 0.7,
                                                        x: 10,
                                                    }
                                                    : {}
                                            }
                                            animate={{
                                                opacity: 1,
                                                scale: 1,
                                                x: 0,
                                            }}
                                            transition={{
                                                duration: 0.25,
                                                ease: "easeOut",
                                            }}
                                            className={`
                        flex
                        h-[22px]
                        min-w-[38px]
                        items-center
                        justify-center
                        rounded-md
                        px-1.5
                        text-[9px]
                        font-bold
                        ${value < 2
                                                    ? "bg-red-500/15 text-red-400"
                                                    : value < 10
                                                        ? "bg-green-500/15 text-green-400"
                                                        : "bg-yellow-500/15 text-yellow-400"
                                                }
                      `}
                                        >
                                            {value.toFixed(2)}x
                                        </motion.div>
                                    );
                                }
                            )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GameContainer;