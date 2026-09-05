/* eslint-disable */
import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { toast } from "react-toastify";

import falling from "/images/crash/falling.gif";
import idle from "/images/crash/idle.gif";
import up from "/images/crash/up.gif";

import LiveBets from "./LiveBets";
import GameContainer from "./GameContainer";
import SideMenu from "./SideMenu";

import { useAppDispatch, useAppSelector } from "@/store/hook";
import { initAuth } from "@/store/slice/auth";
import { getSocket } from "@/lib/socket";

// ======================== TYPES ========================

interface GameHistory {
  crashPoint: number;
}

interface CrashPlayer {
  payout?: number | null;
  autoCashoutAt?: number | null;
}

interface CrashGameState {
  gameBets: Record<string, number>;
  gamePlayers: Record<string, CrashPlayer>;
  gameStartTime: number | null;
  crashPoint: number;
  phase: "betting" | "running" | "crashed";
}

interface BetPayload {
  amount: number;
  autoCashoutAt: number | null;
}

const BETTING_COUNTDOWN = 10;
const MAX_HISTORY = 50;

// ======================== COMPONENT ========================

const CrashGame = () => {
  const socket = getSocket();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth.user);
  const isLogged = !!user;

  // ----- STATE -----
  const [bet, setBet] = useState<number | null>(null);
  const [cashoutAt, setCashoutAt] = useState("");
  const [queued, setQueued] = useState(false);
  const [multiplier, setMultiplier] = useState(1);
  const [crashPoint, setCrashPoint] = useState<number | null>(null);
  const [history, setHistory] = useState<GameHistory[]>([]);
  const [gameStarted, setGameStarted] = useState(false);
  const [gameEnded, setGameEnded] = useState(false);
  const [countDown, setCountDown] = useState(0);
  const [userGambled, setUserGambled] = useState(false);
  const [userMultiplier, setUserMultiplier] = useState(0);
  const [userCashedOut, setUserCashedOut] = useState(false);
  const [disableButton, setDisableButton] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const [gameState, setGameState] = useState<CrashGameState>({
    gameBets: {},
    gamePlayers: {},
    gameStartTime: null,
    crashPoint: 1,
    phase: "betting",
  });

  // ----- REFS -----
  const queuedRef = useRef<BetPayload | null>(null);
  const userIdRef = useRef<string | undefined>(user?.id);
  const countdownRAF = useRef<number | null>(null);
  const soundMap = useRef<Record<string, HTMLAudioElement>>({});

  // Keep userId ref updated
  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user]);

  // ----- SOUND SETUP -----
  // ----- SOUND SETUP -----
  useEffect(() => {
    const sounds = ["crashfly", "crash", "click", "cashout"];

    sounds.forEach((name) => {
      const audio = new Audio(`/sounds/${name}.mp3`);

      audio.preload = "auto";

      if (name === "crashfly") {
        audio.loop = true;
        audio.volume = 0.35;
      }

      soundMap.current[name] = audio;
    });

    return () => {
      Object.values(soundMap.current).forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
        audio.src = "";
      });

      soundMap.current = {};
    };
  }, []);

  // ----- CONTINUOUS CRASH FLY SOUND -----
  const startCrashFlySound = useCallback(() => {
    if (!soundEnabled) return;

    const audio = soundMap.current["crashfly"];

    if (!audio) return;

    audio.loop = true;

    if (audio.paused) {
      audio.play().catch(() => {
        // Browser may block autoplay until user interaction
      });
    }
  }, [soundEnabled]);

  const stopCrashFlySound = useCallback(() => {
    const audio = soundMap.current["crashfly"];

    if (!audio) return;

    audio.pause();
    audio.currentTime = 0;
  }, []);
  // ----- START CRASHFLY WHEN PAGE IS OPEN -----
  useEffect(() => {
    startCrashFlySound();

    return () => {
      stopCrashFlySound();
    };
  }, [startCrashFlySound, stopCrashFlySound]);

  const playSound = useCallback(
    (name: string) => {
      if (!soundEnabled) return;
      const audio = soundMap.current[name];
      if (audio) {
        audio.currentTime = 0;
        audio.play().catch(() => { });
      }
    },
    [soundEnabled]
  );



  const toggleSound = useCallback(() => {
    setSoundEnabled((prev) => {
      const next = !prev;

      const audio = soundMap.current["crashfly"];

      if (!audio) {
        return next;
      }

      if (next) {
        audio.loop = true;
        audio.play().catch(() => { });
      } else {
        audio.pause();
        audio.currentTime = 0;
      }

      return next;
    });
  }, []);

  // ----- MEMOIZED VALUES -----
  const availableBalance = useMemo(() => {
    if (!user?.wallets) return 0;
    return (user.wallets.balance ?? 0) + (user.wallets.withdrawable_balance ?? 0);
  }, [user?.wallets]);

  // ----- HELPERS -----
  const buildPayload = useCallback((): BetPayload | null => {
    if (!bet || bet < 1) return null;
    const target = parseFloat(cashoutAt);
    return {
      amount: bet,
      autoCashoutAt:
        Number.isFinite(target) && target >= 1.01
          ? Math.round(target * 100) / 100
          : null,
    };
  }, [bet, cashoutAt]);

  // ----- PLACE BET -----
  const placeBet = useCallback(
    (payload: BetPayload) => {
      if (!user) {
        toast.error("Please open the game through Telegram.");
        return;
      }
      setUserGambled(true);
      setUserCashedOut(false);

      socket.emit(
        "crash:bet",
        payload,
        (result: { ok?: boolean; error?: string }) => {
          if (result?.error) {
            setUserGambled(false);
            toast.error(result.error);
            return;
          }
          if (result) {
            dispatch(initAuth());
            playSound("click");
          }
        }
      );
    },
    [socket, user, dispatch, playSound]
  );

  // ----- HANDLE BET -----
  const handleBet = useCallback(() => {
    if (!isLogged) {
      toast.error("Please login first.");
      return;
    }
    if (userGambled) return;
    if (!bet || bet < 10) {
      toast.error("Minimum Bet 10 ETB.");
      return;
    }
    if (availableBalance < bet) {
      toast.error("Insufficient balance.");
      return;
    }

    if (gameStarted) {
      if (queuedRef.current) {
        queuedRef.current = null;
        setQueued(false);
        toast.info("Queued bet cancelled.");
      } else {
        const payload = buildPayload();
        if (!payload) return;
        queuedRef.current = payload;
        setQueued(true);
        toast.info("Bet queued for next round.");
      }
      return;
    }

    const payload = buildPayload();
    if (!payload) return;
    placeBet(payload);
  }, [isLogged, userGambled, bet, availableBalance, gameStarted, buildPayload, placeBet]);

  // ----- HANDLE CASHOUT -----
  const handleCashout = useCallback(() => {
    if (!userGambled || userCashedOut) return;
    if (!gameStarted) return;
    setDisableButton(true);

    socket.emit(
      "crash:cashout",
      {},
      (result: {
        ok?: boolean;
        error?: string;
        multiplier?: number;
        wallet?: {
          balance: number;
          locked_balance: number;
          withdrawable_balance: number;
        };
        payout?: number;
      }) => {
        if (result?.error) {
          toast.error(result.error);
          setDisableButton(false);
          return;
        }
        if (result?.multiplier) {
          setUserMultiplier(result.multiplier);
        }
        setUserCashedOut(true);
        setDisableButton(false);
        if (result?.wallet) {
          dispatch(initAuth());
        }
        playSound("cashout");
      }
    );
  }, [userGambled, userCashedOut, gameStarted, socket, dispatch, playSound]);

  // ----- SOCKET LISTENERS -----

  // Cashout success (from server push)
  useEffect(() => {
    const onCashoutSuccess = (data: {
      multiplier: number;
      wallet?: {
        balance: number;
        locked_balance: number;
        withdrawable_balance: number;
      };
    }) => {
      setUserMultiplier(data.multiplier);
      setUserCashedOut(true);
      setDisableButton(false);
      if (data.wallet) {
        dispatch(initAuth());
      }
      playSound("cashout");
    };
    socket.on("crash:cashoutSuccess", onCashoutSuccess);
    return () => {
      socket.off("crash:cashoutSuccess", onCashoutSuccess);
    };
  }, [socket, dispatch, playSound]);

  // Game state sync
  useEffect(() => {
    const onGameState = (state: CrashGameState) => {
      setGameState(state);

      const id = userIdRef.current;
      if (state.phase === "betting") {
        setGameStarted(false);
        setGameEnded(false);
        setMultiplier(1);
        setCrashPoint(null);
        setUserGambled(false);
        setUserCashedOut(false);
        setUserMultiplier(0);
        setDisableButton(false);

        if (queuedRef.current) {
          const payload = queuedRef.current;
          queuedRef.current = null;
          setQueued(false);
          placeBet(payload);
        }
        return;
      }

      if (state.phase === "running") {
        setGameStarted(true);
        setGameEnded(false);
        if (!id) return;
        const stake = state.gameBets?.[id];
        if (stake == null) return;
        const player = state.gamePlayers?.[id];
        setUserGambled(true);
        if (player?.payout != null) {
          setUserCashedOut(true);
          setUserMultiplier(player.payout / stake);
        }
        return;
      }

      if (state.phase === "crashed") {
        setGameStarted(false);
        setGameEnded(true);
      }
    };

    socket.on("crash:gameState", onGameState);
    return () => {
      socket.off("crash:gameState", onGameState);
    };
  }, [socket, placeBet]);

  // Sync state (initial / reconnect)
  useEffect(() => {
    const onSync = (sync: Partial<CrashGameState>) => {
      const phase = sync.phase ?? "betting";
      setGameState((prev) => ({
        ...prev,
        gameBets: sync.gameBets ?? {},
        gamePlayers: sync.gamePlayers ?? {},
        gameStartTime: sync.gameStartTime ?? null,
        phase,
      }));

      if (phase === "running") {
        setGameStarted(true);
        setGameEnded(false);
      } else if (phase === "betting") {
        setGameStarted(false);
        setGameEnded(false);
      } else if (phase === "crashed") {
        setGameStarted(false);
        setGameEnded(true);
      }

      const id = userIdRef.current;
      if (!id) return;
      const stake = sync.gameBets?.[id];
      if (stake == null) return;
      const player = sync.gamePlayers?.[id];
      setUserGambled(true);
      if (player?.payout != null) {
        setUserCashedOut(true);
        setUserMultiplier(player.payout / stake);
      }
    };

    socket.on("crash:sync", onSync);
    socket.emit("crash:requestState");

    return () => {
      socket.off("crash:sync", onSync);
    };
  }, [socket]);

  // Start / result / multiplier
  useEffect(() => {
    const onStart = () => {
      setMultiplier(1);
      setCrashPoint(null);
      setGameStarted(true);
      setGameEnded(false);
      setUserCashedOut(false);
      setUserMultiplier(0);
      setCountDown(0);
    };

    const onResult = (point: number) => {
      setCrashPoint(point);
      setMultiplier(point);
      setGameStarted(false);
      setGameEnded(true);
      setGameState((prev) => ({
        ...prev,
        gameBets: {},
        gamePlayers: {},
        crashPoint: point,
        gameStartTime: null,
        phase: "crashed",
      }));
      setHistory((prev) => {
        const newHistory = [...prev, { crashPoint: point }];
        return newHistory.length > MAX_HISTORY ? newHistory.slice(-MAX_HISTORY) : newHistory;
      });
      setCountDown(BETTING_COUNTDOWN);
      setUserGambled(false);

      playSound("crash");
    };

    const onMultiplier = (value: number) => {
      setMultiplier(value);
    };

    socket.on("crash:start", onStart);
    socket.on("crash:result", onResult);
    socket.on("crash:multiplier", onMultiplier);

    return () => {
      socket.off("crash:start", onStart);
      socket.off("crash:result", onResult);
      socket.off("crash:multiplier", onMultiplier);
    };
  }, [socket, playSound, toggleSound]);

  // ----- COUNTDOWN with requestAnimationFrame -----
  useEffect(() => {
    if (countDown <= 0 || gameStarted) {
      if (countdownRAF.current) {
        cancelAnimationFrame(countdownRAF.current);
        countdownRAF.current = null;
      }
      return;
    }

    let lastTimestamp: number | null = null;
    const step = (timestamp: number) => {
      if (!lastTimestamp) lastTimestamp = timestamp;
      const delta = (timestamp - lastTimestamp) / 1000;
      if (delta >= 0.1) {
        setCountDown((prev) => {
          const newValue = Math.max(0, prev - delta);
          return newValue;
        });
        lastTimestamp = timestamp;
      }
      if (countDown > 0) {
        countdownRAF.current = requestAnimationFrame(step);
      } else {
        countdownRAF.current = null;
      }
    };

    countdownRAF.current = requestAnimationFrame(step);

    return () => {
      if (countdownRAF.current) {
        cancelAnimationFrame(countdownRAF.current);
        countdownRAF.current = null;
      }
    };
  }, [countDown, gameStarted]);

  // ----- RENDER -----
  return (
    <div className="w-full min-h-screen bg-background px-2 py-2 sm:px-3">
      <div className="mx-auto w-full max-w-[520px] overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <GameContainer
          crashPoint={crashPoint}
          multiplier={multiplier}
          gameStarted={gameStarted}
          gameEnded={gameEnded}
          countDown={countDown}
          up={up}
          idle={idle}
          falling={falling}
          history={history}
        />
        <SideMenu
          bet={bet}
          setBet={setBet}
          cashoutAt={cashoutAt}
          setCashoutAt={setCashoutAt}
          queued={queued}
          multiplier={multiplier}
          gameStarted={gameStarted}
          handleBet={handleBet}
          handleCashout={handleCashout}
          isLogged={isLogged}
          userGambled={userGambled}
          userCashedOut={userCashedOut}
          userData={user!}
          userMultiplier={userMultiplier}
          disableButton={disableButton}
          soundEnabled={soundEnabled}
          toggleSound={toggleSound}
        />
      </div>
      <div className="mx-auto w-full max-w-[520px]">
        <LiveBets gameState={gameState} />
      </div>
    </div>
  );
};

export default CrashGame;