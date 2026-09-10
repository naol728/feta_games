/* eslint-disable */
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { toast } from "react-toastify";

import falling from "/images/crash/falling.gif";
import idle from "/images/crash/idle.gif";
import up from "/images/crash/up.gif";

import LiveBets from "./LiveBets";
import GameContainer from "./GameContainer";
import SideMenu from "./SideMenu";

import { useAppDispatch, useAppSelector } from "@/store/hook";
import { setUserWallet } from "@/store/slice/auth";
import { getSocket } from "@/lib/socket";

import {
  decodeBetBatch,
  decodeCashoutBatch,
  decodeCrash,
  decodeMultiplierTick,
  decodeRoundStart,
  decodeSync,
} from "@/lib/crashProtocol";

import type {
  BetPayload,
  CrashGameState,
  CrashPlayer,
  GameHistoryEntry,
  Wallet,
} from "./../../types/crash";

const BETTING_COUNTDOWN = 10;
const MAX_HISTORY = 50;
const MIN_BET = 10;
const MAX_BET = 1_000_000;

/* ============================================================
   ROUND REDUCER
   Everything that changes together on a socket event lives in
   one state slot -> one re-render per event instead of up to 6.
============================================================ */

interface RoundState {
  game: CrashGameState;
  multiplier: number;
  crashPoint: number | null;
  history: GameHistoryEntry[];
  gameStarted: boolean;
  gameEnded: boolean;
  countDown: number;
  userGambled: boolean;
  userMultiplier: number;
  userCashedOut: boolean;
  disableButton: boolean;
}

type RoundAction =
  | { type: "SYNC"; phase: CrashGameState["phase"]; roundNumber: number; gameStartTime: number | null }
  | { type: "ROUND_RESET" } // fresh betting phase, backend cleared round state
  | { type: "ROUND_START"; roundNumber: number; gameStartTime: number }
  | { type: "BET_BATCH_MERGE"; players: CrashGameState["players"]; userToPlayer: CrashGameState["userToPlayer"] }
  | { type: "MARK_GAMBLED" }
  | { type: "CASHOUT_BATCH_MERGE"; players: CrashGameState["players"] }
  | { type: "SELF_CASHED_OUT"; multiplier: number }
  | { type: "CRASH"; point: number }
  | { type: "MULTIPLIER_TICK"; value: number }
  | { type: "COUNTDOWN_TICK"; value: number }
  | { type: "PLACE_BET_START" }
  | { type: "PLACE_BET_FAILED" }
  | { type: "SEED_SELF_PLAYER"; playerId: number; player: CrashPlayer; userId: string }
  | { type: "CASHOUT_START" }
  | { type: "CASHOUT_FAILED" };

const DEFAULT_GAME_STATE: CrashGameState = {
  players: {},
  userToPlayer: {},
  gameStartTime: null,
  crashPoint: null,
  roundNumber: 0,
  phase: "betting",
};

const initialRoundState: RoundState = {
  game: DEFAULT_GAME_STATE,
  multiplier: 1,
  crashPoint: null,
  history: [],
  gameStarted: false,
  gameEnded: false,
  countDown: 0,
  userGambled: false,
  userMultiplier: 0,
  userCashedOut: false,
  disableButton: false,
};

