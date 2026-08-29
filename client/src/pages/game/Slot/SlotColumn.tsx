/* eslint-disable */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { RotatingLines } from "react-loader-spinner";

interface SlotColumnProps {
    symbols: string[];
    isSpinning: boolean;
    position: number;
    winningLines?: string[];
}

const options = [
    "watermelon",
    "grapes",
    "cherry",
    "bell",
    "plum",
    "lemon",
    "orange",
    "bar",
    "wild",
    "major",
    "minor",
    "mini",
    "grand",
    "strike",
    "super_strike",
    "bonus",
];

const makeFillers = () =>
    Array.from(
        { length: 47 },
        () => options[Math.floor(Math.random() * options.length)]
    );

const SlotColumn: React.FC<SlotColumnProps> = ({
    symbols,
    isSpinning,
    position,
    winningLines,
}) => {
    const columnRef = useRef<HTMLDivElement | null>(null);
    const rouletteRef = useRef<HTMLDivElement | null>(null);

    const [cellSize, setCellSize] = useState(88);
    const [loading, setLoading] = useState(true);

    const [fillers] = useState<string[]>(makeFillers);

    /*
     * Responsive cell size.
     *
     * The column is approximately 1/3 of the available game width.
     * We measure the actual column instead of relying on vw so it
     * also works correctly inside Telegram's Mini App container.
     */
    const updateSize = useCallback(() => {
        if (!columnRef.current) return;

        const width = columnRef.current.getBoundingClientRect().width;

        if (width > 0) {
            // Keep a small internal gap/padding.
            const size = Math.max(58, Math.min(width, 112));
            setCellSize(size);
        }
    }, []);

    useEffect(() => {
        updateSize();

        const element = columnRef.current;

        if (!element) return;

        const observer = new ResizeObserver(updateSize);
        observer.observe(element);

        window.addEventListener("resize", updateSize);

        return () => {
            observer.disconnect();
            window.removeEventListener("resize", updateSize);
        };
    }, [updateSize]);

    /*
     * 47 filler symbols + 3 final symbols.
     *
     * We need to move exactly 47 cells so the final 3 symbols
     * arrive in the visible 3x3 area.
     */
    const rollDistance = cellSize * fillers.length;

    const rouletteItems = [
        ...fillers,
        symbols[0],
        symbols[1],
        symbols[2],
    ];

    const handleImageLoad = () => {
        setLoading(false);
    };

    const calculateAnimation = (position: number) => {
        const duration =
            position === 0
                ? 1.8
                : position === 1
                    ? 2.1
                    : 2.4;

        return `spin ${duration}s cubic-bezier(0.12, 0.8, 0.18, 1)`;
    };

    useEffect(() => {
        if (!rouletteRef.current) return;

        if (isSpinning) {
            rouletteRef.current.style.animation =
                calculateAnimation(position);

            rouletteRef.current.style.transform = "translateY(0)";
        } else {
            rouletteRef.current.style.animation = "none";

            // Move exactly 47 cells.
            rouletteRef.current.style.transform =
                `translateY(-${rollDistance}px)`;
        }
    }, [isSpinning, position, rollDistance]);

    const getSymbolImage = (symbol: string) => {
        const images: Record<string, string> = {
            watermelon: "/images/slot/chicken/watermelon.png",
            grapes: "/images/slot/chicken/grapes.png",
            cherry: "/images/slot/chicken/cherry.png",
            bell: "/images/slot/chicken/bell.png",
            plum: "/images/slot/chicken/plum.png",
            lemon: "/images/slot/chicken/lemon.png",
            orange: "/images/slot/chicken/orange.png",
            seven: "/images/slot/chicken/seven.png",
            bar: "/images/slot/chicken/bar.png",
            wild: "/images/slot/chicken/777.png",
            major: "/images/slot/chicken/major_coin.png",
            minor: "/images/slot/chicken/minor_coin.png",
            mini: "/images/slot/chicken/mini_coin.png",
            grand: "/images/slot/chicken/grand_coin.png",
            strike: "/images/slot/chicken/strike_coin.png",
            super_strike:
                "/images/slot/chicken/super_strike_coin.png",
            bonus: "/images/slot/chicken/bonus_coin.png",
        };

        return images[symbol];
    };

    const isWinningSymbol = (index: number) => {
        if (index < 47) return false;

        for (const line of winningLines ?? []) {
            /*
             * Final visible positions:
             *
             * 47 = row 1
             * 48 = row 2
             * 49 = row 3
             */

            if (line.startsWith("Horizontal")) {
                if (
                    (line.endsWith("1") && index === 47) ||
                    (line.endsWith("2") && index === 48) ||
                    (line.endsWith("3") && index === 49)
                ) {
                    return true;
                }
            }

            if (line.startsWith("Diagonal")) {
                if (
                    line.endsWith("1") &&
                    position === 0 &&
                    index === 47
                ) {
                    return true;
                }

                if (
                    line.endsWith("1") &&
                    position === 2 &&
                    index === 49
                ) {
                    return true;
                }

                if (
                    position === 1 &&
                    index === 48
                ) {
                    return true;
                }

                if (
                    line.endsWith("2") &&
                    position === 0 &&
                    index === 49
                ) {
                    return true;
                }

                if (
                    line.endsWith("2") &&
                    position === 2 &&
                    index === 47
                ) {
                    return true;
                }
            }
        }

        return false;
    };

    return (
        <div
            ref={columnRef}
            className="relative flex-1 min-w-0 overflow-hidden"
            style={{
                height: `${cellSize * 3}px`,
            }}
        >
            <div
                ref={rouletteRef}
                className="will-change-transform"
                style={{
                    width: "100%",
                    transform: `translateY(-${rollDistance}px)`,
                }}
            >
                {rouletteItems.map((symbol, index) => {
                    const winning = isWinningSymbol(index);

                    return (
                        <div
                            key={`${symbol}-${index}`}
                            className="relative flex w-full items-center justify-center"
                            style={{
                                height: `${cellSize}px`,
                                padding: `${Math.max(2, cellSize * 0.045)}px`,
                            }}
                        >
                            <div
                                className={`relative h-full w-full ${winning ? "winner-item" : ""
                                    }`}
                            >
                                {loading && (
                                    <div className="absolute inset-0 z-20 flex items-center justify-center">
                                        <RotatingLines
                                            strokeColor="grey"
                                            strokeWidth="4"
                                            animationDuration="0.75"
                                            width={`${Math.max(
                                                20,
                                                cellSize * 0.32
                                            )}px`}
                                            visible={true}
                                        />
                                    </div>
                                )}

                                <img
                                    src={getSymbolImage(symbol)}
                                    alt={symbol}
                                    draggable={false}
                                    className={`block h-full w-full select-none object-contain ${loading ? "opacity-0" : "opacity-100"
                                        }`}
                                    onLoad={handleImageLoad}
                                />

                                {winning && !isSpinning && (
                                    <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
                                        <div
                                            className="h-1 w-1 rounded-full"
                                            style={{
                                                boxShadow:
                                                    "0 0 22px 14px rgba(255,204,0,.8)",
                                            }}
                                        />

                                        {winningLines?.map(
                                            (line, lineIndex) => {
                                                const rotations: string[] = [];

                                                if (
                                                    line.startsWith(
                                                        "Horizontal"
                                                    ) &&
                                                    (
                                                        (line.endsWith("1") &&
                                                            index === 47) ||
                                                        (line.endsWith("2") &&
                                                            index === 48) ||
                                                        (line.endsWith("3") &&
                                                            index === 49)
                                                    )
                                                ) {
                                                    rotations.push(
                                                        "rotate(0deg)"
                                                    );
                                                }

                                                if (
                                                    line.startsWith(
                                                        "Diagonal"
                                                    )
                                                ) {
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
                                                        rotations.push(
                                                            "rotate(45deg)"
                                                        );
                                                    }

                                                    if (
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
                                                        rotations.push(
                                                            "rotate(-45deg)"
                                                        );
                                                    }

                                                    if (
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
                                                            );
                                                        } else if (
                                                            winningLines.includes(
                                                                "Diagonal 1"
                                                            )
                                                        ) {
                                                            rotations.push(
                                                                "rotate(45deg)"
                                                            );
                                                        } else if (
                                                            winningLines.includes(
                                                                "Diagonal 2"
                                                            )
                                                        ) {
                                                            rotations.push(
                                                                "rotate(-45deg)"
                                                            );
                                                        }
                                                    }
                                                }

                                                return rotations.map(
                                                    (
                                                        rotation,
                                                        rotationIndex
                                                    ) => (
                                                        <div
                                                            key={`${lineIndex}-${rotationIndex}`}
                                                            className="absolute left-1/2 top-1/2 h-[2px] w-[200%] -z-10"
                                                            style={{
                                                                transform:
                                                                    `translate(-50%, -50%) ${rotation}`,
                                                            }}
                                                        />
                                                    )
                                                );
                                            }
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            <style>{`
                @keyframes spin {
                    0% {
                        transform: translateY(0);
                    }

                    100% {
                        transform: translateY(
                            -${rollDistance}px
                        );
                    }
                }

                @keyframes animate-winner {
                    0% {
                        transform: scale(1);
                    }

                    100% {
                        transform: scale(1.045);
                    }
                }

                .winner-item {
                    animation: animate-winner 0.7s ease-in-out infinite alternate;
                }

                @media (prefers-reduced-motion: reduce) {
                    .winner-item {
                        animation: none;
                    }
                }
            `}</style>
        </div>
    );
};

export default SlotColumn;