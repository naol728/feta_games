/* eslint-disable */
import { useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import falling from "/images/crash/falling.gif";
import idle from "/images/crash/idle.gif";
import up from "/images/crash/up.gif";

import LiveBets from "./LiveBets";
import GameContainer from "./GameContainer";
import SideMenu from "./SideMenu";

import { useAppDispatch, useAppSelector } from "@/store/hook";
import { initAuth, setUserWallet } from "@/store/slice/auth";
import { getSocket } from "@/lib/socket";

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

  // Never trust/use this while betting/running.
  // Backend should hide the real crash point.
  crashPoint: number;

  phase: "betting" | "running" | "crashed";
}

interface BetPayload {
  amount: number;
  autoCashoutAt: number | null;
}

const BETTING_COUNTDOWN = 10;

const CrashGame = () => {
  const socket = getSocket();
  const dispatch = useAppDispatch();

  // =========================
  // AUTH
  // =========================

  const user = useAppSelector((state) => state.auth.user);
  const isLogged = !!user;

  // =========================
  // LOCAL GAME STATE
  // =========================

  const [bet, setBet] = useState<number | null>(null);

  const [cashoutAt, setCashoutAt] = useState("");

  const [queued, setQueued] = useState(false);

  const [multiplier, setMultiplier] = useState(1);

  const [crashPoint, setCrashPoint] =
    useState<number | null>(null);

  const [history, setHistory] =
    useState<GameHistory[]>([]);

  const [gameStarted, setGameStarted] =
    useState(false);

  const [gameEnded, setGameEnded] =
    useState(false);

  const [countDown, setCountDown] =
    useState(0);

  const [userGambled, setUserGambled] =
    useState(false);

  const [userMultiplier, setUserMultiplier] =
    useState(0);

  const [userCashedOut, setUserCashedOut] =
    useState(false);

  const [disableButton, setDisableButton] =
    useState(false);

  const [gameState, setGameState] =
    useState<CrashGameState>({
      gameBets: {},
      gamePlayers: {},
      gameStartTime: null,
      crashPoint: 1,
      phase: "betting",
    });

  // =========================
  // QUEUED BET
  // =========================

  const queuedRef =
    useRef<BetPayload | null>(null);

  const userIdRef =
    useRef<string | undefined>(user?.id);

  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user]);

  // =========================
  // BUILD BET
  // =========================

  const buildPayload = (): BetPayload | null => {
    if (!bet || bet < 1) {
      return null;
    }

    const target = parseFloat(cashoutAt);

    return {
      amount: bet,

      autoCashoutAt:
        Number.isFinite(target) && target >= 1.01
          ? Math.round(target * 100) / 100
          : null,
    };
  };

  // =========================
  // PLACE BET
  // =========================

  const placeBet = (payload: BetPayload) => {
    if (!user) {
      toast.error("Please open the game through Telegram.");
      return;
    }

    setUserGambled(true);
    setUserCashedOut(false);

    socket.emit(
      "crash:bet",
      payload,
      (result: {
        ok?: boolean;
        error?: string;
      }) => {
        if (result?.error) {
          setUserGambled(false);
          toast.error(result.error);
          return;
        }
        if (result?.ok) {
          dispatch(initAuth()).unwrap()
        }
      }
    );
  };

  const placeBetRef =
    useRef(placeBet);

  placeBetRef.current = placeBet;

  // =========================
  // STAKE GUARD
  // =========================

  useEffect(() => {
    // Keep your existing stake guard here if needed.
  }, [
    userGambled,
    gameStarted,
    userCashedOut,
  ]);

  // =========================
  // BET BUTTON
  // =========================

  const handleBet = () => {
    if (!isLogged) {
      toast.error("Please login first.");
      return;
    }

    if (userGambled) {
      return;
    }

    if (!bet || bet < 10) {
      toast.error("Minimum Bet 10 ETB.");
      return;
    }
    const availableBalance =
      (user?.wallets?.balance ?? 0) +
      (user?.wallets?.withdrawable_balance ?? 0);
    if (availableBalance < bet) {
      toast.error("Insufficient balance.");
      return;
    }

    /*
     * If game is already running,
     * queue bet for next round.
     */

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
  };

  // =========================
  // CASHOUT
  // =========================

  const handleCashout = () => {
    if (!userGambled || userCashedOut) {
      return;
    }

    if (!gameStarted) {
      return;
    }

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

        // Update Redux wallet

        if (result?.wallet) {
          dispatch(initAuth()).unwrap();
        }
      }
    );
  };

  // =========================
  // CASHOUT SUCCESS
  // =========================

  useEffect(() => {
    const listener = (data: {
      multiplier: number;
      wallet?: {
        balance: number;
        locked_balance: number;
        withdrawable_balance: number,
        avalable_balance: number;
      };
    }) => {
      setUserMultiplier(data.multiplier);
      setUserCashedOut(true);
      setDisableButton(false);
      if (data.wallet) {
        dispatch(initAuth()).unwrap()
      }
    };

    socket.on(
      "crash:cashoutSuccess",
      listener
    );

    return () => {
      socket.off(
        "crash:cashoutSuccess",
        listener
      );
    };
  }, [socket, dispatch]);

  // =========================
  // GAME STATE
  // =========================

  useEffect(() => {
    const listener = (state: CrashGameState) => {
      setGameState(state);

      const id = userIdRef.current;

      // -------------------------
      // BETTING
      // -------------------------
      if (state.phase === "betting") {
        setGameStarted(false);
        setGameEnded(false);
        setMultiplier(1);
        setCrashPoint(null);

        // New round.
        setUserGambled(false);
        setUserCashedOut(false);
        setUserMultiplier(0);
        setDisableButton(false);

        // Submit queued bet once.
        if (queuedRef.current) {
          const payload = queuedRef.current;

          queuedRef.current = null;
          setQueued(false);

          placeBetRef.current(payload);
        }

        return;
      }

      // -------------------------
      // RUNNING
      // -------------------------
      if (state.phase === "running") {
        setGameStarted(true);
        setGameEnded(false);

        if (!id) return;

        const stake = state.gameBets?.[id];

        if (stake == null) {
          return;
        }

        const player = state.gamePlayers?.[id];

        setUserGambled(true);

        if (player?.payout != null) {
          setUserCashedOut(true);

          setUserMultiplier(
            player.payout / stake
          );
        }

        return;
      }

      // -------------------------
      // CRASHED
      // -------------------------
      if (state.phase === "crashed") {
        setGameStarted(false);
        setGameEnded(true);
      }
    };

    socket.on("crash:gameState", listener);

    return () => {
      socket.off("crash:gameState", listener);
    };
  }, [socket]);



  useEffect(() => {
    const listener = (sync: Partial<CrashGameState>) => {
      const phase = sync.phase ?? "betting";

      setGameState({
        gameBets: sync.gameBets ?? {},
        gamePlayers: sync.gamePlayers ?? {},
        crashPoint: 1,
        gameStartTime: sync.gameStartTime ?? null,
        phase,
      });

      if (phase === "running") {
        setGameStarted(true);
        setGameEnded(false);
      }

      if (phase === "betting") {
        setGameStarted(false);
        setGameEnded(false);
      }

      if (phase === "crashed") {
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

        setUserMultiplier(
          player.payout / stake
        );
      }
    };

    socket.on("crash:sync", listener);

    socket.emit("crash:requestState");

    return () => {
      socket.off("crash:sync", listener);
    };
  }, [socket]);



  useEffect(() => {
    const startListener = () => {
      setMultiplier(1);
      setCrashPoint(null);

      setGameStarted(true);
      setGameEnded(false);

      setUserCashedOut(false);
      setUserMultiplier(0);

      setCountDown(0);
    };

    const resultListener = (
      point: number
    ) => {
      setCrashPoint(point);

      setMultiplier(point);

      setGameStarted(false);
      setGameEnded(true);

      setGameState({
        gameBets: {},
        gamePlayers: {},
        crashPoint: point,
        gameStartTime: null,
        phase: "crashed",
      });

      setHistory((prev) => [
        ...prev,
        {
          crashPoint: point,
        },
      ]);

      setCountDown(
        BETTING_COUNTDOWN
      );
      setUserGambled(false);
    };

    socket.on(
      "crash:start",
      startListener
    );

    socket.on(
      "crash:result",
      resultListener
    );

    return () => {
      socket.off(
        "crash:start",
        startListener
      );

      socket.off(
        "crash:result",
        resultListener
      );
    };
  }, [socket]);



  useEffect(() => {
    const listener = (
      value: number
    ) => {
      setMultiplier(value);
    };

    socket.on(
      "crash:multiplier",
      listener
    );

    return () => {
      socket.off(
        "crash:multiplier",
        listener
      );
    };
  }, [socket]);

  // =========================
  // COUNTDOWN
  // =========================

  useEffect(() => {
    if (
      countDown <= 0 ||
      gameStarted
    ) {
      return;
    }

    const timer = setInterval(() => {
      setCountDown((value) =>
        Math.max(0, value - 0.1)
      );
    }, 100);

    return () => clearInterval(timer);
  }, [countDown, gameStarted]);

  // =========================
  // UI
  // =========================

  return (
    <div className="w-full min-h-screen bg-background px-2 py-2 sm:px-3">

      <div className="
        mx-auto
        w-full
        max-w-[520px]
        overflow-hidden
        rounded-xl
        border
        border-border
        bg-card
        shadow-sm
      ">

        {/* GAME GRAPH */}

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

        {/* BETTING PANEL */}

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
        />

      </div >

      {/* LIVE BETS */}

      <div className="mx-auto  w-full max-w-[520px]" >
        <LiveBets
          gameState={gameState}
        />
      </div>

    </div >
  );
};

export default CrashGame;