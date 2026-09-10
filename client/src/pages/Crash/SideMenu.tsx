/* eslint-disable */

import React, { useMemo, useCallback } from "react";
import { AiFillCaretDown, AiFillCaretUp } from "react-icons/ai";
import { Volume2, VolumeX, Rocket } from "lucide-react";

import Monetary from "../../components/Monetary";
import BetAmount from "../../components/game/BetAmount";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { User } from "@/store/slice/auth";
import type { ActionState, ActionVariant } from "./../../types/crash";

const MAX_BET = 1_000_000;
const MIN_BET = 10;

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
  userData?: User ;
  userMultiplier: number;
  disableButton: boolean;
  soundEnabled: boolean;
  toggleSound: () => void;
}

interface ActionButtonProps {
  disabled: boolean;
  variant: ActionVariant;
  onClick: () => void;
  children: React.ReactNode;
}

const VARIANT_CLASS: Record<ActionVariant, string> = {
  bet: "bg-gradient-to-b from-amber-300 to-amber-500 text-black shadow-[0_0_18px_-2px_rgba(251,191,36,0.55)] hover:from-amber-200 hover:to-amber-400",
  cashout:
    "bg-gradient-to-b from-emerald-400 to-emerald-600 text-white shadow-[0_0_18px_-2px_rgba(52,211,153,0.55)] hover:from-emerald-300 hover:to-emerald-500 animate-pulse",
  queued:
    "bg-gradient-to-b from-orange-400 to-orange-600 text-black shadow-[0_0_18px_-2px_rgba(251,146,60,0.5)] hover:from-orange-300 hover:to-orange-500",
  disabled: "bg-white/5 text-white/30",
};

const ActionButton = React.memo<ActionButtonProps>(({ disabled, variant, onClick, children }) => (
  <Button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={cn(
      "h-[64px] w-full rounded-xl border-0 p-0 transition-all active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50 disabled:animate-none",
      VARIANT_CLASS[variant]
    )}
  >
    {children}
  </Button>
));
ActionButton.displayName = "ActionButton";