function roundReducer(state: RoundState, action: RoundAction): RoundState {
  switch (action.type) {
    case "SYNC": {
      const next: RoundState = {
        ...state,
        game: {
          ...state.game,
          phase: action.phase,
          roundNumber: action.roundNumber,
          gameStartTime: action.gameStartTime,
        },
      };

      if (action.phase === "running") {
        next.gameStarted = true;
        next.gameEnded = false;
        next.countDown = 0;
      }
      if (action.phase === "betting") {
        next.gameStarted = false;
        next.gameEnded = false;
        next.game = { ...next.game, players: {}, userToPlayer: {} };
      }
      if (action.phase === "crashed") {
        next.gameStarted = false;
        next.gameEnded = true;
      }
      return next;
    }

    case "ROUND_START":
      return {
        ...state,
        multiplier: 1,
        crashPoint: null,
        gameStarted: true,
        gameEnded: false,
        countDown: 0,
        userCashedOut: false,
        userMultiplier: 0,
        disableButton: false,
        game: {
          ...state.game,
          phase: "running",
          roundNumber: action.roundNumber,
          gameStartTime: action.gameStartTime,
          crashPoint: null,
        },
      };

    case "BET_BATCH_MERGE":
      return {
        ...state,
        game: { ...state.game, players: action.players, userToPlayer: action.userToPlayer },
      };

    case "MARK_GAMBLED":
      return state.userGambled ? state : { ...state, userGambled: true };

    case "CASHOUT_BATCH_MERGE":
      return { ...state, game: { ...state.game, players: action.players } };

    case "SELF_CASHED_OUT":
      return { ...state, userCashedOut: true, userMultiplier: action.multiplier };

    case "CRASH":
      return {
        ...state,
        crashPoint: action.point,
        multiplier: action.point,
        gameStarted: false,
        gameEnded: true,
        countDown: BETTING_COUNTDOWN,
        userGambled: false,
        userCashedOut: false,
        disableButton: false,
        game: { ...state.game, phase: "crashed", crashPoint: action.point, gameStartTime: null },
        history:
          state.history.length >= MAX_HISTORY
            ? [...state.history.slice(1), { crashPoint: action.point }]
            : [...state.history, { crashPoint: action.point }],
      };

    case "MULTIPLIER_TICK":
      return state.multiplier === action.value ? state : { ...state, multiplier: action.value };

    case "COUNTDOWN_TICK":
      return { ...state, countDown: action.value };

    case "PLACE_BET_START":
      return { ...state, userGambled: true, userCashedOut: false, disableButton: false };

    case "PLACE_BET_FAILED":
      return { ...state, userGambled: false };

    case "SEED_SELF_PLAYER": {
      if (state.game.players[action.playerId]) return state; // no-op, batch already has it
      return {
        ...state,
        game: {
          ...state.game,
          players: { ...state.game.players, [action.playerId]: action.player },
          userToPlayer: { ...state.game.userToPlayer, [action.userId]: action.playerId },
        },
      };
    }

    case "CASHOUT_START":
      return { ...state, disableButton: true };

    case "CASHOUT_FAILED":
      return { ...state, disableButton: false };

    default:
      return state;
  }
}

/* ============================================================
   COMPONENT
============================================================ */

