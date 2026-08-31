/* eslint-disable */

import { useEffect, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "react-toastify";

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
import { setUserWallet } from "@/store/slice/auth";

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
    const queryClient = useQueryClient();
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

    const audioRef = useRef<HTMLAudioElement | null>(null);
    const autoSpinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const user = useAppSelector((state) => state.auth?.user);

    /*
     * ============================
     * SPIN MUTATION
     * ============================
     */

    const spinMutation = useMutation({
        mutationFn: (amount: number) => spinSlots(amount),

        onSuccess: (data) => {
            /*
             * Store game result
             */
            setResponse(data);
            setGrid(data.gridState);

            setWinningLines(
                data?.lastSpinResult?.map(
                    (result: { line: any }) => result.line
                ) || []
            );


            if (data) {
                const nextBalance =
                    data.balance ?? data.walletBalance ?? user?.wallets?.balance ?? 0;

                dispatch(
                    setUserWallet({
                        balance: Number(nextBalance),
                        locked_balance: user?.wallets?.locked_balance ?? 0,
                    })
                );

                /*
                 * Optional:
                 * If wallet is also cached by TanStack Query,
                 * update that cache too.
                 */
                queryClient.setQueryData(["wallet"], {
                    balance: Number(nextBalance),
                });
            }

            /*
             * Big win
             */
            if (data.totalPayout >= betAmount * 8) {
                setOpenBigWin(true);
                startAudio();
            }

            /*
             * Losing streak
             */
            if (data.totalPayout === 0) {
                setLostCount((prev) => prev + 1);
            } else {
                setLostCount(0);
            }

            /*
             * Let the animation finish
             */
            setTimeout(() => {
                setIsSpinning(false);
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
        },
    });

    /*
     * ============================
     * AUDIO
     * ============================
     */

    const startAudio = () => {
        setTimeout(() => {
            if (audioRef.current) {
                audioRef.current.volume = 0.05;
                audioRef.current.play().catch(() => { });
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
     * ============================
     * BIG WIN CLICK
     * ============================
     */

    const handleClick = () => {
        if (openBigWin) {
            setOpenBigWin(false);
            pauseAudio();
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

    /*
     * ============================
     * SPIN
     * ============================
     */

    const handleSpin = () => {
        if (!user) {
            return;
        }

        /*
         * Frontend check for better UX.
         *
         * Backend MUST perform the real balance
         * validation again.
         */
        if (Number(user.wallets.balance) < betAmount) {
            toast.error("Insufficient funds");
            return;
        }

        if (spinMutation.isPending) {
            return;
        }

        setIsSpinning(true);
        setOpenBigWin(false);
        setTotalWins(0);

        spinMutation.mutate(betAmount);
    };

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

    /*
     * ============================
     * BET AMOUNT
     * ============================
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
     * ============================
     * MIKE STATUS
     * ============================
     */

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

    return (
        <div className="w-full flex justify-center px-2 pb-2 pt-1">

            {openBigWin && (
                <BigWinAlert
                    value={response?.totalPayout || 0}
                />
            )}

            <audio
                ref={audioRef}
                src={bigwin}
            />

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
                    "
                    style={{
                        boxShadow:
                            "inset 0px 0px 60px 4px #000",
                    }}
                >
                    <div className="flex w-full items-center justify-center gap-2">
                        {["balance", "bet", "wins"].map(
                            (type) => (
                                <ValueViewer
                                    key={type}
                                    type={
                                        type as
                                        | "balance"
                                        | "bet"
                                        | "wins"
                                    }
                                    betAmount={betAmount}
                                    totalWins={totalWins}
                                />
                            )
                        )}
                    </div>

                    <div className="flex items-center justify-center gap-3 sm:gap-6">

                        <button
                            onClick={() =>
                                handleChangeBet("subtract")
                            }
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
                            disabled={spinMutation.isPending}
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
                            "
                            style={{
                                boxShadow:
                                    "inset 0px 0px 14px 1px #000",
                            }}
                        >
                            {spinMutation.isPending
                                ? "..."
                                : "Spin"}
                        </button>

                        <button
                            onClick={() =>
                                handleChangeBet("add")
                            }
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
