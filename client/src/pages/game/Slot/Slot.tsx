/* eslint-disable */

import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";
import { Volume2, VolumeX } from "lucide-react";

import Game from "./Game";
import { type SlotProps } from "./Types";
import BigWinAlert from "./BigWinAlert";
import RenderMike from "./RenderMike";
import bigwin from "/bigwin.mp3";
import ValueViewer from "./ValueViewer";
import GameBar from "./../../../components/game/GameBar";
import LiveStatsButton from "./../../../components/LiveStats/LiveStatsButton";
import { useAppDispatch, useAppSelector } from "@/store/hook";
import { setUserWallet } from "@/store/slice/auth";
import { getSocket } from "@/lib/socket";

import slotBackground from "/sounds/slotbackground.mp3";
import slotSpin from "/sounds/slotspin.mp3";
import slotWin from "/sounds/slotwin.mp3";
import clickSound from "/sounds/click.mp3";

/* ============================================================
   TYPES
============================================================ */

type MikeStatus = "normal" | "win" | "losing" | "jackpot";

type BetChangeType = "add" | "subtract";

type ValueViewerType = "balance" | "bet" | "wins";

/**
 * The backend result for one winning line.
 *
 * Adjust the fields here if your backend SlotProps defines
 * additional properties for a spin result.
 */
interface SlotSpinLineResult {
    line: SlotProps["lastSpinResult"][number]["line"];
}

/**
 * Socket acknowledgement returned by:
 *
 * socket.emit("slots:spin", payload, callback)
 */
interface SlotSpinResult extends SlotProps {
    success: boolean;
    message?: string;
    wallet: any;
}

/**
 * Socket payload sent to the backend.
 */
interface SlotSpinPayload {
    betAmount: number;
}

/* ============================================================
   CONSTANTS
============================================================ */

const MIN_BET = 1;
const MAX_BET = 50_000;
const AUTO_SPIN_DELAY = 800;
const SPIN_ANIMATION_DURATION = 3_000;
const BIG_WIN_MULTIPLIER = 8;

/* ============================================================
   HELPERS
============================================================ */

/**
 * Generates a temporary grid while the slot game is loading.
 */
const renderPlaceholder = (): string[] => {
    const options: readonly string[] = [
        "red",
        "blue",
        "green",
        "yin_yang",
        "hakkero",
        "yellow",
        "wild",
    ];

    return Array.from(
        { length: 9 },
        () => options[Math.floor(Math.random() * options.length)]
    );
};

/* ============================================================
   COMPONENT
============================================================ */

