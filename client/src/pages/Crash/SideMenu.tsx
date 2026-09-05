/* eslint-disable */
import React, { useMemo, useCallback } from "react";
import { AiFillCaretDown, AiFillCaretUp } from "react-icons/ai";

import Monetary from "../../components/Monetary";
import BetAmount from "../../components/game/BetAmount";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { User } from "@/store/slice/auth";

// ======================== TYPES ========================

interface SideMenuProps {
  bet: number | null;
  setBet: (value: number | null) => void;
  cashoutAt: string;
  setCashoutAt: (value: string) => void;
  queued: boolean;
  multiplier: number;
  gameStarted: boolean;
  handleBet: () => void;
  handleCashout: () => void;
  isLogged: boolean;
  userGambled: boolean;
  userCashedOut: boolean;
  userData: User;
  userMultiplier: number;
  disableButton: boolean;
}

const MAX_BET = 1_000_000;
const MIN_BET = 10;

// ======================== COMPONENT ========================

const SideMenu: React.FC<SideMenuProps> = React.memo(({
  bet,
  setBet,
  cashoutAt,
  setCashoutAt,
  queued,
  multiplier,
  gameStarted,
  handleBet,
  handleCashout,
  isLogged,
  userGambled,
  userCashedOut,
  userData,
  userMultiplier,
  disableButton,
}) => {
  // ----- MEMOIZED DERIVED VALUES -----
  const target = useMemo(() => parseFloat(cashoutAt), [cashoutAt]);
  const hasTarget = useMemo(
    () => Number.isFinite(target) && target >= 1.01,
    [target]
  );

  const inRound = useMemo(
    () => userGambled && gameStarted && !userCashedOut,
    [userGambled, gameStarted, userCashedOut]
  );

  const profit = useMemo(() => {
    const base = bet ?? 0;
    if (inRound) {
      return base * multiplier - base;
    }
    if (hasTarget) {
      return base * target - base;
    }
    return 0;
  }, [bet, inRound, multiplier, hasTarget, target]);

  const availableBalance = useMemo(
    () => userData?.wallets?.available_balance ?? 0,
    [userData]
  );

  const invalidBet = useMemo(
    () =>
      !bet ||
      bet < MIN_BET ||
      bet > MAX_BET ||
      availableBalance < bet,
    [bet, availableBalance]
  );

  // ----- STABLE CALLBACKS -----
  const stepTarget = useCallback(
    (dir: 1 | -1) => {
      if (!hasTarget) {
        setCashoutAt("2.00");
        return;
      }
      const next = Math.max(1.01, Math.round((target + dir * 0.5) * 100) / 100);
      setCashoutAt(next.toFixed(2));
    },
    [hasTarget, target, setCashoutAt]
  );

  const handleBetClick = useCallback(() => {
    if (queued) {
      handleBet(); // cancels queue
      return;
    }
    if (userGambled && gameStarted) {
      handleCashout();
      return;
    }
    handleBet();
  }, [queued, userGambled, gameStarted, handleBet, handleCashout]);

  // ----- MEMOIZED BUTTON TEXT -----
  const buttonText = useMemo(() => {
    if (!isLogged) return "Sign in to play";

    if (queued) return "Queued • Cancel";

    if (userCashedOut && gameStarted) {
      return `Cashed out at ${userMultiplier.toFixed(2)}x`;
    }

    if (userGambled) {
      return gameStarted
        ? `Cash Out ${(profit + (bet ?? 0)).toFixed(2)}`
        : "You're in!";
    }

    if (!bet || bet < MIN_BET) return "Enter bet amount";
    if (bet > MAX_BET) return "Max bet is 1M";
    if (availableBalance < bet) return "Not enough balance";
    if (gameStarted) return "Bet Next Round";

    return "Place Bet";
  }, [
    isLogged,
    queued,
    userCashedOut,
    gameStarted,
    userMultiplier,
    userGambled,
    profit,
    bet,
    availableBalance,
  ]);

  // ----- DISABLE STATE -----
  const inputsDisabled = useMemo(
    () => disableButton || (userGambled && (!gameStarted || userCashedOut)),
    [disableButton, userGambled, gameStarted, userCashedOut]
  );

  const actionDisabled = useMemo(() => {
    if (disableButton) return true;
    if (!isLogged) return true;
    if (queued) return false; // queued bet can be cancelled
    if (userGambled) {
      // If in round, cashout button is active
      return !gameStarted || userCashedOut;
    }
    // Not gambled: must have valid bet
    return invalidBet;
  }, [disableButton, isLogged, queued, userGambled, gameStarted, userCashedOut, invalidBet]);

  // ----- BUTTON STYLE (Aviator‑like) -----
  const buttonClass = useMemo(() => {
    let base =
      "h-10 w-full rounded-md border-0 shadow-none text-[11px] font-bold uppercase tracking-wide transition-transform active:scale-[0.98]";

    if (userGambled && gameStarted) {
      // Cashout button – green
      base += " bg-green-500 text-white hover:bg-green-600";
    } else if (queued) {
      // Queued – yellow
      base += " bg-yellow-500 text-black hover:bg-yellow-600";
    } else {
      // Default bet – amber (Aviator orange)
      base += " bg-amber-400 text-black hover:bg-amber-500";
    }

    if (actionDisabled) {
      base += " disabled:cursor-not-allowed disabled:opacity-40";
    }

    return base;
  }, [userGambled, gameStarted, queued, actionDisabled]);

  // =========================
  // RENDER
  // =========================
  return (
    <Card
      className="
        w-full
        rounded-none
        border-x-0
        border-b-0
        border-t
        border-border/60
        bg-card
        p-0
        shadow-none
        sm:rounded-xl
        sm:border
      "
    >
      <div className="flex w-full flex-col gap-2 p-2">
        {/* ---- BET AMOUNT ---- */}
        <section className="space-y-1">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Bet Amount
            </span>
            <span className="text-[10px] text-muted-foreground">
              Balance:{" "}
              <span className="font-medium text-foreground/80">
                <Monetary value={availableBalance} showFraction />
              </span>
            </span>
          </div>
          <div className="overflow-hidden rounded-md border border-border/70 bg-muted/30">
            <BetAmount
              value={bet === null ? "" : String(bet)}
              onChange={(value) =>
                setBet(value === "" ? null : Math.min(MAX_BET, Number(value)))
              }
              onHalve={() => setBet(Math.max(1, Math.floor((bet || 0) / 2)))}
              onDouble={() => setBet(Math.min(MAX_BET, (bet || 1) * 2))}
              onMax={() => setBet(Math.min(MAX_BET, userData?.wallets?.balance ?? MAX_BET))}
              betValue={bet || 0}
              disabled={inputsDisabled}
            />
          </div>
        </section>

        {/* ---- AUTO CASHOUT ---- */}
        <section className="space-y-1">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Auto Cash Out
            </span>
            <span
              className={cn(
                "text-[10px] font-semibold",
                hasTarget ? "text-amber-400" : "text-muted-foreground/50"
              )}
            >
              {hasTarget ? `x${target.toFixed(2)} ` : "OFF"}
            </span>
          </div>
          <div className="flex h-8 w-full">
            <Input
              type="text"
              inputMode="decimal"
              value={cashoutAt}
              placeholder="Off"
              onChange={(e) =>
                setCashoutAt(e.target.value.replace(/[^0-9.]/g, ""))
              }
              className="
                h-8
                min-w-0
                flex-1
                rounded-r-none
                border-border/70
                bg-muted/30
                px-2
                text-xs
                font-medium
                focus-visible:z-10
                focus-visible:ring-1
                focus-visible:ring-amber-400/70
              "
            />
            <Button
              type="button"
              variant="outline"
              onClick={() => stepTarget(-1)}
              disabled={inputsDisabled}
              className="
                h-8
                w-8
                shrink-0
                rounded-none
                border-l-0
                border-border/70
                bg-muted/30
                p-0
                text-muted-foreground
                hover:bg-muted
                hover:text-foreground
              "
            >
              <AiFillCaretDown size={10} />
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => stepTarget(1)}
              disabled={inputsDisabled}
              className="
                h-8
                w-8
                shrink-0
                rounded-l-none
                border-l-0
                border-border/70
                bg-muted/30
                p-0
                text-muted-foreground
                hover:bg-muted
                hover:text-foreground
              "
            >
              <AiFillCaretUp size={10} />
            </Button>
          </div>
        </section>

        {/* ---- MAIN ACTION BUTTON ---- */}
        <Button
          type="button"
          onClick={handleBetClick}
          disabled={actionDisabled}
          className={buttonClass}
        >
          {buttonText}
        </Button>

        {/* ---- CASHOUT RESULT ---- */}
        {userCashedOut && (
          <div
            className="
              flex
              items-center
              justify-center
              rounded-md
              border
              border-green-500/10
              bg-green-500/10
              px-2
              py-1.5
              text-[10px]
              font-medium
              text-green-400
            "
          >
            <span className="mr-1">✓</span>
            Cashed out at {userMultiplier.toFixed(2)}x
          </div>
        )}
      </div>
    </Card>
  );
});

SideMenu.displayName = "SideMenu";

export default SideMenu;