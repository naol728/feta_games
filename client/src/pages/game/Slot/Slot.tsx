/* eslint-disable */

import { useEffect, useRef, useState } from "react";
import Game from "./Game";
import { spinSlots } from "@/service/games/GamesServices";
import { toast } from "react-toastify";
import BigWinAlert from "./BigWinAlert";
import RenderMike from "./RenderMike";
import bigwin from "/bigwin.mp3";
import ValueViewer from "./ValueViewer";
import { useSessionStats } from "@/store/slice/SessionStatesContext";
import { useAppSelector } from "@/store/hook";

export interface SlotProps {
    userId: string;
    betAmount: number;
    gridState: string[];
    lastSpinResult: any[];
    totalPayout: number;
}

const renderPlaceholder = () => {
    const options = [
        "grapes",
        "cherry",
        "bell",
        "watermelon",
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

    return Array.from(
        { length: 9 },
        () => options[Math.floor(Math.random() * options.length)]
    );
};

const Slots = () => {
    const [grid, setGrid] = useState<string[]>(renderPlaceholder());

    const [response, setResponse] =
        useState<SlotProps | null>(null);

    const [betAmount, setBetAmount] =
        useState<number>(10);

    const [isSpinning, setIsSpinning] =
        useState<boolean>(false);

    const [winningLines, setWinningLines] =
        useState<any[]>([]);

    const [totalWins, setTotalWins] =
        useState<number>(0);

    const [openBigWin, setOpenBigWin] =
        useState<boolean>(false);

    const [lostCount, setLostCount] =
        useState<number>(0);

    const [loadedImages, setLoadedImages] =
        useState<number>(0);

    const audioRef =
        useRef<HTMLAudioElement | null>(null);

    const { user } =
        useAppSelector((state) => state.auth);

    const { track } = useSessionStats();

    /*
     * BIG WIN AUDIO
     */
    const startAudio = () => {
        setTimeout(() => {
            if (audioRef.current) {
                audioRef.current.volume = 0.05;

                audioRef.current
                    .play()
                    .catch(() => {
                        // Browser may block autoplay.
                    });
            }
        }, 2800);
    };

    const pauseAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    };

    /*
     * CLOSE BIG WIN WHEN USER TAPS
     */
    const handleClick = () => {
        if (openBigWin) {
            setOpenBigWin(false);
            pauseAudio();
        }
    };

    useEffect(() => {
        window.addEventListener("click", handleClick);

        return () => {
            window.removeEventListener("click", handleClick);
        };
    }, [openBigWin]);

    /*
     * UPDATE TOTAL WINS
     */
    useEffect(() => {
        const timer = setTimeout(() => {
            setTotalWins(response?.totalPayout || 0);
        }, 3000);

        return () => clearTimeout(timer);
    }, [response]);

    /*
     * =========================
     * SPIN
     * =========================
     */
    const handleSpin = async () => {
        if (!user) {
            toast.error("User not found");
            return;
        }

        if (user.wallets.balance < betAmount) {
            toast.error("Insufficient funds");
            return;
        }

        if (isSpinning) return;

        setIsSpinning(true);
        setOpenBigWin(false);
        setTotalWins(0);

        try {
            const result = await spinSlots(betAmount);

            setResponse(result);

            /*
             * 3 × 3 RESULT
             */
            setGrid(result.gridState);

            /*
             * WINNING LINES
             */
            setWinningLines(
                result?.lastSpinResult?.map(
                    (item: { line: any }) => item.line
                ) || []
            );

            /*
             * BIG WIN
             */
            if (
                result.totalPayout >=
                betAmount * 8
            ) {
                setOpenBigWin(true);
                startAudio();
            }

            /*
             * LOSING STREAK
             */
            if (result.totalPayout === 0) {
                setLostCount((prev) => prev + 1);
            } else {
                setLostCount(0);
            }

            /*
             * REEL ANIMATION
             *
             * Keep this synchronized with Game/SlotColumn.
             */
            setTimeout(() => {
                setIsSpinning(false);

                track({
                    game: "slots",
                    wagered: betAmount,
                    payout: result.totalPayout || 0,
                });
            }, 2600);
        } catch (e: any) {
            console.error(
                e?.response?.data?.message ||
                "Error spinning slots"
            );

            toast.error(
                e?.response?.data?.message ||
                "Error spinning slots"
            );

            setIsSpinning(false);
        }
    };

    /*
     * =========================
     * BET CONTROL
     * =========================
     */
    const handleChangeBet = (
        type: "add" | "subtract"
    ) => {
        const newBetAmount =
            type === "subtract"
                ? Math.floor(betAmount / 2)
                : betAmount * 2;

        if (
            newBetAmount >= 1 &&
            newBetAmount <= 50000
        ) {
            setBetAmount(newBetAmount);
        }
    };

    /*
     * =========================
     * MIKE STATUS
     * =========================
     */
    const getCurrentMike = () => {
        if (!response) {
            return "normal";
        }

        if (openBigWin) {
            return "jackpot";
        }

        if (response.totalPayout > 0) {
            return "win";
        }

        if (lostCount >= 3) {
            return "losing";
        }

        return "normal";
    };

    return (
        <div className="flex w-full min-w-0 justify-center overflow-x-hidden">
            {openBigWin && (
                <BigWinAlert
                    value={
                        response?.totalPayout || 0
                    }
                />
            )}

            <audio
                ref={audioRef}
                src={bigwin}
                preload="auto"
            />

            {/*
             * MAIN CONTAINER
             *
             * max-width prevents the casino from becoming
             * huge on desktop while remaining fluid on mobile.
             */}
            <div
                className="
                    flex
                    w-full
                    max-w-[430px]
                    min-w-0
                    flex-col
                    items-center
                    px-1
                    pb-2
                "
            >
                {/*
                 * ==========================
                 * CHARACTER / DEALER
                 * ==========================
                 */}
                <div className="w-full">
                    <RenderMike
                        status={
                            getCurrentMike() as
                            | "normal"
                            | "win"
                            | "losing"
                            | "jackpot"
                        }
                    />
                </div>

                {/*
                 * ==========================
                 * SLOT MACHINE
                 * ==========================
                 */}
                <div className="w-full min-w-0">
                    <Game
                        grid={grid}
                        isSpinning={isSpinning}
                        data={response}
                        winningLines={winningLines}
                        loadedImages={loadedImages}
                        setLoadedImages={
                            setLoadedImages
                        }
                    />
                </div>

                {/*
                 * ==========================
                 * CONTROL PANEL
                 * ==========================
                 */}
                <div
                    className="
                        mt-1
                        flex
                        w-full
                        min-w-0
                        flex-col
                        gap-2
                        rounded-b-xl
                        border-t
                        border-red-950
                        px-2
                        py-2
                    "
                    style={{
                        background:
                            "linear-gradient(180deg,#9f1d25 0%,#74131a 100%)",

                        boxShadow:
                            "inset 0 0 35px rgba(0,0,0,.7)",
                    }}
                >
                    {/*
                     * ==========================
                     * BALANCE / BET / WIN
                     * ==========================
                     */}
                    <div
                        className="
                            grid
                            w-full
                            grid-cols-3
                            gap-1
                            sm:gap-2
                        "
                    >
                        {[
                            "balance",
                            "bet",
                            "wins",
                        ].map((type) => (
                            <div
                                key={type}
                                className="min-w-0"
                            >
                                <ValueViewer
                                    type={
                                        type as
                                        | "balance"
                                        | "bet"
                                        | "wins"
                                    }
                                    betAmount={
                                        betAmount
                                    }
                                    totalWins={
                                        totalWins
                                    }
                                />
                            </div>
                        ))}
                    </div>

                    {/*
                     * ==========================
                     * BET + SPIN CONTROLS
                     * ==========================
                     */}
                    <div
                        className="
                            flex
                            w-full
                            items-center
                            justify-center
                            gap-3
                            py-1
                            sm:gap-5
                        "
                    >
                        {/*
                         * MINUS
                         */}
                        <button
                            type="button"
                            onClick={() =>
                                handleChangeBet(
                                    "subtract"
                                )
                            }
                            disabled={
                                isSpinning ||
                                betAmount <= 1
                            }
                            aria-label="Decrease bet"
                            className="
                                flex
                                h-9
                                w-9
                                shrink-0
                                items-center
                                justify-center
                                rounded-full
                                border-2
                                border-[#ECA823]
                                bg-[#70131A]
                                text-lg
                                font-bold
                                text-white
                                shadow-md
                                transition-transform
                                active:scale-90
                                disabled:cursor-not-allowed
                                disabled:opacity-40
                                sm:h-10
                                sm:w-10
                            "
                        >
                            −
                        </button>

                        {/*
                         * SPIN BUTTON
                         */}
                        <button
                            type="button"
                            onClick={handleSpin}
                            disabled={isSpinning}
                            aria-label="Spin"
                            className="
                                flex
                                h-14
                                w-14
                                shrink-0
                                items-center
                                justify-center
                                rounded-full
                                border-[3px]
                                border-[#ECA823]
                                bg-[#20c85a]
                                text-[11px]
                                font-black
                                tracking-wide
                                text-white
                                shadow-[inset_0_0_12px_rgba(0,0,0,.65),0_3px_8px_rgba(0,0,0,.35)]
                                transition-all
                                active:scale-90
                                disabled:cursor-not-allowed
                                disabled:opacity-60
                                sm:h-16
                                sm:w-16
                            "
                        >
                            {isSpinning ? (
                                <span className="animate-pulse">
                                    ...
                                </span>
                            ) : (
                                "SPIN"
                            )}
                        </button>

                        {/*
                         * PLUS
                         */}
                        <button
                            type="button"
                            onClick={() =>
                                handleChangeBet(
                                    "add"
                                )
                            }
                            disabled={
                                isSpinning ||
                                betAmount >= 50000
                            }
                            aria-label="Increase bet"
                            className="
                                flex
                                h-9
                                w-9
                                shrink-0
                                items-center
                                justify-center
                                rounded-full
                                border-2
                                border-[#ECA823]
                                bg-[#70131A]
                                text-lg
                                font-bold
                                text-white
                                shadow-md
                                transition-transform
                                active:scale-90
                                disabled:cursor-not-allowed
                                disabled:opacity-40
                                sm:h-10
                                sm:w-10
                            "
                        >
                            +
                        </button>
                    </div>

                    {/*
                     * BET DISPLAY
                     */}
                    <div className="flex justify-center">
                        <div
                            className="
                                rounded-full
                                border
                                border-[#ECA823]/70
                                bg-black/20
                                px-3
                                py-0.5
                                text-[10px]
                                font-semibold
                                text-white/80
                            "
                        >
                            BET&nbsp;
                            {betAmount}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Slots;