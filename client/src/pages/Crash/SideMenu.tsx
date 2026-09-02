/* eslint-disable */

import React from "react";
import {
  AiFillCaretDown,
  AiFillCaretUp,
} from "react-icons/ai";

import Monetary from "../../components/Monetary";
import BetAmount from "../../components/game/BetAmount";
import { type User } from "../../components/Types";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SideMenuProps {
  bet: number | null;
  setBet: any;
  cashoutAt: string;
  setCashoutAt: any;
  queued: boolean;
  multiplier: number;
  gameStarted: boolean;
  handleBet: any;
  handleCashout: any;
  isLogged: boolean;
  userGambled: boolean;
  userCashedOut: boolean;
  userData: User;
  userMultiplier: number;
  disableButton: boolean;
}

const MAX_BET = 1000000;

const SideMenu: React.FC<SideMenuProps> = ({
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
  const target = parseFloat(cashoutAt);

  const hasTarget =
    Number.isFinite(target) && target >= 1.01;

  const inRound =
    userGambled &&
    gameStarted &&
    !userCashedOut;

  const profit = inRound
    ? (bet ?? 0) * multiplier - (bet ?? 0)
    : hasTarget
      ? (bet ?? 0) * target - (bet ?? 0)
      : 0;

  const stepTarget = (dir: 1 | -1) => {
    if (!hasTarget) {
      setCashoutAt("2.00");
      return;
    }

    const next = Math.max(
      1.01,
      Math.round((target + dir * 0.5) * 100) / 100
    );

    setCashoutAt(next.toFixed(2));
  };

  const invalidBet =
    !bet ||
    bet < 1 ||
    bet > MAX_BET ||
    (userData &&
      userData.wallets.balance < bet);

  const renderMessage = (profit: number) => {
    if (!isLogged) {
      return "Sign in to play";
    }

    if (userCashedOut && gameStarted) {
      return `Cashed out at ${userMultiplier.toFixed(2)} x`;
    }

    if (userGambled) {
      return gameStarted
        ? `Cash Out ${profit.toFixed(2) + bet}`
        : "You're in!";
    }

    if (!bet || bet < 10) {
      return "Enter bet amount";
    }

    if (bet > MAX_BET) {
      return "Max bet is 1M";
    }

    if (userData.wallets.balance < bet) {
      return "Not enough balance";
    }

    if (queued) {
      return "Queued • Cancel";
    }

    if (gameStarted) {
      return "Bet Next Round";
    }

    return "Place Bet";
  };

  const inputsDisabled =
    disableButton ||
    (userGambled && (!gameStarted || userCashedOut));

  const actionDisabled =
    disableButton ||
    (isLogged &&
      (userGambled
        ? !gameStarted || userCashedOut
        : invalidBet));

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

        {/* =========================
            BET AMOUNT
        ========================== */}
        <section className="space-y-1">

          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Bet Amount
            </span>

            <span className="text-[10px] text-muted-foreground">
              Balance:{" "}
              <span className="font-medium text-foreground/80">
                <Monetary
                  value={userData?.wallets?.balance ?? 0}
                  showFraction
                />
              </span>
            </span>
          </div>

          <div
            className="
              overflow-hidden
              rounded-md
              border
              border-border/70
              bg-muted/30
            "
          >
            <BetAmount
              value={bet === null ? "" : String(bet)}

              onChange={(value) =>
                setBet(
                  value === ""
                    ? null
                    : Math.min(
                      MAX_BET,
                      Number(value)
                    )
                )
              }

              onHalve={() =>
                setBet(
                  Math.max(
                    1,
                    Math.floor((bet || 0) / 2)
                  )
                )
              }

              onDouble={() =>
                setBet(
                  Math.min(
                    MAX_BET,
                    (bet || 1) * 2
                  )
                )
              }

              onMax={() =>
                setBet(
                  Math.min(
                    MAX_BET,
                    userData?.wallets?.balance ?? MAX_BET
                  )
                )
              }

              betValue={bet || 0}
              disabled={inputsDisabled}
            />
          </div>
        </section>

        {/* =========================
            AUTO CASHOUT
        ========================== */}
        <section className="space-y-1">

          <div className="flex items-center justify-between px-0.5">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Auto Cash Out
            </span>

            <span
              className={cn(
                "text-[10px] font-semibold",
                hasTarget
                  ? "text-amber-400"
                  : "text-muted-foreground/50"
              )}
            >
              {hasTarget
                ? `x${target.toFixed(2)} `
                : "OFF"}
            </span>
          </div>

          <div className="flex h-8 w-full">

            <Input
              type="text"
              inputMode="decimal"
              value={cashoutAt}
              placeholder="Off"

              onChange={(e) =>
                setCashoutAt(
                  e.target.value.replace(
                    /[^0-9.]/g,
                    ""
                  )
                )
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

        {/* =========================
            PROFIT
        ========================== */}
        {/* <div
          className="
            flex
            min-h-11
            items-center
            justify-between
            rounded-md
            border
            border-border/50
            bg-muted/25
            px-2.5
          "
        >
          <div className="min-w-0">
            <div className="text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              Profit on Win
            </div>

            <div className="truncate text-[9px] text-muted-foreground/60">
              {hasTarget
                ? `at ${target.toFixed(2)} x`
                : "Auto cashout off"}
            </div>
          </div>

          <span className="text-sm font-bold text-amber-400">
            <Monetary
              value={profit}
              showFraction
            />
          </span>
        </div> */}

        {/* =========================
            MAIN ACTION
        ========================== */}
        <Button
          type="button"
          onClick={
            userGambled && gameStarted
              ? handleCashout
              : handleBet
          }
          disabled={inputsDisabled}
          className={cn(
            "h-10 w-full rounded-md",
            "border-0 shadow-none",
            "text-[11px] font-bold uppercase tracking-wide",
            "transition-transform active:scale-[0.98]",

            userGambled && gameStarted
              ? "bg-green-500 text-white hover:bg-green-600"
              : queued
                ? "bg-yellow-500 text-black hover:bg-yellow-600"
                : "bg-amber-400 text-black hover:bg-amber-500",

            "disabled:cursor-not-allowed disabled:opacity-40"
          )}
        >
          {renderMessage(profit)}
        </Button>

        {/* =========================
            CASHOUT RESULT
        ========================== */}
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
            Cashed out at{" "}
            {userMultiplier.toFixed(2)}x
          </div>
        )}

      </div>
    </Card>
  );
};

export default SideMenu;