export default function CrashGame() {
  const socket = getSocket();
  const dispatch = useAppDispatch();
  const user = useAppSelector((state) => state.auth?.user);

  const [round, roundDispatch] = useReducer(roundReducer, initialRoundState);

  const [bet, setBet] = useState<number | null>(null);
  const [cashoutAt, setCashoutAt] = useState("");
  const [queued, setQueued] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);

  const userIdRef = useRef<string | undefined>(user?.id);
  const queuedBetRef = useRef<BetPayload | null>(null);
  const countdownRAF = useRef<number | null>(null);
  const soundsRef = useRef<Record<string, HTMLAudioElement>>({});
  const roundRef = useRef(round);

  useEffect(() => {
    roundRef.current = round;
  }, [round]);

  useEffect(() => {
    userIdRef.current = user?.id;
  }, [user]);

  /* ---- sounds ---- */
  useEffect(() => {
    const names = ["crashfly", "crash", "click", "cashout"];
    names.forEach((name) => {
      const audio = new Audio(`/sounds/${name}.mp3`);
      audio.preload = "auto";
      if (name === "crashfly") {
        audio.loop = true;
        audio.volume = 0.35;
      }
      soundsRef.current[name] = audio;
    });
    return () => {
      Object.values(soundsRef.current).forEach((audio) => {
        audio.pause();
        audio.currentTime = 0;
      });
      soundsRef.current = {};
    };
  }, []);

  const playSound = useCallback(
    (name: string) => {
      if (!soundEnabled) return;
      const audio = soundsRef.current[name];
      if (!audio) return;
      audio.currentTime = 0;
      audio.play().catch(() => { });
    },
    [soundEnabled]
  );

  const startFlySound = useCallback(() => {
    if (!soundEnabled) return;
    soundsRef.current.crashfly?.play().catch(() => { });
  }, [soundEnabled]);

  const stopFlySound = useCallback(() => {
    const audio = soundsRef.current.crashfly;
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
  }, []);

  useEffect(() => {
    if (round.gameStarted) startFlySound();
    else stopFlySound();
    return () => stopFlySound();
  }, [round.gameStarted, startFlySound, stopFlySound]);

  const toggleSound = useCallback(() => {
    setSoundEnabled((previous) => {
      const next = !previous;
      const audio = soundsRef.current.crashfly;
      if (audio) {
        if (next && roundRef.current.gameStarted) audio.play().catch(() => { });
        else {
          audio.pause();
          audio.currentTime = 0;
        }
      }
      return next;
    });
  }, []);

  /* ---- derived ---- */
  const availableBalance = useMemo(() => {
    if (!user?.wallets) return 0;
    return (user.wallets.balance ?? 0) + (user.wallets.withdrawable_balance ?? 0);
  }, [user?.wallets]);

  const buildPayload = useCallback((): BetPayload | null => {
    if (!bet || !Number.isFinite(bet)) return null;
    const target = parseFloat(cashoutAt);
    const autoCashoutAt = Number.isFinite(target) && target >= 1.01 ? Math.round(target * 100) / 100 : null;
    return { amount: Math.round(bet * 100) / 100, autoCashoutAt };
  }, [bet, cashoutAt]);

  const placeBet = useCallback(
    (payload: BetPayload) => {
      if (!user) {
        toast.error("Please login first.");
        return;
      }

      roundDispatch({ type: "PLACE_BET_START" });

      socket.emit("crash:bet", payload, (result: any) => {
        if (!result || result.error) {
          roundDispatch({ type: "PLACE_BET_FAILED" });
          toast.error(result?.error ?? "Could not place bet.");
          return;
        }

        if (typeof result.playerId === "number") {
          roundDispatch({
            type: "SEED_SELF_PLAYER",
            playerId: result.playerId,
            userId: user.id,
            player: {
              playerId: result.playerId,
              userId: user.id,
              username: user.username ?? user.Fname ?? "You",
              payout: null,
              betAmount: payload.amount,
            },
          });
        }

        if (result.wallet) dispatch(setUserWallet(result.wallet));
        playSound("click");
      });
    },
    [socket, user, dispatch, playSound]
  );

  const handleBet = useCallback(() => {
    if (!user) {
      toast.error("Please login first.");
      return;
    }
    if (round.userGambled) return;
    if (!bet || bet < MIN_BET) {
      toast.error(`Minimum bet is ${MIN_BET} ETB.`);
      return;
    }
    if (bet > MAX_BET) {
      toast.error(`Maximum bet is ${MAX_BET.toLocaleString()} ETB.`);
      return;
    }
    if (availableBalance < bet) {
      toast.error("Insufficient balance.");
      return;
    }

    const payload = buildPayload();
    if (!payload) return;

    if (round.gameStarted) {
      if (queuedBetRef.current) {
        queuedBetRef.current = null;
        setQueued(false);
        toast.info("Queued bet cancelled.");
      } else {
        queuedBetRef.current = payload;
        setQueued(true);
        toast.info("Bet queued for next round.");
      }
      return;
    }

    placeBet(payload);
  }, [user, round.userGambled, round.gameStarted, bet, availableBalance, buildPayload, placeBet]);

  const handleCashout = useCallback(() => {
    if (!round.userGambled || round.userCashedOut || !round.gameStarted) return;

    roundDispatch({ type: "CASHOUT_START" });

    socket.emit("crash:cashout", (result:any) => {
      if (!result || result.error) {
        roundDispatch({ type: "CASHOUT_FAILED" });
        toast.error(result?.error ?? "Cashout failed.");
        return;
      }

      if (typeof result.multiplier === "number") {
        roundDispatch({ type: "SELF_CASHED_OUT", multiplier: result.multiplier });
      }
      roundDispatch({ type: "CASHOUT_FAILED" }); // clears disableButton; harmless re-use
      if (result.wallet) dispatch(setUserWallet(result.wallet));
      playSound("cashout");
    });
  }, [socket, round.userGambled, round.userCashedOut, round.gameStarted, dispatch, playSound]);

  /* ---- socket listeners ---- */
  useEffect(() => {
    const handleSync = (data: unknown) => {
      const decoded = decodeSync(data);
      if (!decoded) return console.warn("Invalid crash sync packet");
      roundDispatch({ type: "SYNC", ...decoded });
    };
    socket.on("crash:sync", handleSync);
    socket.emit("crash:requestState");
    return () => void socket.off("crash:sync", handleSync);
  }, [socket]);

  useEffect(() => {
    const handleRoundStart = (data: unknown) => {
      const decoded = decodeRoundStart(data);
      if (!decoded) return console.warn("Invalid crash start packet");
      roundDispatch({ type: "ROUND_START", ...decoded });
    };
    socket.on("crash:start", handleRoundStart);
    return () => void socket.off("crash:start", handleRoundStart);
  }, [socket]);

  useEffect(() => {
    const handleBetBatch = (data: unknown) => {
      const entries = decodeBetBatch(data);
      if (!entries || !entries.length) return;

      const currentUserId = userIdRef.current;
      const { players: prevPlayers, userToPlayer: prevMap } = roundRef.current.game;
      let players = prevPlayers;
      let userToPlayer = prevMap;
      let changed = false;

      for (const decoded of entries) {
        if (players[decoded.playerId]) continue;
        const isSelf = currentUserId !== undefined && prevMap[currentUserId] === decoded.playerId;

        if (!changed) {
          players = { ...players };
          userToPlayer = { ...userToPlayer };
          changed = true;
        }

        players[decoded.playerId] = {
          playerId: decoded.playerId,
          userId: isSelf ? currentUserId ?? "" : "",
          username: isSelf ? user?.username ?? user?.Fname ?? "You" : "Player",
          payout: null,
          betAmount: decoded.amount,
        };
      }

      if (changed) roundDispatch({ type: "BET_BATCH_MERGE", players, userToPlayer });

      const selfPlayerId = currentUserId ? prevMap[currentUserId] : undefined;
      if (selfPlayerId !== undefined && entries.some((e) => e.playerId === selfPlayerId)) {
        roundDispatch({ type: "MARK_GAMBLED" });
      }
    };
    socket.on("crash:bets", handleBetBatch);
    return () => void socket.off("crash:bets", handleBetBatch);
  }, [socket, user]);

  useEffect(() => {
    const handleCashoutBatch = (data: unknown) => {
      const entries = decodeCashoutBatch(data);
      if (!entries || !entries.length) return;

      const prevPlayers = roundRef.current.game.players;
      let players = prevPlayers;
      let changed = false;

      for (const decoded of entries) {
        const player = players[decoded.playerId];
        if (!player) continue;
        if (!changed) {
          players = { ...players };
          changed = true;
        }
        players[decoded.playerId] = { ...player, payout: decoded.multiplier };
      }

      if (changed) roundDispatch({ type: "CASHOUT_BATCH_MERGE", players });

      const currentUserId = userIdRef.current;
      const selfPlayerId = currentUserId ? roundRef.current.game.userToPlayer[currentUserId] : undefined;
      if (selfPlayerId !== undefined) {
        const own = entries.find((e) => e.playerId === selfPlayerId);
        if (own) roundDispatch({ type: "SELF_CASHED_OUT", multiplier: own.multiplier });
      }
    };
    socket.on("crash:cashouts", handleCashoutBatch);
    return () => void socket.off("crash:cashouts", handleCashoutBatch);
  }, [socket]);

  useEffect(() => {
    const handleCrash = (data: unknown) => {
      const point = decodeCrash(data);
      if (point === null) return console.warn("Invalid crash packet");
      roundDispatch({ type: "CRASH", point });
      playSound("crash");
    };
    socket.on("crash:crash", handleCrash);
    return () => void socket.off("crash:crash", handleCrash);
  }, [socket, playSound]);

  useEffect(() => {
    const handleMultiplier = (data: unknown) => {
      const value = decodeMultiplierTick(data);
      if (value === null) return;
      roundDispatch({ type: "MULTIPLIER_TICK", value });
    };
    socket.on("crash:multiplier", handleMultiplier);
    return () => void socket.off("crash:multiplier", handleMultiplier);
  }, [socket]);

  useEffect(() => {
    const handleWallet = (wallet: Wallet) => {
      if (!wallet) return;
      dispatch(setUserWallet(wallet));
    };
    socket.on("crash:wallet", handleWallet);
    return () => void socket.off("crash:wallet", handleWallet);
  }, [socket, dispatch]);

  /* ---- countdown (rAF, unchanged in spirit) ---- */
  useEffect(() => {
    if (round.countDown <= 0 || round.gameStarted) {
      if (countdownRAF.current) {
        cancelAnimationFrame(countdownRAF.current);
        countdownRAF.current = null;
      }
      return;
    }

    let lastTimestamp: number | null = null;

    const update = (timestamp: number) => {
      if (lastTimestamp === null) lastTimestamp = timestamp;
      const delta = (timestamp - lastTimestamp) / 1000;
      if (delta >= 0.1) {
        roundDispatch({ type: "COUNTDOWN_TICK", value: Math.max(0, roundRef.current.countDown - delta) });
        lastTimestamp = timestamp;
      }
      countdownRAF.current = requestAnimationFrame(update);
    };

    countdownRAF.current = requestAnimationFrame(update);
    return () => {
      if (countdownRAF.current) {
        cancelAnimationFrame(countdownRAF.current);
        countdownRAF.current = null;
      }
    };
  }, [round.countDown, round.gameStarted]);

  /* ---- auto-fire queued bet on next betting phase ---- */
  useEffect(() => {
    if (round.game.phase !== "betting" || !queuedBetRef.current) return;

    const payload = queuedBetRef.current;
    queuedBetRef.current = null;
    setQueued(false);

    const timer = window.setTimeout(() => placeBet(payload), 50);
    return () => window.clearTimeout(timer);
  }, [round.game.phase, placeBet]);

  /* ---- render ---- */
  return (
    <div className="min-h-screen w-full bg-[radial-gradient(ellipse_at_top,_#1b1330_0%,_#0a0714_60%,_#050308_100%)] px-2 py-2 sm:px-3">
      <div className="mx-auto w-full max-w-[520px] overflow-hidden rounded-2xl border border-violet-500/20 bg-[#0f0a1e] shadow-[0_0_40px_-8px_rgba(168,85,247,0.35)]">
        <GameContainer
          crashPoint={round.crashPoint}
          multiplier={round.multiplier}
          gameStarted={round.gameStarted}
          gameEnded={round.gameEnded}
          countDown={round.countDown}
          up={up}
          idle={idle}
          falling={falling}
          history={round.history}
        />

        <SideMenu
          bet={bet}
          setBet={setBet}
          cashoutAt={cashoutAt}
          setCashoutAt={setCashoutAt}
          queued={queued}
          multiplier={round.multiplier}
          gameStarted={round.gameStarted}
          handleBet={handleBet}
          handleCashout={handleCashout}
          isLogged={!!user}
          userGambled={round.userGambled}
          userCashedOut={round.userCashedOut}
          userData={user}
          userMultiplier={round.userMultiplier}
          disableButton={round.disableButton}
          soundEnabled={soundEnabled}
          toggleSound={toggleSound}
        />
      </div>

      <div className="mx-auto w-full max-w-[520px]">
        <LiveBets gameState={round.game} />
      </div>
    </div>
  );
}