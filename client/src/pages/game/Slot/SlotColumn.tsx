/*eslint-disable*/
import React, { useMemo } from "react"

interface SlotColumnProps {
    symbols: string[]
    isSpinning: boolean
    position: number
    winningLines?: string[]
}

const SYMBOL_OPTIONS = [
    "red",
    "blue",
    "green",
    "yin_yang",
    "hakkero",
    "yellow",
    "wild",
]

// Hoisted outside the component -- this never changes, so there's no
// reason to allocate a new object for it on every render.
const SYMBOL_IMAGES: Record<string, string> = {
    red: "/images/slot/red.webp",
    blue: "/images/slot/shangai.webp",
    green: "/images/slot/lily.webp",
    yin_yang: "/images/slot/yin.webp",
    hakkero: "/images/slot/hakkero.webp",
    yellow: "/images/slot/green.webp",
    wild: "/images/slot/wild.webp",
}

// Row-height duration + easing per column, tuned for a smoother,
// slightly more "settled" stop than a plain linear-ish cubic-bezier.
// ease-out-expo-ish curve: fast start, long smooth deceleration.
const SPIN_TRANSITIONS = [
    "transform 2s cubic-bezier(0.16, 1, 0.3, 1)",
    "transform 2.4s cubic-bezier(0.16, 1, 0.3, 1)",
    "transform 2.8s cubic-bezier(0.16, 1, 0.3, 1)",
]

const makeFillers = () =>
    Array.from(
        { length: 47 },
        () => SYMBOL_OPTIONS[Math.floor(Math.random() * SYMBOL_OPTIONS.length)]
    )

// Which of Horizontal 1/2/3 corresponds to this column's 3 final rows
// (indices 47, 48, 49 in the roulette strip).
const ROW_LINE_NAMES = ["Horizontal 1", "Horizontal 2", "Horizontal 3"]

const SlotColumn: React.FC<SlotColumnProps> = ({
    symbols,
    isSpinning,
    position,
    winningLines,
}) => {
    /*
     * ONE responsive row size.
     *
     * Telegram Mini App:
     * - very small screens -> ~58px
     * - normal mobile -> scales with width
     * - larger screens -> max 78px
     */
    const rowSize = "clamp(58px, 19vw, 78px)"

    const fillers = useMemo(() => makeFillers(), [])

    const rouletteItems = useMemo(
        () => [
            ...fillers,
            symbols[0],
            symbols[1],
            symbols[2],
        ],
        [fillers, symbols]
    )

    /*
     * Only 3 items (indices 47/48/49) can ever be "winning" -- compute
     * that once per (winningLines, position) change instead of running
     * a nested-loop function against all 50 rendered rows every render.
     */
    const winningRows = useMemo<[boolean, boolean, boolean]>(() => {
        const lines = winningLines ?? []
        const hasDiagonal1 = lines.includes("Diagonal 1")
        const hasDiagonal2 = lines.includes("Diagonal 2")

        return [0, 1, 2].map((row) => {
            if (lines.includes(ROW_LINE_NAMES[row])) return true

            // Diagonal 1: top-left -> bottom-right (col0/row0, col1/row1, col2/row2)
            if (hasDiagonal1 && position === row) return true

            // Diagonal 2: top-right -> bottom-left (col2/row0, col1/row1, col0/row2)
            if (hasDiagonal2 && position === 2 - row) return true

            return false
        }) as [boolean, boolean, boolean]
    }, [winningLines, position])

    const spinStyle = useMemo(
        () =>
            isSpinning
                ? {
                    transform: "translateY(calc(-47 * var(--slot-row)))",
                    transition: SPIN_TRANSITIONS[position] ?? SPIN_TRANSITIONS[0],
                }
                : {
                    transform: "translateY(0)",
                    transition: "transform 0.3s ease-out",
                },
        [isSpinning, position],
    )

    return (
        <div
            className="
        relative
        w-full
        overflow-hidden
      "
            style={
                {
                    "--slot-row": rowSize,
                    height: "calc(var(--slot-row) * 3)",
                } as React.CSSProperties
            }
        >
            {/* REEL */}
            <div
                className="
          w-full
          will-change-transform
        "
                style={spinStyle}
            >
                {rouletteItems.map((symbol, index) => {
                    const finalRow = index - 47
                    const winning = finalRow >= 0 && winningRows[finalRow]

                    return (
                        <div
                            key={`${symbol}-${index}`}
                            className={`
                relative
                flex
                w-full
                items-center
                justify-center
                p-1
                ${winning ? "animate-winner" : ""}
              `}
                            style={{
                                height: "var(--slot-row)",
                            }}
                        >
                            <div
                                className={`
                  relative
                  flex
                  h-full
                  w-full
                  items-center
                  justify-center
                  ${winning ? "winner-item" : ""}
                `}
                            >
                                <img
                                    src={SYMBOL_IMAGES[symbol]}
                                    alt={symbol}
                                    draggable={false}
                                    loading="eager"
                                    className="
                    relative
                    z-10
                    h-full
                    w-full
                    object-contain
                  "
                                />

                                {/* WIN TREATMENT -- the connecting line itself is
                    drawn once at the Game level (WinLinesOverlay); this is
                    what makes the individual symbol itself read as "the
                    thing that won": a soft glow behind it, a gold ring
                    frame around it, and a one-shot light sweep across it. */}
                                {winning && !isSpinning && (
                                    <>
                                        {/* soft glow behind the symbol */}
                                        <div
                                            className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center"
                                            style={{
                                                boxShadow: "0 0 24px 10px rgba(255, 204, 0, 0.35)",
                                                borderRadius: "9999px",
                                            }}
                                        />

                                        {/* gold ring frame directly around the image */}
                                        <div
                                            className="win-ring pointer-events-none absolute inset-[6%] z-20 rounded-xl"
                                        />

                                        {/* one-shot shine sweep -- keyed on "winning" so it
                                            remounts (and replays) every time this cell
                                            transitions into a win, instead of only once
                                            ever per mount */}
                                        <div
                                            key={`shine-${symbol}-${index}`}
                                            className="win-shine pointer-events-none absolute inset-0 z-30 overflow-hidden rounded-xl"
                                        >
                                            <div className="win-shine-bar" />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    )
                })}
            </div>

            <style>{`
        @keyframes animate-winner {
          0% {
            transform: scale(1);
          }

          100% {
            transform: scale(1.05);
          }
        }

        .winner-item {
          animation:
            animate-winner
            0.8s
            infinite
            alternate;
        }

        .win-ring {
          box-shadow:
            0 0 0 2px rgba(255, 211, 77, 0.9),
            0 0 14px 2px rgba(255, 211, 77, 0.55);
          animation: win-ring-pulse 1s ease-in-out infinite alternate;
        }

        @keyframes win-ring-pulse {
          0% {
            opacity: 0.65;
          }
          100% {
            opacity: 1;
          }
        }

        .win-shine-bar {
          position: absolute;
          top: -40%;
          left: -60%;
          width: 40%;
          height: 180%;
          background: linear-gradient(
            75deg,
            rgba(255, 255, 255, 0) 0%,
            rgba(255, 255, 255, 0.85) 50%,
            rgba(255, 255, 255, 0) 100%
          );
          transform: translateX(-20%) rotate(8deg);
          animation: win-shine-sweep 1.1s ease-out 0.05s 1;
        }

        @keyframes win-shine-sweep {
          from {
            transform: translateX(-20%) rotate(8deg);
          }
          to {
            transform: translateX(420%) rotate(8deg);
          }
        }
      `}</style>
        </div>
    )
}

export default React.memo(SlotColumn)