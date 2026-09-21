/* eslint-disable */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Volume2, VolumeX } from "lucide-react";

import Game from "./Game";
import BigWinAlert from "./BigWinAlert";
import RenderMike from "./RenderMike";
import ValueViewer from "./ValueViewer";
import GameBar from "./../../../components/game/GameBar";
import LiveStatsButton from "./../../../components/LiveStats/LiveStatsButton";

import { useSlotAudio } from "./useSlotAudio";
import { useSlotSpin } from "./useSlotSpin";

type MikeStatus = "normal" | "win" | "losing" | "jackpot";
type ValueViewerType = "balance" | "bet" | "wins";

const LOSING_STREAK_THRESHOLD = 3;

const PLACEHOLDER_SYMBOLS = [
    "red",
    "blue",
    "green",
    "yin_yang",
    "hakkero",
    "yellow",
    "wild",
] as const;

const createPlaceholderGrid = (): string[] =>
    Array.from(
        { length: 9 },
        () =>
            PLACEHOLDER_SYMBOLS[
            Math.floor(Math.random() * PLACEHOLDER_SYMBOLS.length)
            ]
    );

const Slots = () => {
    const { soundEnabled, play, stop, toggleSound } = useSlotAudio();

    const [openBigWin, setOpenBigWin] = useState<boolean>(false);
    const [loadedImages, setLoadedImages] = useState<number>(0);

    const handleWin = useCallback(() => play("win"), [play]);
    const handleBigWin = useCallback(() => {
        setOpenBigWin(true);
        play("bigWin");
    }, [play]);

    const {
        response,
        grid: spinGrid,
        betAmount,
        isSpinning,
        isSpinPending,
        winningLines,
        totalWins,
        lostStreak,
        isAutoSpin,
        spin,
        changeBet,
        toggleAutoSpin,
    } = useSlotSpin({ onWin: handleWin, onBigWin: handleBigWin });

    // Show a randomized grid until the first real result arrives.
    const [placeholderGrid] = useState<string[]>(createPlaceholderGrid);
    const grid = spinGrid.length > 0 ? spinGrid : placeholderGrid;

    const handleSpinClick = useCallback((): void => {
        if (isSpinPending || isSpinning) {
            return;
        }

        stop("spin");
        play("click");
        play("spin");
        setOpenBigWin(false);

        spin();
    }, [isSpinPending, isSpinning, stop, play, spin]);

    // Stop the spin loop the moment the animation window closes.
    useEffect(() => {
        if (!isSpinning) {
            stop("spin");
        }
    }, [isSpinning, stop]);

    const dismissBigWin = useCallback((): void => {
        setOpenBigWin(false);
        stop("bigWin");
    }, [stop]);

    useEffect(() => {
        if (!openBigWin) {
            return;
        }

        window.addEventListener("click", dismissBigWin);

        return () => window.removeEventListener("click", dismissBigWin);
    }, [openBigWin, dismissBigWin]);

    const mikeStatus: MikeStatus = useMemo(() => {

        if (isSpinning) return "normal";
        if (!response) return "normal";
        if (openBigWin) return "jackpot";
        if (response.totalPayout > 0) return "win";
        if (lostStreak >= LOSING_STREAK_THRESHOLD) return "losing";
        return "normal";
    }, [response, openBigWin, lostStreak, isSpinning]);

    return (
        <div className="w-full flex justify-center px-2 pb-2 pt-1">
            {openBigWin && <BigWinAlert value={response?.totalPayout ?? 0} />}

            <div
                className="
                    w-full max-w-[600px] min-w-[300px] rounded-3xl
                    border border-[#f4d778]/40 bg-[#210905] p-2
                    shadow-[inset_0_0_35px_rgba(0,0,0,0.7)]
                "
                style={{
                    backgroundImage:
                        "linear-gradient(rgba(0,0,0,0.28), rgba(0,0,0,0.28)), url('/images/slot/chicken/mainBgMobile.png')",
                    backgroundSize: "cover",
                    backgroundPosition: "center",
                    backgroundRepeat: "no-repeat",
                }}
            >
                <header className="flex items-center justify-between px-1 py-1">
                    <span className="text-xs font-semibold text-white/80">
                        Slots
                    </span>

                    <button
                        type="button"
                        onClick={toggleSound}
                        className="rounded-md p-1 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
                        aria-label={
                            soundEnabled ? "Disable sound" : "Enable sound"
                        }
                        aria-pressed={soundEnabled}
                    >
                        {soundEnabled ? (
                            <Volume2 size={16} />
                        ) : (
                            <VolumeX size={16} />
                        )}
                    </button>
                </header>

                <RenderMike status={mikeStatus} />

                <Game
                    grid={grid}
                    isSpinning={isSpinning}
                    data={response}
                    winningLines={winningLines}
                    loadedImages={loadedImages}
                    setLoadedImages={setLoadedImages}
                />

                <section
                    className="flex flex-col justify-center gap-3 rounded-b-2xl border-t-4 border-red-800 bg-[#B52D26] p-3"
                    style={{ boxShadow: "inset 0px 0px 60px 4px #000" }}
                >
                    <div
                        className="flex w-full items-center justify-center gap-2"
                        aria-live="polite"
                    >
                        {(
                            ["balance", "bet", "wins"] as ValueViewerType[]
                        ).map((type) => (
                            <ValueViewer
                                key={type}
                                type={type}
                                betAmount={betAmount}
                                totalWins={totalWins}
                            />
                        ))}
                    </div>

                    <div className="flex items-center justify-center gap-3 sm:gap-6">
                        <BetStepperButton
                            direction="subtract"
                            onClick={() => changeBet("subtract")}
                            disabled={isSpinPending}
                        />

                        <button
                            type="button"
                            onClick={toggleAutoSpin}
                            disabled={isSpinPending}
                            aria-pressed={isAutoSpin}
                            className={
                                "h-10 rounded-full border-2 px-3 text-[10px] font-bold uppercase tracking-wide transition " +
                                (isAutoSpin
                                    ? "border-[#25D160] bg-[#25D160]/20 text-[#C8FFD7]"
                                    : "border-[#ECA823] bg-[#35170A] text-[#F8E7B1]")
                            }
                        >
                            {isAutoSpin ? "Auto On" : "Auto"}
                        </button>

                        <button
                            type="button"
                            onClick={handleSpinClick}
                            disabled={isSpinPending || isSpinning}
                            aria-label="Spin"
                            className="
                                flex h-14 w-14 items-center justify-center
                                rounded-full border-4 border-[#ECA823] bg-[#25D160]
                                font-bold text-white transition-transform
                                hover:scale-105 active:scale-95
                                disabled:cursor-not-allowed disabled:opacity-50
                                sm:h-16 sm:w-16
                            "
                            style={{ boxShadow: "inset 0px 0px 14px 1px #000" }}
                        >
                            {isSpinPending ? "..." : "Spin"}
                        </button>

                        <BetStepperButton
                            direction="add"
                            onClick={() => changeBet("add")}
                            disabled={isSpinPending}
                        />
                    </div>
                </section>

                <GameBar>
                    <LiveStatsButton />
                </GameBar>
            </div>
        </div>
    );
};

/**
 * Small presentational helper so the +/- bet buttons don't duplicate
 * ~20 lines of className boilerplate each.
 */
const BetStepperButton = ({
    direction,
    onClick,
    disabled,
}: {
    direction: "add" | "subtract";
    onClick: () => void;
    disabled: boolean;
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        aria-label={direction === "add" ? "Increase bet" : "Decrease bet"}
        className="
            flex h-10 w-6 items-center justify-center rounded-full
            border-4 border-[#ECA823] bg-transparent font-bold text-white
            transition hover:bg-[#ECA823]/20 disabled:opacity-40
        "
    >
        {direction === "add" ? "+" : "-"}
    </button>
);

export default Slots;