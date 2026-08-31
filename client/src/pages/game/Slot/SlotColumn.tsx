/*eslint-disable*/
import { useMemo } from "react"

interface SlotColumnProps {
    symbols: string[]
    isSpinning: boolean
    position: number
    winningLines?: any[]
}

const options = [
    "red",
    "blue",
    "green",
    "yin_yang",
    "hakkero",
    "yellow",
    "wild",
]

const makeFillers = () =>
    Array.from(
        { length: 47 },
        () => options[Math.floor(Math.random() * options.length)]
    )

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

    const getSymbolImage = (symbol: string) => {
        const images: Record<string, string> = {
            red: "/images/slot/red.webp",
            blue: "/images/slot/shangai.webp",
            green: "/images/slot/lily.webp",
            yin_yang: "/images/slot/yin.webp",
            hakkero: "/images/slot/hakkero.webp",
            yellow: "/images/slot/green.webp",
            wild: "/images/slot/wild.webp",
        }

        return images[symbol]
    }

    /*
     * Final symbols are indexes:
     *
     * 47 = row 1
     * 48 = row 2
     * 49 = row 3
     *
     * We move the reel by 47 rows.
     *
     * Using CSS variable instead of fixed pixels
     * keeps it responsive on Telegram.
     */
    const spinStyle = isSpinning
        ? {
            transform: "translateY(calc(-47 * var(--slot-row)))",
            transition: `
          transform
          ${position === 0
                    ? "2s"
                    : position === 1
                        ? "2.4s"
                        : "2.8s"}
          cubic-bezier(0.1, 0, 0.2, 1)
        `,
        }
        : {
            transform: "translateY(0)",
            transition: "transform 0.3s ease-out",
        }

    const isWinningSymbol = (index: number) => {
        if (index < 47) return false

        for (const line of winningLines ?? []) {
            if (line.startsWith("Horizontal")) {
                if (line.endsWith("1") && index === 47) return true
                if (line.endsWith("2") && index === 48) return true
                if (line.endsWith("3") && index === 49) return true
            }

            if (line.startsWith("Diagonal")) {
                if (
                    line.endsWith("1") &&
                    position === 0 &&
                    index === 47
                ) {
                    return true
                }

                if (
                    line.endsWith("1") &&
                    position === 2 &&
                    index === 49
                ) {
                    return true
                }

                if (position === 1 && index === 48) {
                    return true
                }

                if (
                    line.endsWith("2") &&
                    position === 0 &&
                    index === 49
                ) {
                    return true
                }

                if (
                    line.endsWith("2") &&
                    position === 2 &&
                    index === 47
                ) {
                    return true
                }
            }
        }

        return false
    }

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
                    const winning = isWinningSymbol(index)

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
                                    src={getSymbolImage(symbol)}
                                    alt={symbol}
                                    draggable={false}
                                    className="
                    relative
                    z-10
                    h-full
                    w-full
                    object-contain
                  "
                                />

                                {/* WIN EFFECT */}
                                {winning && !isSpinning && (
                                    <div className="absolute inset-0 z-0 flex items-center justify-center">

                                        {/* Glow */}
                                        <div
                                            className="
                        absolute
                        h-1
                        w-1
                        rounded-full
                      "
                                            style={{
                                                boxShadow:
                                                    "0 0 30px 24px #FFCC00",
                                            }}
                                        />

                                        {/* Winning lines */}
                                        {winningLines?.map(
                                            (line, lineIndex) => {
                                                const rotations: string[] = []

                                                /*
                                                 * HORIZONTAL
                                                 */
                                                if (
                                                    line.startsWith("Horizontal") &&
                                                    (
                                                        (line.endsWith("1") &&
                                                            index === 47) ||
                                                        (line.endsWith("2") &&
                                                            index === 48) ||
                                                        (line.endsWith("3") &&
                                                            index === 49)
                                                    )
                                                ) {
                                                    rotations.push("rotate(0deg)")
                                                }

                                                /*
                                                 * DIAGONAL
                                                 */
                                                if (line.startsWith("Diagonal")) {
                                                    if (
                                                        (
                                                            line.endsWith("1") &&
                                                            position === 0 &&
                                                            index === 47
                                                        ) ||
                                                        (
                                                            line.endsWith("1") &&
                                                            position === 2 &&
                                                            index === 49
                                                        )
                                                    ) {
                                                        rotations.push("rotate(45deg)")
                                                    }

                                                    else if (
                                                        (
                                                            line.endsWith("2") &&
                                                            position === 0 &&
                                                            index === 49
                                                        ) ||
                                                        (
                                                            line.endsWith("2") &&
                                                            position === 2 &&
                                                            index === 47
                                                        )
                                                    ) {
                                                        rotations.push("rotate(-45deg)")
                                                    }

                                                    else if (
                                                        position === 1 &&
                                                        index === 48
                                                    ) {
                                                        if (
                                                            winningLines.includes(
                                                                "Diagonal 1"
                                                            ) &&
                                                            winningLines.includes(
                                                                "Diagonal 2"
                                                            )
                                                        ) {
                                                            rotations.push(
                                                                "rotate(45deg)",
                                                                "rotate(-45deg)"
                                                            )
                                                        }

                                                        else if (
                                                            winningLines.includes(
                                                                "Diagonal 1"
                                                            )
                                                        ) {
                                                            rotations.push(
                                                                "rotate(45deg)"
                                                            )
                                                        }

                                                        else if (
                                                            winningLines.includes(
                                                                "Diagonal 2"
                                                            )
                                                        ) {
                                                            rotations.push(
                                                                "rotate(-45deg)"
                                                            )
                                                        }
                                                    }
                                                }

                                                return rotations.map(
                                                    (rotation, i) => (
                                                        <div
                                                            key={`${lineIndex}-${i}`}
                                                            className="
                                absolute
                                z-0
                                h-1
                                w-[200%]
                                bg-unique
                              "
                                                            style={{
                                                                transform: rotation,
                                                            }}
                                                        />
                                                    )
                                                )
                                            }
                                        )}
                                    </div>
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
      `}</style>
        </div>
    )
}

export default SlotColumn