const SideMenu: React.FC<SideMenuProps> = React.memo(
  ({
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
    soundEnabled,
    toggleSound,
  }) => {
    const target = useMemo(() => parseFloat(cashoutAt), [cashoutAt]);
    const hasTarget = useMemo(() => Number.isFinite(target) && target >= 1.01, [target]);
    const availableBalance = useMemo(() => userData?.wallets?.available_balance ?? 0, [userData]);
    const inRound = userGambled && gameStarted && !userCashedOut;

    const potentialPayout = useMemo(() => {
      if (!bet) return 0;
      if (inRound) return bet * multiplier;
      if (hasTarget) return bet * target;
      return 0;
    }, [bet, inRound, multiplier, hasTarget, target]);

    const potentialProfit = useMemo(
      () => (bet ? Math.max(0, potentialPayout - bet) : 0),
      [bet, potentialPayout]
    );

    const invalidBet = useMemo(
      () => !bet || bet < MIN_BET || bet > MAX_BET || availableBalance < bet,
      [bet, availableBalance]
    );

    const stepTarget = useCallback(
      (direction: 1 | -1) => {
        if (!hasTarget) {
          setCashoutAt("2.00");
          return;
        }
        const next = Math.max(1.01, Math.round((target + direction * 0.5) * 100) / 100);
        setCashoutAt(next.toFixed(2));
      },
      [hasTarget, target, setCashoutAt]
    );

    const handleAction = useCallback(() => {
      if (queued) return handleBet();
      if (userGambled && gameStarted && !userCashedOut) return handleCashout();
      handleBet();
    }, [queued, userGambled, gameStarted, userCashedOut, handleBet, handleCashout]);

    const inputsDisabled =
      disableButton || queued || (userGambled && (!gameStarted || userCashedOut));

    const actionState: ActionState = useMemo(() => {
      if (!isLogged) return { type: "disabled", disabled: true, title: "Sign in", subtitle: "To play" };

      if (queued) {
        return {
          type: "queued",
          disabled: disableButton,
          title: "Cancel Bet",
          subtitle: bet ? `${bet.toFixed(2)} ETB` : "Next round",
        };
      }

      if (userCashedOut) {
        return {
          type: "disabled",
          disabled: true,
          title: "Cashed Out",
          subtitle: `${userMultiplier.toFixed(2)}x`,
        };
      }

      if (userGambled && gameStarted) {
        return {
          type: "cashout",
          disabled: disableButton,
          title: "Cash Out",
          subtitle: `${potentialPayout.toFixed(2)} ETB`,
        };
      }

      if (gameStarted) {
        return {
          type: "bet",
          disabled: disableButton || invalidBet,
          title: "Bet Next",
          subtitle: bet ? `${bet.toFixed(2)} ETB` : "Enter amount",
        };
      }

      if (!bet) return { type: "disabled", disabled: true, title: "Enter Bet", subtitle: `Minimum ${MIN_BET} ETB` };
      if (bet < MIN_BET) return { type: "disabled", disabled: true, title: "Minimum Bet", subtitle: `${MIN_BET} ETB` };
      if (bet > MAX_BET)
        return { type: "disabled", disabled: true, title: "Maximum Bet", subtitle: `${MAX_BET.toLocaleString()} ETB` };
      if (availableBalance < bet)
        return { type: "disabled", disabled: true, title: "Insufficient", subtitle: "Balance" };

      return { type: "bet", disabled: disableButton, title: "Place Bet", subtitle: `${bet.toFixed(2)} ETB` };
    }, [
      isLogged,
      queued,
      disableButton,
      bet,
      userCashedOut,
      userMultiplier,
      userGambled,
      gameStarted,
      potentialPayout,
      invalidBet,
      availableBalance,
    ]);

    return (
      <Card className="w-full rounded-none border-x-0 border-b-0 border-t border-violet-500/10 bg-gradient-to-b from-[#150f28] to-[#0c0818] p-0 shadow-none sm:rounded-xl sm:border">
        <div className="w-full p-2">
          {/* HEADER */}
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Rocket size={12} className="text-amber-400" />
              <span className="text-[11px] font-bold text-white/90">Bet</span>

              {gameStarted && (
                <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide text-emerald-400 shadow-[0_0_8px_-2px_rgba(52,211,153,0.6)]">
                  Live
                </span>
              )}

              {queued && (
                <span className="rounded-full bg-orange-500/10 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-wide text-orange-400">
                  Queued
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={toggleSound}
              className="flex h-7 w-7 items-center justify-center rounded-md text-white/40 transition-colors hover:bg-white/5 hover:text-white/80"
              aria-label="Toggle sound"
            >
              {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            </button>
          </div>

          {/* MAIN CONTROL ROW */}
          <div className="grid grid-cols-[minmax(0,1fr)_100px] gap-2">
            <div className="min-w-0 space-y-2">
              {/* BET AMOUNT */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[8px] font-bold uppercase tracking-wide text-white/40">Bet Amount</span>
                  <span className="text-[8px] text-white/40">
                    Balance{" "}
                    <span className="font-semibold text-white/90">
                      <Monetary value={availableBalance} showFraction />
                    </span>
                  </span>
                </div>

                <div className="overflow-hidden rounded-lg border border-violet-500/15 bg-[#0a0714]">
                  <BetAmount
                    value={bet === null ? "" : String(bet)}
                    onChange={(value) => setBet(value === "" ? null : Math.min(MAX_BET, Number(value)))}
                    onHalve={() => setBet(Math.max(1, Math.floor((bet || 0) / 2)))}
                    onDouble={() => setBet(Math.min(MAX_BET, (bet || 1) * 2))}
                    onMax={() => setBet(Math.min(MAX_BET, userData?.wallets?.balance ?? MAX_BET))}
                    betValue={bet || 0}
                    disabled={inputsDisabled}
                  />
                </div>
              </div>

              {/* AUTO CASHOUT */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[8px] font-bold uppercase tracking-wide text-white/40">Auto Cash Out</span>
                  <span className={cn("text-[8px] font-bold", hasTarget ? "text-amber-400" : "text-white/20")}>
                    {hasTarget ? `x${target.toFixed(2)}` : "OFF"}
                  </span>
                </div>

                <div className="flex h-8 w-full">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={cashoutAt}
                    placeholder="Off"
                    disabled={inputsDisabled}
                    onChange={(e) => setCashoutAt(e.target.value.replace(/[^0-9.]/g, ""))}
                    className="h-8 min-w-0 flex-1 rounded-r-none border-violet-500/15 bg-[#0a0714] px-2 text-[10px] font-semibold text-white focus-visible:z-10 focus-visible:ring-1 focus-visible:ring-amber-400/60"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    disabled={inputsDisabled}
                    onClick={() => stepTarget(-1)}
                    className="h-8 w-7 shrink-0 rounded-none border-l-0 border-violet-500/15 bg-[#0a0714] p-0 text-white/60"
                  >
                    <AiFillCaretDown size={9} />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={inputsDisabled}
                    onClick={() => stepTarget(1)}
                    className="h-8 w-7 shrink-0 rounded-l-none border-l-0 border-violet-500/15 bg-[#0a0714] p-0 text-white/60"
                  >
                    <AiFillCaretUp size={9} />
                  </Button>
                </div>
              </div>
            </div>

            {/* ACTION */}
            <div className="flex min-w-0">
              <ActionButton disabled={actionState.disabled} variant={actionState.type} onClick={handleAction}>
                <div className="flex flex-col items-center justify-center leading-none">
                  <span className="text-[11px] font-black uppercase">{actionState.title}</span>
                  <span className="mt-1 text-[9px] font-bold opacity-75">{actionState.subtitle}</span>
                  {userGambled && gameStarted && !userCashedOut && !queued && (
                    <span className="mt-1 text-[8px] font-semibold opacity-70">{multiplier.toFixed(2)}x</span>
                  )}
                </div>
              </ActionButton>
            </div>
          </div>

          {/* ACTIVE BET INFO */}
          {userGambled && gameStarted && !userCashedOut && !queued && (
            <div className="mt-2 flex items-center justify-between rounded-lg bg-emerald-500/5 px-2 py-1.5 text-[8px]">
              <span className="text-white/40">Potential profit</span>
              <span className="font-bold text-emerald-400">+{potentialProfit.toFixed(2)} ETB</span>
            </div>
          )}

          {queued && (
            <div className="mt-2 flex items-center justify-between rounded-lg border border-orange-500/15 bg-orange-500/5 px-2 py-1.5 text-[8px]">
              <span className="text-orange-400">Bet queued</span>
              <span className="font-semibold text-white/40">Waiting for round</span>
            </div>
          )}

          {userCashedOut && (
            <div className="mt-2 flex items-center justify-between rounded-lg border border-emerald-500/15 bg-emerald-500/5 px-2 py-1.5 text-[8px]">
              <span className="font-semibold text-emerald-400">✓ Cashed Out</span>
              <span className="font-bold text-white">{userMultiplier.toFixed(2)}x</span>
            </div>
          )}
        </div>
      </Card>
    );
  }
);

SideMenu.displayName = "SideMenu";

export default SideMenu;