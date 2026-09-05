/* eslint-disable */
import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";
import { Volume2, VolumeX } from "lucide-react";

import Game from "./Game";
import { spinSlots } from "@/service/games/GamesServices";
import { type SlotProps } from "./Types";
import BigWinAlert from "./BigWinAlert";
import RenderMike from "./RenderMike";
import bigwin from "/bigwin.mp3";
import ValueViewer from "./ValueViewer";
import GameBar from "./../../../components/game/GameBar";
import LiveStatsButton from "./../../../components/LiveStats/LiveStatsButton";
import { useAppDispatch, useAppSelector } from "@/store/hook";
import { initAuth } from "@/store/slice/auth";

// Import sound files
import slotBackground from "/sounds/slotbackground.mp3";
import slotSpin from "/sounds/slotspin.mp3";
import slotWin from "/sounds/slotwin.mp3";
import clickSound from "/sounds/click.mp3";

const renderPlaceholder = () => {
    const options = [
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

const Slots = () => {
    const dispatch = useAppDispatch();

    const [grid, setGrid] = useState<string[]>(renderPlaceholder());
    const [response, setResponse] = useState<SlotProps | null>(null);
    const [betAmount, setBetAmount] = useState<number>(10);
    const [isSpinning, setIsSpinning] = useState<boolean>(false);
    const [winningLines, setWinningLines] = useState<any[]>([]);
    const [totalWins, setTotalWins] = useState<number>(0);
    const [openBigWin, setOpenBigWin] = useState<boolean>(false);
    const [lostCount, setLostCount] = useState<number>(0);
    const [loadedImages, setLoadedImages] = useState<number>(0);
    const [isAutoSpin, setIsAutoSpin] = useState<boolean>(false);
    const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

    // ----- AUDIO REFS -----
    const bgAudioRef = useRef<HTMLAudioElement | null>(null);
    const spinAudioRef = useRef<HTMLAudioElement | null>(null);
    const winAudioRef = useRef<HTMLAudioElement | null>(null);
    const clickAudioRef = useRef<HTMLAudioElement | null>(null);
    const bigWinAudioRef = useRef<HTMLAudioElement | null>(null);

    const autoSpinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const user = useAppSelector((state) => state.auth?.user);

    // ----- INIT AUDIO -----
    useEffect(() => {
        // Background music
        const bgAudio = new Audio(slotBackground);
        bgAudio.loop = true;
        bgAudio.volume = 0.3;
        bgAudio.play().catch(() => { });
        bgAudioRef.current = bgAudio;

        // Spin sound
        const spinAudio = new Audio(slotSpin);
        spinAudio.volume = 0.5;
        spinAudioRef.current = spinAudio;

        // Win sound
        const winAudio = new Audio(slotWin);
        winAudio.volume = 0.6;
        winAudioRef.current = winAudio;

        // Click sound
        const clickAudio = new Audio(clickSound);
        clickAudio.volume = 0.4;
        clickAudioRef.current = clickAudio;

        // Big win sound (already imported as bigwin)
        const bigWinAudio = new Audio(bigwin);
        bigWinAudio.volume = 0.05;
        bigWinAudioRef.current = bigWinAudio;

        return () => {
            // Cleanup all audio
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
        };
    }, []);

    // ----- SOUND HELPERS -----
    const playSound = (audioRef: React.RefObject<HTMLAudioElement | null>) => {
        if (!soundEnabled) return;
        const audio = audioRef.current;
        if (audio) {
            audio.currentTime = 0;
            audio.play().catch(() => { });
        }
    };

    const stopSpinSound = () => {
        const audio = spinAudioRef.current;
        if (audio) {
            audio.pause();
            audio.currentTime = 0;
        }
    };

    const toggleSound = () => {
        setSoundEnabled((prev) => {
            const newState = !prev;
            if (!newState) {
                // Pause background music immediately
                const bg = bgAudioRef.current;
                if (bg) bg.pause();
                // Also stop any spin sound
                stopSpinSound();
            } else {
                // Resume background music
                const bg = bgAudioRef.current;
                if (bg) bg.play().catch(() => { });
            }
            return newState;
        });
    };

    // ----- SPIN MUTATION -----
    const spinMutation = useMutation({
        mutationFn: (amount: number) => spinSlots(amount),

        onSuccess: (data) => {
            setResponse(data);
            setGrid(data.gridState);

            setWinningLines(
                data?.lastSpinResult?.map(
                    (result: { line: any }) => result.line
                ) || []
            );
            console.log(data)

            if (data) {

                dispatch(initAuth());


            }

            // Big win
            if (data.totalPayout >= betAmount * 8) {
                setOpenBigWin(true);
                playSound(bigWinAudioRef);
            }

            // Win sound
            if (data.totalPayout > 0) {
                playSound(winAudioRef);
            }

            // Losing streak
            if (data.totalPayout === 0) {
                setLostCount((prev) => prev + 1);
            } else {
                setLostCount(0);
            }

            // Stop spin after animation
            setTimeout(() => {
                setIsSpinning(false);
                stopSpinSound();
            }, 3000);
        },

        onError: (error: any) => {
            console.error(
                error?.response?.data?.message ||
                "Error spinning slots"
            );

            toast.error(
                error?.response?.data?.message ||
                "Error spinning slots"
            );

            setIsSpinning(false);
            stopSpinSound();
        },
    });

    // ----- BIG WIN CLICK -----
    const handleClick = () => {
        if (openBigWin) {
            setOpenBigWin(false);
            const audio = bigWinAudioRef.current;
            if (audio) {
                audio.pause();
                audio.currentTime = 0;
            }
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setTotalWins(response?.totalPayout || 0);
        }, 3000);

        return () => clearTimeout(timer);
    }, [response]);

    useEffect(() => {
        window.addEventListener("click", handleClick);

        return () => {
            window.removeEventListener("click", handleClick);
        };
    }, [openBigWin]);

    // ----- SPIN -----
    const handleSpin = () => {
        if (!user) {
            toast.error("Please login first.");
            return;
        }

        if (Number(user.wallets.available_balance) < betAmount) {
            toast.error("Insufficient funds");
            return;
        }

        if (spinMutation.isPending) {
            return;
        }

        stopSpinSound();
        playSound(clickAudioRef);
        playSound(spinAudioRef);

        setIsSpinning(true);
        setOpenBigWin(false);
        setTotalWins(0);

        spinMutation.mutate(betAmount);
    };

    // Auto-spin
    useEffect(() => {
        if (!isAutoSpin || !user || spinMutation.isPending || isSpinning) {
            return;
        }

        autoSpinTimeoutRef.current = setTimeout(() => {
            handleSpin();
        }, 800);

        return () => {
            if (autoSpinTimeoutRef.current) {
                clearTimeout(autoSpinTimeoutRef.current);
                autoSpinTimeoutRef.current = null;
            }
        };
    }, [isAutoSpin, user, isSpinning, spinMutation.isPending, betAmount]);

    useEffect(() => {
        return () => {
            if (autoSpinTimeoutRef.current) {
                clearTimeout(autoSpinTimeoutRef.current);
            }
        };
    }, []);

    // ----- BET CHANGE -----
    const handleChangeBet = (type: "add" | "subtract") => {
        const newBetAmount =
            type === "subtract"
                ? Math.floor(betAmount / 2)
                : betAmount * 2;

        if (newBetAmount >= 1 && newBetAmount <= 50000) {
            setBetAmount(newBetAmount);
        }
    };

    // ----- MIKE STATUS -----
    const getCurrentMike = () => {
        if (response) {
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
        }

        return "normal";
    };

    // ----- RENDER -----
    return (
        <div className="w-full flex justify-center px-2 pb-2 pt-1">
            {openBigWin && (
                <BigWinAlert value={response?.totalPayout || 0} />
            )}

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
                {/* Header with sound toggle */}
                <div className="flex items-center justify-between px-1 py-1">
                    <span className="text-xs font-semibold text-white/80">Slots</span>
                    <button
                        type="button"
                        onClick={toggleSound}
                        className="rounded-md p-1 text-white/60 hover:bg-white/10 hover:text-white transition-colors"
                        aria-label="Toggle sound"
                    >
                        {soundEnabled ? <Volume2 size={16} /> : <VolumeX size={16} />}
                    </button>
                </div>

                <RenderMike
                    status={
                        getCurrentMike() as
                        | "normal"
                        | "win"
                        | "losing"
                        | "jackpot"
                    }
                />

                <Game
                    grid={grid}
                    isSpinning={isSpinning}
                    data={response}
                    winningLines={winningLines}
                    loadedImages={loadedImages}
                    setLoadedImages={setLoadedImages}
                />

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
                        boxShadow: "inset 0px 0px 60px 4px #000",
                    }}
                >
                    <div className="flex w-full items-center justify-center gap-2">
                        {["balance", "bet", "wins"].map((type) => (
                            <ValueViewer
                                key={type}
                                type={type as "balance" | "bet" | "wins"}
                                betAmount={betAmount}
                                totalWins={totalWins}
                            />
                        ))}
                    </div>

                    <div className="flex items-center justify-center gap-3 sm:gap-6">
                        <button
                            onClick={() => handleChangeBet("subtract")}
                            disabled={spinMutation.isPending}
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

                        <button
                            onClick={() => setIsAutoSpin((prev) => !prev)}
                            disabled={spinMutation.isPending}
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
                            onClick={handleSpin}
                            disabled={spinMutation.isPending || isSpinning}
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
                                boxShadow: "inset 0px 0px 14px 1px #000",
                            }}
                        >
                            {spinMutation.isPending ? "..." : "Spin"}
                        </button>

                        <button
                            onClick={() => handleChangeBet("add")}
                            disabled={spinMutation.isPending}
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

                <GameBar>
                    <LiveStatsButton />
                </GameBar>
            </div>
        </div>
    );
};

export default Slots;