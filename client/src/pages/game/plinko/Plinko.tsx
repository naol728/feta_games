/* eslint-disable */
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "react-toastify";
import { audio } from "./../../../service/audio";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Coins,
  Hash,
  Play,
  Square,
  TrendingUp,
  Target,
  Zap,
  Percent,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store/hook";
import { setUserWallet } from "@/store/slice/auth";
import { getSocket } from "@/lib/socket";

// ============================================================
// TYPES
// ============================================================

interface Ball {
  id: number;
  path: number[];
  step: number;
  progress: number;
  finished: boolean;
  trigger: boolean;
  exitProgress: number;
}

interface Wallet {
  balance: number;
  locked_balance: number;
  withdrawable_balance: number;
  available_balance: number;
}

interface PlinkoBin {
  bin: number;
  multiplier: number;
  ways: number;
  chance: number;
  oneIn: number;
}

interface PlinkoConfig {
  rows: number;
  minBet: number;
  maxBet: number;
  bins: PlinkoBin[];
  rtp: number;
  currency: string;
}

interface PlinkoDropAck {
  ok: boolean;

  roundId?: string;

  path?: number[];

  bin?: number;

  multiplier?: number;

  payout?: number;

  profit?: number;

  betAmount?: number;

  // IMPORTANT:
  // These values come directly from the backend.
  chance?: number;

  oneIn?: number;

  ways?: number;

  totalOutcomes?: number;

  wallet?: Wallet;

  error?: string;
}

interface LastHit {
  binIndex: number;
  multiplier: number;
  chance: number;
  oneIn: number;
  ways: number;
  totalOutcomes: number;
  id: number;
}

interface ResultPopup {
  binIndex: number;
  multiplier: number;
  chance: number;
  oneIn: number;
  ways: number;
  totalOutcomes: number;
  payout: number;
  profit: number;
  betAmount: number;
  id: number;
}

// ============================================================
// FALLBACK CONFIG
// ============================================================
//
// This is only used before the server config arrives.
//
// The actual result and odds ALWAYS come from the server.
// ============================================================

const DEFAULT_ROWS = 16;

const DEFAULT_MULTIPLIERS = [
  959.8244,
  124.7772,
  24.9554,
  8.6384,
  3.8393,
  1.9196,
  0.192,
  0.192,
  0.192,
  0.192,
  0.192,
  1.9196,
  3.8393,
  8.6384,
  24.9554,
  124.7772,
  959.8244,
];

// ============================================================
// SOCKET HELPER
// ============================================================

function emitAsync<T>(
  socket: ReturnType<typeof getSocket>,
  event: string,
  payload?: unknown,
): Promise<T> {
  return new Promise((resolve) => {
    let settled = false;

    const timeout = setTimeout(() => {
      if (settled) return;

      settled = true;

      resolve({
        ok: false,
        error: "Request timed out",
      } as unknown as T);
    }, 8000);

    socket.emit(
      event,
      payload,
      (result: T) => {
        if (settled) return;

        settled = true;

        clearTimeout(timeout);

        resolve(result);
      },
    );
  });
}

// ============================================================
// PLINKO
// ============================================================

