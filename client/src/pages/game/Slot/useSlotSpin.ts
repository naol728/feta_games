/* eslint-disable */

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "react-toastify";

import { type SlotProps } from "./Types";
import { useAppDispatch, useAppSelector } from "@/store/hook";
import { setUserWallet } from "@/store/slice/auth";
import { getSocket } from "@/lib/socket";
import type { Wallet } from "@/types/crash";

export const MIN_BET = 1;
export const MAX_BET = 50_000;
export const AUTO_SPIN_DELAY_MS = 800;
export const SPIN_ANIMATION_DURATION_MS = 3_000;
export const BIG_WIN_MULTIPLIER = 8;

export type BetChangeType = "add" | "subtract";

interface SlotSpinLineResult {
  line: SlotProps["lastSpinResult"][number]["line"];
}

interface SlotSpinResult extends SlotProps {
  success: boolean;
  message?: string;
  wallet: Wallet;
}

interface SlotSpinPayload {
  betAmount: number;
}

interface UseSlotSpinArgs {
  onWin: () => void;
  onBigWin: () => void;
}

/**
 * Owns every piece of state related to placing a spin: the bet
 * amount, the pending/animating flags, the socket round-trip, the
 * auto-spin loop, and the running win total.
 *
 * IMPORTANT TIMING NOTE: the server ack usually comes back in well
 * under a second, but the reels take up to ~2.8s to visually land.
 * So `data` from the server is split into two phases:
 *   1. Immediately on ack: update `grid`/`winningLines` only — this
 *      is what SlotColumn animates *toward*, it must be set right
 *      away or the reels have nothing to land on.
 *   2. After SPIN_ANIMATION_DURATION_MS (i.e. once the reels have
 *      actually stopped): everything the player perceives as "the
 *      result" — wallet balance, win/big-win sound+popup, the
 *      losing streak, and the total-wins counter. This is the one
 *      and only timer driving the reveal, so nothing can leak early.
 */
export const useSlotSpin = ({ onWin, onBigWin }: UseSlotSpinArgs) => {
  const dispatch = useAppDispatch();
  const socket = getSocket();
  const user = useAppSelector((state) => state.auth?.user);

  const [response, setResponse] = useState<SlotSpinResult | null>(null);
  const [grid, setGrid] = useState<string[]>([]);
  const [betAmount, setBetAmount] = useState<number>(10);
  const [isSpinning, setIsSpinning] = useState<boolean>(false);
  const [isSpinPending, setIsSpinPending] = useState<boolean>(false);
  const [winningLines, setWinningLines] = useState<SlotSpinLineResult["line"]>(
    [],
  );
  const [totalWins, setTotalWins] = useState<number>(0);
  const [lostStreak, setLostStreak] = useState<number>(0);
  const [isAutoSpin, setIsAutoSpin] = useState<boolean>(false);

  const isMountedRef = useRef<boolean>(true);
  const autoSpinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stopSpinTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;

    return () => {
      isMountedRef.current = false;

      if (autoSpinTimeoutRef.current) {
        clearTimeout(autoSpinTimeoutRef.current);
      }

      if (stopSpinTimeoutRef.current) {
        clearTimeout(stopSpinTimeoutRef.current);
      }
    };
  }, []);

  const emitSpin = useCallback(
    (amount: number): void => {
      setIsSpinPending(true);

      const payload: SlotSpinPayload = { betAmount: amount };

      socket.emit("slots:spin", payload, (data: SlotSpinResult): void => {
        if (!isMountedRef.current) {
          return;
        }

        setIsSpinPending(false);

        if (!data?.success) {
          toast.error(data?.message ?? "Error spinning slots");
          setIsSpinning(false);
          return;
        }

        // Phase 1 — give the reels a real target immediately. This is
        // NOT the reveal: SlotColumn only shows win treatment once
        // isSpinning is false, so this alone doesn't spoil anything.
        setResponse(data);
        setGrid(data.gridState);
        setWinningLines(
          data.lastSpinResult.map((result: SlotSpinLineResult) => result.line),
        );

        const totalPayout = data.totalPayout;

        // Phase 2 — everything the player should experience as "the
        // result" waits for the reels to actually finish landing.
        stopSpinTimeoutRef.current = setTimeout(() => {
          if (!isMountedRef.current) {
            return;
          }

          setIsSpinning(false);
          setTotalWins(totalPayout);
          setLostStreak((previous) => (totalPayout === 0 ? previous + 1 : 0));

          if (data.wallet) {
            dispatch(setUserWallet(data.wallet));
          }

          if (totalPayout >= amount * BIG_WIN_MULTIPLIER) {
            onBigWin();
          } else if (totalPayout > 0) {
            onWin();
          }
        }, SPIN_ANIMATION_DURATION_MS);
      });
    },
    [socket, dispatch, onBigWin, onWin],
  );

  const spin = useCallback((): void => {
    if (!user) {
      toast.error("Please login first.");
      return;
    }

    const availableBalance = Number(user.wallets.available_balance);

    if (!Number.isFinite(availableBalance)) {
      toast.error("Unable to read wallet balance.");
      return;
    }

    if (availableBalance < betAmount) {
      toast.error("Insufficient funds");
      return;
    }

    if (isSpinPending || isSpinning) {
      return;
    }

    setIsSpinning(true);
    setTotalWins(0);

    emitSpin(betAmount);
  }, [user, betAmount, isSpinPending, isSpinning, emitSpin]);

  // Auto-spin loop.
  useEffect(() => {
    if (!isAutoSpin || !user || isSpinPending || isSpinning) {
      return;
    }

    autoSpinTimeoutRef.current = setTimeout(spin, AUTO_SPIN_DELAY_MS);

    return () => {
      if (autoSpinTimeoutRef.current) {
        clearTimeout(autoSpinTimeoutRef.current);
        autoSpinTimeoutRef.current = null;
      }
    };
  }, [isAutoSpin, user, isSpinning, isSpinPending, spin]);

  const changeBet = useCallback((type: BetChangeType): void => {
    setBetAmount((previous) => {
      const next =
        type === "subtract" ? Math.floor(previous / 2) : previous * 2;

      return next >= MIN_BET && next <= MAX_BET ? next : previous;
    });
  }, []);

  const toggleAutoSpin = useCallback((): void => {
    setIsAutoSpin((previous) => !previous);
  }, []);

  return {
    response,
    grid,
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
  };
};