const Slots = () => {
    const dispatch = useAppDispatch();
    const socket = getSocket();

    /* --------------------------------------------------------
       REDUX
    -------------------------------------------------------- */

    const user = useAppSelector((state) => state.auth?.user);

    /* --------------------------------------------------------
       GAME STATE
    -------------------------------------------------------- */

    const [grid, setGrid] = useState<string[]>(renderPlaceholder());

    const [response, setResponse] = useState<SlotSpinResult | null>(null);

    const [betAmount, setBetAmount] = useState<number>(10);

    const [isSpinning, setIsSpinning] = useState<boolean>(false);

    const [isSpinPending, setIsSpinPending] = useState<boolean>(false);

    const [winningLines, setWinningLines] = useState<
        SlotSpinLineResult["line"][]
    >([]);

    const [totalWins, setTotalWins] = useState<number>(0);

    const [openBigWin, setOpenBigWin] = useState<boolean>(false);

    const [lostCount, setLostCount] = useState<number>(0);

    const [loadedImages, setLoadedImages] = useState<number>(0);

    const [isAutoSpin, setIsAutoSpin] = useState<boolean>(false);

    const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

    /* --------------------------------------------------------
       AUDIO REFS
    -------------------------------------------------------- */

    const bgAudioRef = useRef<HTMLAudioElement | null>(null);

    const spinAudioRef = useRef<HTMLAudioElement | null>(null);

    const winAudioRef = useRef<HTMLAudioElement | null>(null);

    const clickAudioRef = useRef<HTMLAudioElement | null>(null);

    const bigWinAudioRef = useRef<HTMLAudioElement | null>(null);

    const autoSpinTimeoutRef =
        useRef<ReturnType<typeof setTimeout> | null>(null);

    /* ========================================================
       AUDIO INITIALIZATION
    ======================================================== */

    useEffect(() => {
        /* Background music */
        const bgAudio = new Audio(slotBackground);

        bgAudio.loop = true;
        bgAudio.volume = 0.3;

        bgAudio.play().catch(() => {
            // Browser may block autoplay until user interaction.
        });

        bgAudioRef.current = bgAudio;

        /* Spin sound */
        const spinAudio = new Audio(slotSpin);

        spinAudio.volume = 0.5;

        spinAudioRef.current = spinAudio;

        /* Win sound */
        const winAudio = new Audio(slotWin);

        winAudio.volume = 0.6;

        winAudioRef.current = winAudio;

        /* Click sound */
        const clickAudio = new Audio(clickSound);

        clickAudio.volume = 0.4;

        clickAudioRef.current = clickAudio;

        /* Big win sound */
        const bigWinAudio = new Audio(bigwin);

        bigWinAudio.volume = 0.05;

        bigWinAudioRef.current = bigWinAudio;

        /* Cleanup */
        return () => {
            bgAudio.pause();
            bgAudio.src = "";

            spinAudio.pause();
            spinAudio.src = "";

            winAudio.pause();
            winAudio.src = "";

            clickAudio.pause();
            clickAudio.src = "";

            bigWinAudio.pause();
            bigWinAudio.src = "";

            bgAudioRef.current = null;
            spinAudioRef.current = null;
            winAudioRef.current = null;
            clickAudioRef.current = null;
            bigWinAudioRef.current = null;
        };
    }, []);

    /* ========================================================
       SOUND HELPERS
    ======================================================== */

    const playSound = (
        audioRef: React.RefObject<HTMLAudioElement | null>
    ): void => {
        if (!soundEnabled) {
            return;
        }

        const audio = audioRef.current;

        if (!audio) {
            return;
        }

        audio.currentTime = 0;

        audio.play().catch(() => {
            // Browser may reject playback.
        });
    };

    const stopSpinSound = (): void => {
        const audio = spinAudioRef.current;

        if (!audio) {
            return;
        }

        audio.pause();
        audio.currentTime = 0;
    };

    const toggleSound = (): void => {
        setSoundEnabled((previousState) => {
            const newState = !previousState;

            if (!newState) {
                /* Disable sounds */
                const bgAudio = bgAudioRef.current;

                if (bgAudio) {
                    bgAudio.pause();
                }

                stopSpinSound();
            } else {
                /* Enable sounds */
                const bgAudio = bgAudioRef.current;

                if (bgAudio) {
                    bgAudio.play().catch(() => {
                        // Browser may reject playback.
                    });
                }
            }

            return newState;
        });
    };

    /* ========================================================
       SPIN
    ======================================================== */

    const emitSpin = (amount: number): void => {
        setIsSpinPending(true);

        const payload: SlotSpinPayload = {
            betAmount: amount,
        };

        socket.emit(
            "slots:spin",
            payload,
            (data: SlotSpinResult): void => {
                setIsSpinPending(false);

                /* --------------------------------------------
                   ERROR
                -------------------------------------------- */

                if (!data || !data.success) {
                    const errorMessage =
                        data?.message ?? "Error spinning slots";

                    console.error(errorMessage);

                    toast.error(errorMessage);

                    setIsSpinning(false);

                    stopSpinSound();

                    return;
                }

                /* --------------------------------------------
                   GAME RESPONSE
                -------------------------------------------- */

                setResponse(data);

                setGrid(data.gridState);

                /* --------------------------------------------
                   WINNING LINES
                -------------------------------------------- */

                const lines: SlotSpinLineResult["line"][] =
                    data.lastSpinResult.map(
                        (result: SlotSpinLineResult) => result.line
                    );

                setWinningLines(lines);

                /* --------------------------------------------
                   WALLET
                -------------------------------------------- */

                if (data.wallet) {
                    dispatch(setUserWallet(data.wallet));
                }

                /* --------------------------------------------
                   BIG WIN
                -------------------------------------------- */

                const totalPayout = data.totalPayout;

                if (totalPayout >= amount * BIG_WIN_MULTIPLIER) {
                    setOpenBigWin(true);

                    playSound(bigWinAudioRef);
                }

                /* --------------------------------------------
                   NORMAL WIN SOUND
                -------------------------------------------- */

                if (totalPayout > 0) {
                    playSound(winAudioRef);
                }

                /* --------------------------------------------
                   LOSING STREAK
                -------------------------------------------- */

                if (totalPayout === 0) {
                    setLostCount((previousCount) => previousCount + 1);
                } else {
                    setLostCount(0);
                }

                /* --------------------------------------------
                   STOP SPINNING
                -------------------------------------------- */

                setTimeout(() => {
                    setIsSpinning(false);

                    stopSpinSound();
                }, SPIN_ANIMATION_DURATION);
            }
        );
    };

    /* ========================================================
       BIG WIN CLICK
    ======================================================== */

    const handleClick = (): void => {
        if (!openBigWin) {
            return;
        }

        setOpenBigWin(false);

        const audio = bigWinAudioRef.current;

        if (!audio) {
            return;
        }

        audio.pause();
        audio.currentTime = 0;
    };

    /* ========================================================
       UPDATE TOTAL WIN
    ======================================================== */

    useEffect(() => {
        const timer = setTimeout(() => {
            setTotalWins(response?.totalPayout ?? 0);
        }, SPIN_ANIMATION_DURATION);

        return () => {
            clearTimeout(timer);
        };
    }, [response]);

    /* ========================================================
       BIG WIN GLOBAL CLICK HANDLER
    ======================================================== */

    useEffect(() => {
        window.addEventListener("click", handleClick);

        return () => {
            window.removeEventListener("click", handleClick);
        };
    }, [openBigWin]);

    /* ========================================================
       SPIN HANDLER
    ======================================================== */

    const handleSpin = (): void => {
        /* User must be authenticated */
        if (!user) {
            toast.error("Please login first.");

            return;
        }

        /* Check available wallet balance */
        const availableBalance = Number(
            user.wallets.available_balance
        );

        if (!Number.isFinite(availableBalance)) {
            toast.error("Unable to read wallet balance.");

            return;
        }

        if (availableBalance < betAmount) {
            toast.error("Insufficient funds");

            return;
        }

        /* Prevent duplicate requests */
        if (isSpinPending || isSpinning) {
            return;
        }

        /* Sound */
        stopSpinSound();

        playSound(clickAudioRef);

        playSound(spinAudioRef);

        /* Game state */
        setIsSpinning(true);

        setOpenBigWin(false);

        setTotalWins(0);

        /* Send spin */
        emitSpin(betAmount);
    };

    /* ========================================================
       AUTO SPIN
    ======================================================== */

    useEffect(() => {
        if (
            !isAutoSpin ||
            !user ||
            isSpinPending ||
            isSpinning
        ) {
            return;
        }

        autoSpinTimeoutRef.current = setTimeout(() => {
            handleSpin();
        }, AUTO_SPIN_DELAY);

        return () => {
            if (autoSpinTimeoutRef.current) {
                clearTimeout(autoSpinTimeoutRef.current);

                autoSpinTimeoutRef.current = null;
            }
        };
    }, [
        isAutoSpin,
        user,
        isSpinning,
        isSpinPending,
        betAmount,
    ]);

    /* ========================================================
       AUTO SPIN CLEANUP
    ======================================================== */

    useEffect(() => {
        return () => {
            if (autoSpinTimeoutRef.current) {
                clearTimeout(autoSpinTimeoutRef.current);

                autoSpinTimeoutRef.current = null;
            }
        };
    }, []);

    /* ========================================================
       BET CHANGE
    ======================================================== */

    const handleChangeBet = (
        type: BetChangeType
    ): void => {
        const newBetAmount =
            type === "subtract"
                ? Math.floor(betAmount / 2)
                : betAmount * 2;

        if (
            newBetAmount >= MIN_BET &&
            newBetAmount <= MAX_BET
        ) {
            setBetAmount(newBetAmount);
        }
    };

    /* ========================================================
       MIKE STATUS
    ======================================================== */

    const getCurrentMike = (): MikeStatus => {
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

    /* ========================================================
       RENDER
    ======================================================== */

    return (
        <div className="w-full flex justify-center px-2 pb-2 pt-1">
            {/* --------------------------------------------
                BIG WIN
            --------------------------------------------- */}

            {openBigWin && (
                <BigWinAlert
                    value={response?.totalPayout ?? 0}
                />
            )}

            {/* --------------------------------------------
                SLOT MACHINE
            --------------------------------------------- */}

            <div
                className="
                    w-full
                    max-w-[600px]
                    min-w-[300px]
                    rounded-3xl
                    border
                    border-[#f4d778]/40
                    bg-[#210905]
                    p-2
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
                {/* ----------------------------------------
                    HEADER
                ----------------------------------------- */}

                <div className="flex items-center justify-between px-1 py-1">
                    <span className="text-xs font-semibold text-white/80">
                        Slots
                    </span>

                    <button
                        type="button"
                        onClick={toggleSound}
                        className="
                            rounded-md
                            p-1
                            text-white/60
                            hover:bg-white/10
                            hover:text-white
                            transition-colors
                        "
                        aria-label={
                            soundEnabled
                                ? "Disable sound"
                                : "Enable sound"
                        }
                    >
                        {soundEnabled ? (
                            <Volume2 size={16} />
                        ) : (
                            <VolumeX size={16} />
                        )}
                    </button>
                </div>

                {/* ----------------------------------------
                    MIKE
                ----------------------------------------- */}

                <RenderMike
                    status={getCurrentMike()}
                />

                {/* ----------------------------------------
                    GAME
                ----------------------------------------- */}

                <Game
                    grid={grid}
                    isSpinning={isSpinning}
                    data={response}
                    winningLines={winningLines}
                    loadedImages={loadedImages}
                    setLoadedImages={setLoadedImages}
                />

                {/* ----------------------------------------
                    CONTROLS
                ----------------------------------------- */}

                <div
                    className="
                        flex
                        flex-col
                        justify-center
                        p-3
                        bg-[#B52D26]
                        border-t-4
                        border-red-800
                        gap-3
                        rounded-b-2xl
                    "
                    style={{
                        boxShadow:
                            "inset 0px 0px 60px 4px #000",
                    }}
                >
                    {/* ------------------------------------
                        VALUE VIEWERS
                    ------------------------------------- */}

                    <div className="flex w-full items-center justify-center gap-2">
                        {(
                            [
                                "balance",
                                "bet",
                                "wins",
                            ] as const
                        ).map(
                            (
                                type: ValueViewerType
                            ) => (
                                <ValueViewer
                                    key={type}
                                    type={type}
                                    betAmount={betAmount}
                                    totalWins={totalWins}
                                />
                            )
                        )}
                    </div>

                    {/* ------------------------------------
                        BET / SPIN CONTROLS
                    ------------------------------------- */}

                    <div className="flex items-center justify-center gap-3 sm:gap-6">
                        {/* DECREASE BET */}

                        <button
                            type="button"
                            onClick={() =>
                                handleChangeBet(
                                    "subtract"
                                )
                            }
                            disabled={isSpinPending}
                            aria-label="Decrease bet"
                            className="
                                w-6
                                h-10
                                bg-transparent
                                text-white
                                font-bold
                                rounded-full
                                border-4
                                border-[#ECA823]
                                flex
                                items-center
                                justify-center
                                hover:bg-[#ECA823]/20
                                transition
                                disabled:opacity-40
                            "
                        >
                            -
                        </button>

                        {/* AUTO SPIN */}

                        <button
                            type="button"
                            onClick={() =>
                                setIsAutoSpin(
                                    (previous) =>
                                        !previous
                                )
                            }
                            disabled={isSpinPending}
                            aria-pressed={isAutoSpin}
                            className={
                                "h-10 rounded-full border-2 px-3 text-[10px] font-bold uppercase tracking-wide transition " +
                                (isAutoSpin
                                    ? "border-[#25D160] bg-[#25D160]/20 text-[#C8FFD7]"
                                    : "border-[#ECA823] bg-[#35170A] text-[#F8E7B1]")
                            }
                        >
                            {isAutoSpin
                                ? "Auto On"
                                : "Auto"}
                        </button>

                        {/* SPIN */}

                        <button
                            type="button"
                            onClick={handleSpin}
                            disabled={
                                isSpinPending ||
                                isSpinning
                            }
                            aria-label="Spin"
                            className="
                                bg-[#25D160]
                                w-14
                                h-14
                                sm:w-16
                                sm:h-16
                                text-white
                                font-bold
                                rounded-full
                                border-4
                                border-[#ECA823]
                                flex
                                items-center
                                justify-center
                                disabled:opacity-50
                                disabled:cursor-not-allowed
                                hover:scale-105
                                transition-transform
                                active:scale-95
                            "
                            style={{
                                boxShadow:
                                    "inset 0px 0px 14px 1px #000",
                            }}
                        >
                            {isSpinPending
                                ? "..."
                                : "Spin"}
                        </button>

                        {/* INCREASE BET */}

                        <button
                            type="button"
                            onClick={() =>
                                handleChangeBet(
                                    "add"
                                )
                            }
                            disabled={isSpinPending}
                            aria-label="Increase bet"
                            className="
                                w-6
                                h-10
                                bg-transparent
                                text-white
                                font-bold
                                rounded-full
                                border-4
                                border-[#ECA823]
                                flex
                                items-center
                                justify-center
                                hover:bg-[#ECA823]/20
                                transition
                                disabled:opacity-40
                            "
                        >
                            +
                        </button>
                    </div>
                </div>

                {/* ----------------------------------------
                    GAME BAR
                ----------------------------------------- */}

                <GameBar>
                    <LiveStatsButton />
                </GameBar>
            </div>
        </div>
    );
};

export default Slots;