export default function Plinko() {
  const dispatch = useAppDispatch();

  const socket = getSocket();

  const user = useAppSelector(
    (state) => state.auth.user,
  );

  // ============================================================
  // SERVER CONFIG
  // ============================================================

  const [config, setConfig] =
    useState<PlinkoConfig | null>(null);

  const rows =
    config?.rows ?? DEFAULT_ROWS;

  const multipliers =
    config?.bins?.map(
      (bin) => bin.multiplier,
    ) ?? DEFAULT_MULTIPLIERS;

  // ============================================================
  // BET STATE
  // ============================================================

  const [betAmount, setBetAmount] =
    useState<number>(100);

  const betAmountRef =
    useRef(betAmount);

  useEffect(() => {
    betAmountRef.current =
      betAmount;
  }, [betAmount]);

  // ============================================================
  // BALL STATE
  // ============================================================

  const ballsRef =
    useRef<Ball[]>([]);

  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  const containerRef =
    useRef<HTMLDivElement>(null);

  const animationRef =
    useRef<number>(0);

  // ============================================================
  // AUTO
  // ============================================================

  const [autoActive, setAutoActive] =
    useState(false);

  const [autoBetCount, setAutoBetCount] =
    useState<number>(0);

  const [autoBetsRemaining, setAutoBetsRemaining] =
    useState<number>(0);

  const autoStateRef =
    useRef({
      active: false,
      count: 0,
      remaining: 0,
    });

  // ============================================================
  // RESULT
  // ============================================================

  const [lastHit, setLastHit] =
    useState<LastHit | null>(null);

  const [landingBall, setLandingBall] =
    useState<{
      binIndex: number;
      multiplier: number;
      id: number;
    } | null>(null);

  const [resultPopup, setResultPopup] =
    useState<ResultPopup | null>(null);

  const [mode, setMode] =
    useState<"MANUAL" | "AUTO">(
      "MANUAL",
    );

  // ============================================================
  // BALANCE
  // ============================================================

  const balance = Number(
    user?.wallets?.available_balance ?? 0,
  );

  // ============================================================
  // SYNC AUTO STATE
  // ============================================================

  useEffect(() => {
    autoStateRef.current = {
      active: autoActive,
      count: autoBetCount,
      remaining:
        autoBetsRemaining,
    };
  }, [
    autoActive,
    autoBetCount,
    autoBetsRemaining,
  ]);

  // ============================================================
  // LOAD SERVER CONFIG
  // ============================================================

  useEffect(() => {
    let mounted = true;

    const loadConfig = async () => {
      const result =
        await emitAsync<{
          ok: boolean;
          config?: PlinkoConfig;
          error?: string;
        }>(
          socket,
          "plinko:config",
        );

      if (!mounted) return;

      if (!result.ok || !result.config) {
        toast.error(
          result.error ||
          "Could not load Plinko configuration",
        );

        return;
      }

      setConfig(result.config);

      // Keep current bet inside server limits.
      setBetAmount((current) =>
        Math.min(
          Math.max(
            current,
            result.config!.minBet,
          ),
          result.config!.maxBet,
        ),
      );
    };

    void loadConfig();

    return () => {
      mounted = false;
    };
  }, [socket]);

  // ============================================================
  // POPUP AUTO CLOSE
  // ============================================================

  useEffect(() => {
    if (!resultPopup) return;

    const timer = setTimeout(() => {
      setResultPopup(null);
    }, 1800);

    return () => {
      clearTimeout(timer);
    };
  }, [resultPopup]);

  // ============================================================
  // CLEANUP
  // ============================================================

  useEffect(() => {
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(
          animationRef.current,
        );
      }

      setAutoActive(false);
    };
  }, []);

  // ============================================================
  // FORMATTING
  // ============================================================

  const formatMultiplier = (
    multiplier: number,
  ) => {
    if (multiplier >= 1000) {
      return "1k";
    }

    if (multiplier >= 10) {
      return multiplier.toFixed(0);
    }

    return multiplier.toFixed(2);
  };

  const formatOdds = (
    oneIn?: number,
  ) => {
    if (!oneIn) return "—";

    return `1 in ${oneIn.toLocaleString()}`;
  };

  const formatChance = (
    chance?: number,
  ) => {
    if (
      chance === undefined ||
      chance === null
    ) {
      return "—";
    }

    const percentage =
      chance * 100;

    if (percentage < 0.001) {
      return `${percentage.toFixed(
        5,
      )}%`;
    }

    if (percentage < 0.01) {
      return `${percentage.toFixed(
        4,
      )}%`;
    }

    if (percentage < 1) {
      return `${percentage.toFixed(
        3,
      )}%`;
    }

    return `${percentage.toFixed(
      2,
    )}%`;
  };

  const getMultiColor = (
    multiplier: number,
  ) => {
    if (multiplier >= 100) {
      return "bg-rose-500";
    }

    if (multiplier >= 10) {
      return "bg-orange-500";
    }

    if (multiplier >= 1.5) {
      return "bg-cyan-500";
    }

    return "bg-slate-700 dark:bg-slate-800";
  };

  // ============================================================
  // DROP BALL
  // ============================================================

  const dropBall = async () => {
    const amount =
      betAmountRef.current;

    const minBet =
      config?.minBet ?? 1;

    const maxBet =
      config?.maxBet ?? 50_000;

    // ========================================================
    // VALIDATION
    // ========================================================

    if (
      !Number.isFinite(amount) ||
      amount < minBet ||
      amount > maxBet
    ) {
      toast.error(
        `Bet must be between ${minBet} and ${maxBet} ETB`,
      );

      setAutoActive(false);

      return;
    }

    if (amount > balance) {
      toast.error(
        "Insufficient funds",
      );

      setAutoActive(false);

      return;
    }

    if (
      ballsRef.current.length >
      50
    ) {
      return;
    }

    // ========================================================
    // BET SOUND
    // ========================================================

    audio.playBet();

    // ========================================================
    // SERVER REQUEST
    // ========================================================

    const result =
      await emitAsync<PlinkoDropAck>(
        socket,
        "plinko:drop",
        {
          betAmount: amount,
        },
      );

    // ========================================================
    // ERROR
    // ========================================================

    if (
      !result.ok ||
      !result.path ||
      result.bin === undefined ||
      result.multiplier ===
      undefined
    ) {
      toast.error(
        result.error ||
        "Could not drop the ball",
      );

      setAutoActive(false);

      return;
    }

    // ========================================================
    // IMPORTANT
    //
    // The server has already decided:
    //
    // result.path
    // result.bin
    // result.multiplier
    // result.chance
    // result.oneIn
    // result.ways
    // result.payout
    //
    // We DO NOT generate or recalculate the outcome here.
    // ========================================================

    const finalBin =
      result.bin;

    const multiplier =
      result.multiplier;

    const chance =
      result.chance ?? 0;

    const oneIn =
      result.oneIn ?? 0;

    const ways =
      result.ways ?? 0;

    const totalOutcomes =
      result.totalOutcomes ??
      Math.pow(2, rows);

    const payout =
      result.payout ?? 0;

    const profit =
      result.profit ??
      0;

    // ========================================================
    // UPDATE WALLET
    // ========================================================

    if (result.wallet) {
      dispatch(
        setUserWallet(
          result.wallet,
        ),
      );
    }

    // ========================================================
    // CREATE ANIMATED BALL
    // ========================================================

    ballsRef.current.push({
      id:
        Date.now() +
        Math.random(),

      path: result.path,

      step: 0,

      progress: 0,

      finished: false,

      trigger: false,

      exitProgress: 0,
    });
  };

  // ============================================================
  // AUTO BET
  // ============================================================

  useEffect(() => {
    let interval:
      | ReturnType<
        typeof setInterval
      >
      | undefined;

    if (autoActive) {
      setAutoBetsRemaining(
        autoBetCount === 0
          ? 999999
          : autoBetCount,
      );

      interval =
        setInterval(() => {
          const {
            active,
            count,
            remaining,
          } =
            autoStateRef.current;

          if (!active) return;

          if (
            balance <
            betAmountRef.current
          ) {
            setAutoActive(false);

            return;
          }

          if (
            count === 0 ||
            remaining > 0
          ) {
            void dropBall();

            if (count > 0) {
              setAutoBetsRemaining(
                (prev) =>
                  Math.max(
                    0,
                    prev - 1,
                  ),
              );
            }
          } else {
            setAutoActive(false);
          }
        }, 400);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    autoActive,
    balance,
  ]);

  // ============================================================
  // TOGGLE AUTO
  // ============================================================

  const toggleAuto = () => {
    if (autoActive) {
      setAutoActive(false);

      return;
    }

    if (
      betAmount <= 0 ||
      betAmount > balance
    ) {
      return;
    }

    setAutoBetsRemaining(
      autoBetCount === 0
        ? 999999
        : autoBetCount,
    );

    setAutoActive(true);
  };

  // ============================================================
  // CANVAS
  // ============================================================

  useEffect(() => {
    const canvas =
      canvasRef.current;

    const container =
      containerRef.current;

    if (!canvas || !container) {
      return;
    }

    // ========================================================
    // RESIZE
    // ========================================================

    const resize = () => {
      const rect =
        container.getBoundingClientRect();

      const dpr =
        window.devicePixelRatio ||
        1;

      canvas.width =
        rect.width * dpr;

      canvas.height =
        rect.height * dpr;

      canvas.style.width =
        "100%";

      canvas.style.height =
        "100%";

      const ctx =
        canvas.getContext("2d");

      if (ctx) {
        ctx.setTransform(
          dpr,
          0,
          0,
          dpr,
          0,
          0,
        );
      }
    };

    resize();

    window.addEventListener(
      "resize",
      resize,
    );

    // ========================================================
    // RENDER
    // ========================================================

    const render = () => {
      const ctx =
        canvas.getContext("2d");

      if (!ctx) return;

      const dpr =
        window.devicePixelRatio ||
        1;

      const width =
        canvas.width / dpr;

      const height =
        canvas.height / dpr;

      ctx.clearRect(
        0,
        0,
        width,
        height,
      );

      const startX =
        width / 2;

      const startY = 24;

      const spacingX =
        width / (rows + 4);

      const spacingY =
        (height - 80) /
        rows;

      // ======================================================
      // PEGS
      // ======================================================

      ctx.fillStyle =
        "rgba(148, 163, 184, 0.7)";

      for (
        let r = 0;
        r <= rows;
        r++
      ) {
        const rowWidth =
          r * spacingX;

        const rowStartX =
          startX -
          rowWidth / 2;

        for (
          let c = 0;
          c <= r;
          c++
        ) {
          ctx.beginPath();

          ctx.arc(
            rowStartX +
            c * spacingX,

            startY +
            r * spacingY,

            1.6,

            0,

            Math.PI * 2,
          );

          ctx.fill();
        }
      }

      // ======================================================
      // ACTIVE BALLS
      // ======================================================

      const activeBalls: Ball[] =
        [];

      ballsRef.current.forEach(
        (ball) => {
          if (ball.finished) {
            return;
          }

          // ==================================================
          // EXIT PHASE
          // ==================================================

          if (
            ball.step >= rows
          ) {
            if (!ball.trigger) {
              ball.trigger =
                true;

              // =================================================
              // IMPORTANT:
              //
              // This bin is calculated from the SAME path that
              // the server sent to us.
              //
              // We do NOT generate another random result.
              // =================================================

              const finalBin =
                ball.path.reduce(
                  (a, b) =>
                    a + b,
                  0,
                );

              const serverBin =
                config?.bins?.[
                finalBin
                ];

              const mult =
                serverBin
                  ?.multiplier ??
                multipliers[
                finalBin
                ] ??
                0;

              const id =
                ball.id;

              // =================================================
              // LANDING BALL
              // =================================================

              setLandingBall({
                binIndex:
                  finalBin,

                multiplier:
                  mult,

                id,
              });

              // =================================================
              // IMPORTANT:
              //
              // We cannot recover server odds from the path
              // unless the server response was stored.
              //
              // Therefore the result data is saved on the ball
              // below through the result cache.
              // =================================================

              const cachedResult =
                dropResultsRef.current.get(
                  id,
                );

              const chance =
                cachedResult
                  ?.chance ??
                serverBin?.chance ??
                0;

              const oneIn =
                cachedResult
                  ?.oneIn ??
                serverBin?.oneIn ??
                0;

              const ways =
                cachedResult
                  ?.ways ??
                serverBin?.ways ??
                0;

              const totalOutcomes =
                cachedResult
                  ?.totalOutcomes ??
                Math.pow(
                  2,
                  rows,
                );

              const payout =
                cachedResult
                  ?.payout ??
                0;

              const profit =
                cachedResult
                  ?.profit ??
                0;

              const betAmount =
                cachedResult
                  ?.betAmount ??
                0;

              // =================================================
              // LAST HIT
              // =================================================

              setLastHit({
                binIndex:
                  finalBin,

                multiplier:
                  mult,

                chance,

                oneIn,

                ways,

                totalOutcomes,

                id,
              });

              // =================================================
              // RESULT POPUP
              // =================================================

              setResultPopup({
                binIndex:
                  finalBin,

                multiplier:
                  mult,

                chance,

                oneIn,

                ways,

                totalOutcomes,

                payout,

                profit,

                betAmount,

                id,
              });

              // =================================================
              // SOUND
              // =================================================

              if (mult >= 10) {
                audio.playWin();
              }

              // Remove cached result after it is used.
              dropResultsRef.current.delete(
                id,
              );
            }

            // ==================================================
            // EXIT ANIMATION
            // ==================================================

            ball.exitProgress +=
              0.18;

            if (
              ball.exitProgress <
              1
            ) {
              const finalBin =
                ball.path.reduce(
                  (a, b) =>
                    a + b,
                  0,
                );

              const x =
                startX -
                (rows *
                  spacingX) /
                2 +
                finalBin *
                spacingX;

              const y =
                startY +
                rows *
                spacingY;

              const opacity =
                Math.max(
                  0,
                  1 -
                  ball.exitProgress,
                );

              ctx.beginPath();

              ctx.fillStyle =
                `rgba(217, 70, 239, ${opacity})`;

              ctx.shadowBlur =
                12 * opacity;

              ctx.shadowColor =
                `rgba(217, 70, 239, ${0.6 *
                opacity
                })`;

              ctx.arc(
                x,
                y,
                4,
                0,
                Math.PI * 2,
              );

              ctx.fill();

              ctx.shadowBlur = 0;

              activeBalls.push(
                ball,
              );
            } else {
              ball.finished =
                true;
            }

            return;
          }

          // ==================================================
          // NORMAL PHASE
          // ==================================================

          ball.progress +=
            0.08;

          if (
            ball.progress >=
            1
          ) {
            ball.step++;

            ball.progress = 0;

            if (
              Math.random() >
              0.8
            ) {
              audio.playSpin();
            }
          }

          if (
            ball.step < rows
          ) {
            const currentLevel =
              ball.step;

            const currentBin =
              ball.path
                .slice(
                  0,
                  currentLevel,
                )
                .reduce(
                  (a, b) =>
                    a + b,
                  0,
                );

            const nextBin =
              currentBin +
              ball.path[
              currentLevel
              ];

            const x1 =
              startX -
              (currentLevel *
                spacingX) /
              2 +
              currentBin *
              spacingX;

            const x2 =
              startX -
              ((currentLevel +
                1) *
                spacingX) /
              2 +
              nextBin *
              spacingX;

            const y1 =
              startY +
              currentLevel *
              spacingY;

            const y2 =
              startY +
              (currentLevel +
                1) *
              spacingY;

            const x =
              x1 +
              (x2 - x1) *
              ball.progress;

            const bounce =
              8 *
              Math.sin(
                ball.progress *
                Math.PI,
              );

            const y =
              y1 +
              (y2 - y1) *
              ball.progress -
              bounce;

            ctx.beginPath();

            ctx.fillStyle =
              "#d946ef";

            ctx.shadowBlur = 10;

            ctx.shadowColor =
              "rgba(217, 70, 239, 0.6)";

            ctx.arc(
              x,
              y,
              4,
              0,
              Math.PI * 2,
            );

            ctx.fill();

            ctx.shadowBlur = 0;

            activeBalls.push(
              ball,
            );
          }
        },
      );

      ballsRef.current =
        activeBalls;

      animationRef.current =
        requestAnimationFrame(
          render,
        );
    };

    render();

    return () => {
      cancelAnimationFrame(
        animationRef.current,
      );

      window.removeEventListener(
        "resize",
        resize,
      );
    };
  }, [
    rows,
    multipliers,
    config,
  ]);

  // ============================================================
  // SERVER RESULT CACHE
  // ============================================================
  //
  // The server sends the odds when dropBall() receives the result.
  // We need to keep those values until the visual ball reaches
  // the bottom.
  //
  // ============================================================

  const dropResultsRef =
    useRef<
      Map<
        number,
        {
          chance: number;
          oneIn: number;
          ways: number;
          totalOutcomes: number;
          payout: number;
          profit: number;
          betAmount: number;
        }
      >
    >(new Map());

  // ============================================================
  // IMPORTANT:
  //
  // Because the canvas effect needs the server result later,
  // this helper wraps the original ball insertion.
  //
  // ============================================================

  const originalDropBallRef =
    useRef(dropBall);

  originalDropBallRef.current =
    dropBall;

  // ============================================================
  // PATCHED DROP FUNCTION
  // ============================================================

  const handleDropBall = async () => {
    const amount =
      betAmountRef.current;

    const minBet =
      config?.minBet ?? 1;

    const maxBet =
      config?.maxBet ?? 50_000;

    if (
      !Number.isFinite(amount) ||
      amount < minBet ||
      amount > maxBet
    ) {
      toast.error(
        `Bet must be between ${minBet} and ${maxBet} ETB`,
      );

      setAutoActive(false);

      return;
    }

    if (amount > balance) {
      toast.error(
        "Insufficient funds",
      );

      setAutoActive(false);

      return;
    }

    if (
      ballsRef.current.length >
      50
    ) {
      return;
    }

    audio.playBet();

    const result =
      await emitAsync<PlinkoDropAck>(
        socket,
        "plinko:drop",
        {
          betAmount: amount,
        },
      );

    if (
      !result.ok ||
      !result.path ||
      result.bin === undefined ||
      result.multiplier ===
      undefined
    ) {
      toast.error(
        result.error ||
        "Could not drop the ball",
      );

      setAutoActive(false);

      return;
    }

    if (result.wallet) {
      dispatch(
        setUserWallet(
          result.wallet,
        ),
      );
    }

    // ========================================================
    // CREATE UNIQUE BALL ID
    // ========================================================

    const ballId =
      Date.now() +
      Math.random();

    // ========================================================
    // SAVE SERVER RESULT
    // ========================================================

    dropResultsRef.current.set(
      ballId,
      {
        chance:
          result.chance ?? 0,

        oneIn:
          result.oneIn ?? 0,

        ways:
          result.ways ?? 0,

        totalOutcomes:
          result.totalOutcomes ??
          Math.pow(2, rows),

        payout:
          result.payout ?? 0,

        profit:
          result.profit ?? 0,

        betAmount:
          result.betAmount ??
          amount,
      },
    );

    // ========================================================
    // ADD BALL
    // ========================================================

    ballsRef.current.push({
      id: ballId,

      path: result.path,

      step: 0,

      progress: 0,

      finished: false,

      trigger: false,

      exitProgress: 0,
    });
  };

  // ============================================================
  // POPUP
  // ============================================================

  const popupColor =
    resultPopup
      ? getMultiColor(
        resultPopup.multiplier,
      )
      : "bg-primary";

  // ============================================================
  // UI
  // ============================================================

  return (
    <div
      className="space-y-1 px-1.5 py-1.5 sm:px-2 sm:py-2"
      style={{
        WebkitTapHighlightColor:
          "transparent",

        touchAction:
          "manipulation",

        userSelect:
          "none",

        WebkitUserSelect:
          "none",

        overscrollBehavior:
          "contain",
      }}
    >
      {/* ======================================================
          RESULT POPUP
      ====================================================== */}

      <AnimatePresence>
        {resultPopup && (
          <motion.div
            key={`result-${resultPopup.id}`}
            className="pointer-events-none fixed inset-0 z-[100] flex items-center justify-center px-4"
            initial={{
              opacity: 0,
            }}
            animate={{
              opacity: 1,
            }}
            exit={{
              opacity: 0,
            }}
          >
            {/* Backdrop */}

            <motion.div
              className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
              initial={{
                opacity: 0,
              }}
              animate={{
                opacity: 1,
              }}
              exit={{
                opacity: 0,
              }}
            />

            {/* Popup */}

            <motion.div
              initial={{
                opacity: 0,
                scale: 0.55,
                y: 35,
              }}
              animate={{
                opacity: 1,
                scale: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                scale: 0.8,
                y: -25,
              }}
              transition={{
                type: "spring",
                stiffness: 350,
                damping: 20,
              }}
              className="relative z-10 w-[210px] overflow-hidden rounded-2xl border border-white/20 bg-background/95 shadow-2xl backdrop-blur-xl"
            >
              {/* Top result */}

              <div
                className={`px-4 py-4 text-center ${popupColor}`}
              >
                <motion.div
                  initial={{
                    scale: 0,
                    rotate: -30,
                  }}
                  animate={{
                    scale: 1,
                    rotate: 0,
                  }}
                  transition={{
                    delay: 0.05,
                    type: "spring",
                    stiffness: 400,
                  }}
                  className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/30"
                >
                  <Target className="h-5 w-5 text-white" />
                </motion.div>

                <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/70">
                  Ball Dropped
                </p>

                <motion.div
                  initial={{
                    scale: 0.7,
                  }}
                  animate={{
                    scale: [
                      0.7,
                      1.15,
                      1,
                    ],
                  }}
                  transition={{
                    delay: 0.1,
                    duration: 0.4,
                  }}
                >
                  <p className="mt-1 text-4xl font-black leading-none text-white">
                    {formatMultiplier(
                      resultPopup.multiplier,
                    )}
                    x
                  </p>
                </motion.div>
              </div>

              {/* Result information */}

              <div className="space-y-2 p-3">
                {/* Odds */}

                <div className="rounded-xl bg-muted/60 p-2.5 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <Percent className="h-3 w-3 text-muted-foreground" />

                    <span className="text-[8px] font-bold uppercase tracking-wider text-muted-foreground">
                      Odds
                    </span>
                  </div>

                  <p className="mt-1 text-base font-black tabular-nums">
                    {formatOdds(
                      resultPopup.oneIn,
                    )}
                  </p>

                  <p className="mt-0.5 text-[8px] text-muted-foreground">
                    {formatChance(
                      resultPopup.chance,
                    )}{" "}
                    chance
                  </p>
                </div>

                {/* Payout / Profit */}

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-muted/50 p-2 text-center">
                    <p className="text-[7px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Bet
                    </p>

                    <p className="mt-0.5 text-[10px] font-black">
                      {resultPopup.betAmount.toFixed(
                        2,
                      )}
                    </p>
                  </div>

                  <div className="rounded-lg bg-muted/50 p-2 text-center">
                    <p className="text-[7px] font-semibold uppercase tracking-wider text-muted-foreground">
                      Payout
                    </p>

                    <p className="mt-0.5 text-[10px] font-black">
                      {resultPopup.payout.toFixed(
                        2,
                      )}
                    </p>
                  </div>
                </div>

                {/* Profit */}

                <div className="rounded-lg bg-muted/50 px-2 py-1.5 text-center">
                  <span className="text-[7px] uppercase tracking-wider text-muted-foreground">
                    Profit
                  </span>

                  <span
                    className={`ml-1 text-[10px] font-black ${resultPopup.profit >=
                      0
                      ? "text-emerald-500"
                      : "text-rose-500"
                      }`}
                  >
                    {resultPopup.profit >=
                      0
                      ? "+"
                      : ""}
                    {resultPopup.profit.toFixed(
                      2,
                    )}{" "}
                    ETB
                  </span>
                </div>

                {/* Slot */}

                <p className="text-center text-[7px] font-medium uppercase tracking-widest text-muted-foreground">
                  Slot{" "}
                  {resultPopup.binIndex +
                    1}{" "}
                  of{" "}
                  {multipliers.length}
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================
          HERO HEADER
      ====================================================== */}

      <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary via-primary to-primary/85 px-2.5 py-2 text-primary-foreground shadow-sm">
        <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full border-4 border-primary-foreground/15" />

        <div className="pointer-events-none absolute -bottom-6 -left-6 h-20 w-20 rounded-full border border-primary-foreground/10" />

        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-foreground/15 shadow-inner">
              <Target
                className="h-3.5 w-3.5"
                strokeWidth={2.5}
              />
            </div>

            <div>
              <h1 className="text-sm font-black uppercase leading-none tracking-wider">
                Plinko
              </h1>

              <p className="text-[7px] font-medium uppercase tracking-widest text-primary-foreground/70">
                Drop · Bounce · Win
              </p>
            </div>
          </div>

          <div className="flex flex-col items-end">
            <span className="text-[7px] uppercase tracking-wider text-primary-foreground/70">
              Balance
            </span>

            <span className="text-[11px] font-bold leading-tight">
              {balance.toFixed(2)}

              <span className="ml-0.5 text-[7px] font-normal opacity-80">
                ETB
              </span>
            </span>
          </div>
        </div>

        {/* Stats */}

        <div className="relative z-10 mt-2 grid grid-cols-4 gap-1">
          {/* Bet */}

          <div className="rounded-md bg-primary-foreground/10 px-1 py-1 text-center backdrop-blur-sm">
            <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
              <Coins className="h-2 w-2" />

              <span className="text-[6px] uppercase tracking-wider">
                Bet
              </span>
            </div>

            <p className="mt-0.5 text-[10px] font-bold leading-none">
              {betAmount}
            </p>
          </div>

          {/* Last */}

          <div className="rounded-md bg-primary-foreground/10 px-1 py-1 text-center backdrop-blur-sm">
            <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
              <TrendingUp className="h-2 w-2" />

              <span className="text-[6px] uppercase tracking-wider">
                Last
              </span>
            </div>

            <p className="mt-0.5 text-[10px] font-bold leading-none">
              {lastHit
                ? `${formatMultiplier(
                  lastHit.multiplier,
                )}x`
                : "—"}
            </p>
          </div>

          {/* Odds */}

          <div className="rounded-md bg-primary-foreground/10 px-1 py-1 text-center backdrop-blur-sm">
            <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
              <Percent className="h-2 w-2" />

              <span className="text-[6px] uppercase tracking-wider">
                Odds
              </span>
            </div>

            <p className="mt-0.5 text-[9px] font-bold leading-none">
              {lastHit
                ? formatOdds(
                  lastHit.oneIn,
                )
                : "—"}
            </p>
          </div>

          {/* Active */}

          <div className="rounded-md bg-primary-foreground/10 px-1 py-1 text-center backdrop-blur-sm">
            <div className="flex items-center justify-center gap-0.5 text-primary-foreground/70">
              <Zap className="h-2 w-2" />

              <span className="text-[6px] uppercase tracking-wider">
                Active
              </span>
            </div>

            <p className="mt-0.5 text-[10px] font-bold leading-none">
              {ballsRef.current.length}
            </p>
          </div>
        </div>
      </div>

      {/* ======================================================
          BOARD
      ====================================================== */}

      <Card className="overflow-hidden rounded-xl border-border/60 shadow-sm">
        <CardContent className="p-1.5">
          <div
            ref={containerRef}
            className="relative w-full overflow-hidden rounded-lg bg-gradient-to-b from-muted/30 to-muted/10"
            style={{
              aspectRatio: "4 / 3",
            }}
          >
            <canvas
              ref={canvasRef}
              className="pointer-events-none absolute inset-0 h-full w-full"
            />
          </div>

          {/* ==================================================
              MULTIPLIER STRIP
          ================================================== */}

          <div className="relative mt-2">
            {/* Landing Ball */}

            {landingBall && (
              <div
                key={
                  landingBall.id
                }
                style={{
                  left: `${((landingBall.binIndex +
                    0.5) /
                    multipliers.length) *
                    100
                    }%`,
                }}
                className="pointer-events-none absolute top-0 z-30 -translate-x-1/2"
              >
                <motion.div
                  initial={{
                    y: -46,
                    opacity: 1,
                    scale: 1,
                  }}
                  animate={{
                    y: [
                      0,
                      0,
                      4,
                      4,
                    ],
                    opacity: [
                      1,
                      1,
                      1,
                      0,
                    ],
                    scale: [
                      1,
                      1.15,
                      1.35,
                      0.4,
                    ],
                  }}
                  transition={{
                    duration: 0.55,
                    times: [
                      0,
                      0.4,
                      0.75,
                      1,
                    ],
                    ease: "easeIn",
                  }}
                  onAnimationComplete={() =>
                    setLandingBall(
                      null,
                    )
                  }
                >
                  <div className="h-4 w-4 rounded-full bg-fuchsia-500 shadow-[0_0_14px_rgba(217,70,239,0.9)] ring-2 ring-white/50" />
                </motion.div>
              </div>
            )}

            {/* Floating result */}

            <AnimatePresence>
              {lastHit && (
                <motion.div
                  key={`badge-${lastHit.id}`}
                  initial={{
                    y: 18,
                    opacity: 0,
                    scale: 0.5,
                  }}
                  animate={{
                    y: -6,
                    opacity: 1,
                    scale: 1,
                  }}
                  exit={{
                    y: -22,
                    opacity: 0,
                    scale: 0.7,
                  }}
                  transition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 20,
                  }}
                  className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-full"
                >
                  <div
                    className={`flex flex-col items-center rounded-xl px-2.5 py-1 shadow-lg ${getMultiColor(
                      lastHit.multiplier,
                    )}`}
                  >
                    <span className="text-[10px] font-black leading-none text-white">
                      {formatMultiplier(
                        lastHit.multiplier,
                      )}
                      x
                    </span>

                    <span className="text-[6px] font-semibold leading-none text-white/80">
                      {formatOdds(
                        lastHit.oneIn,
                      )}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Multipliers */}

            <div className="flex w-full items-stretch justify-between gap-[2px]">
              {multipliers.map(
                (
                  multiplier,
                  i,
                ) => {
                  const isHit =
                    lastHit?.binIndex ===
                    i;

                  return (
                    <motion.div
                      key={i}
                      initial={false}
                      animate={
                        isHit
                          ? {
                            scale: [
                              1,
                              1.3,
                              1.05,
                            ],
                            y: [
                              0,
                              -5,
                              0,
                            ],
                            boxShadow:
                              "0 0 14px rgba(255,255,255,0.9)",
                          }
                          : {
                            scale: 1,
                            y: 0,
                            boxShadow:
                              "0 0 0 rgba(0,0,0,0)",
                          }
                      }
                      transition={{
                        duration:
                          isHit
                            ? 0.5
                            : 0.2,
                        type: "tween",
                      }}
                      className={`relative flex h-6 flex-1 items-center justify-center rounded-[4px] text-[7px] font-black tabular-nums text-white shadow-sm ${getMultiColor(
                        multiplier,
                      )} ${isHit
                        ? "z-10 ring-2 ring-white/90 dark:ring-white/70"
                        : ""
                        }`}
                    >
                      {formatMultiplier(
                        multiplier,
                      )}
                    </motion.div>
                  );
                },
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ======================================================
          CONTROLS
      ====================================================== */}

      <Card className="rounded-xl border-border/60 shadow-sm">
        <CardContent className="space-y-1.5 p-1.5">
          {/* MODE */}

          <Tabs
            value={mode}
            onValueChange={(value) => {
              if (autoActive)
                return;

              setMode(
                value as
                | "MANUAL"
                | "AUTO",
              );
            }}
          >
            <TabsList className="grid h-6 w-full grid-cols-2 rounded-lg bg-muted/70 p-0.5">
              <TabsTrigger
                value="MANUAL"
                disabled={autoActive}
                className="h-5 rounded-md text-[9px] font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Manual
              </TabsTrigger>

              <TabsTrigger
                value="AUTO"
                disabled={autoActive}
                className="h-5 rounded-md text-[9px] font-semibold data-[state=active]:bg-background data-[state=active]:shadow-sm"
              >
                Auto
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* BET */}

          <div
            className={
              mode === "AUTO"
                ? "grid grid-cols-2 gap-1.5"
                : ""
            }
          >
            <div className="space-y-1">
              <Label className="flex items-center gap-1 text-[8px] uppercase tracking-wider text-muted-foreground">
                <Coins className="h-2.5 w-2.5" />

                Bet Amount
              </Label>

              <div className="relative">
                <Input
                  type="number"
                  min={
                    config?.minBet ??
                    1
                  }
                  max={
                    config?.maxBet ??
                    50000
                  }
                  value={betAmount}
                  onChange={(e) =>
                    setBetAmount(
                      Number(
                        e.target.value,
                      ),
                    )
                  }
                  disabled={
                    autoActive
                  }
                  className="h-7 rounded-lg pr-16 text-center text-[11px] font-bold"
                />

                <div className="absolute right-1 top-1/2 flex -translate-y-1/2 gap-0.5">
                  <button
                    type="button"
                    onClick={() =>
                      setBetAmount(
                        Math.max(
                          config?.minBet ??
                          1,
                          Math.floor(
                            betAmount /
                            2,
                          ),
                        ),
                      )
                    }
                    disabled={
                      autoActive
                    }
                    className="rounded-md bg-muted px-1.5 py-1 text-[7px] font-bold text-muted-foreground transition hover:bg-muted/70 disabled:opacity-40"
                  >
                    ½
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setBetAmount(
                        Math.min(
                          config?.maxBet ??
                          50000,
                          betAmount *
                          2,
                        ),
                      )
                    }
                    disabled={
                      autoActive
                    }
                    className="rounded-md bg-muted px-1.5 py-1 text-[7px] font-bold text-muted-foreground transition hover:bg-muted/70 disabled:opacity-40"
                  >
                    2×
                  </button>
                </div>
              </div>
            </div>

            {/* AUTO */}

            {mode ===
              "AUTO" && (
                <motion.div
                  initial={{
                    opacity: 0,
                    y: -6,
                  }}
                  animate={{
                    opacity: 1,
                    y: 0,
                  }}
                  className="space-y-1"
                >
                  <Label className="flex items-center gap-1 text-[8px] uppercase tracking-wider text-muted-foreground">
                    <Hash className="h-2.5 w-2.5" />

                    Drops

                    <span className="text-[7px] font-normal normal-case">
                      (0 = ∞)
                    </span>
                  </Label>

                  <Input
                    type="number"
                    min={0}
                    value={
                      autoBetCount
                    }
                    onChange={(e) =>
                      setAutoBetCount(
                        Math.max(
                          0,
                          Number(
                            e.target
                              .value,
                          ),
                        ),
                      )
                    }
                    disabled={
                      autoActive
                    }
                    placeholder="0 = ∞"
                    className="h-7 rounded-lg text-center text-[11px] font-bold"
                  />
                </motion.div>
              )}
          </div>

          {/* MANUAL / STOP */}

          {!autoActive ? (
            <motion.div
              whileTap={{
                scale: 0.97,
              }}
            >
              <Button
                onClick={
                  handleDropBall
                }
                disabled={
                  betAmount <= 0 ||
                  betAmount >
                  balance ||
                  (config
                    ? betAmount <
                    config.minBet ||
                    betAmount >
                    config.maxBet
                    : false)
                }
                className="h-8 w-full rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-sm"
              >
                <Play className="mr-1.5 h-3 w-3 fill-current" />

                Drop Ball

                <span className="ml-1.5 text-[9px] font-normal opacity-80">
                  · {betAmount} ETB
                </span>
              </Button>
            </motion.div>
          ) : (
            <motion.div
              whileTap={{
                scale: 0.97,
              }}
            >
              <Button
                onClick={
                  toggleAuto
                }
                variant="destructive"
                className="h-8 w-full rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-sm"
              >
                <Square className="mr-1.5 h-3 w-3 fill-current" />

                Stop Auto

                {autoBetsRemaining !==
                  999999 && (
                    <Badge
                      variant="secondary"
                      className="ml-1.5 h-4 rounded-md px-1 text-[8px]"
                    >
                      {
                        autoBetsRemaining
                      }
                    </Badge>
                  )}
              </Button>
            </motion.div>
          )}

          {/* START AUTO */}

          {!autoActive &&
            mode === "AUTO" && (
              <motion.div
                whileTap={{
                  scale: 0.97,
                }}
              >
                <Button
                  onClick={
                    toggleAuto
                  }
                  variant="secondary"
                  disabled={
                    betAmount <= 0 ||
                    betAmount >
                    balance ||
                    (config
                      ? betAmount <
                      config.minBet ||
                      betAmount >
                      config.maxBet
                      : false)
                  }
                  className="h-7 w-full rounded-lg text-[9px] font-bold uppercase tracking-widest"
                >
                  <Zap className="mr-1.5 h-3 w-3" />

                  Start Auto Drop
                </Button>
              </motion.div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
