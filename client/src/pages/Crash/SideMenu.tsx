/* eslint-disable */

import React, { useMemo, useCallback } from "react";
import { AiFillCaretDown, AiFillCaretUp } from "react-icons/ai";
import { Volume2, VolumeX } from "lucide-react";

import Monetary from "../../components/Monetary";
import BetAmount from "../../components/game/BetAmount";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { User } from "@/store/slice/auth";

// ======================================================
// TYPES
// ======================================================

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

  soundEnabled: boolean;
  toggleSound: () => void;
}

// ======================================================
// CONSTANTS
// ======================================================

const MAX_BET = 1_000_000;
const MIN_BET = 10;

// ======================================================
// REUSABLE ACTION BUTTON
// ======================================================

interface ActionButtonProps {
  disabled: boolean;
  variant: "bet" | "cashout" | "queued" | "disabled";

  onClick: () => void;

  children: React.ReactNode;
}

const ActionButton = React.memo<ActionButtonProps>(
  ({ disabled, variant, onClick, children }) => {
    const variantClass = {
      bet: `
        bg-amber-400
        text-black
        hover:bg-amber-300
      `,

      cashout: `
        bg-emerald-500
        text-white
        hover:bg-emerald-400
      `,

      queued: `
        bg-orange-400
        text-black
        hover:bg-orange-300
      `,

      disabled: `
        bg-muted
        text-muted-foreground
      `,
    }[variant];

    return (
      <Button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
          `
            h-[64px]
            w-full
            rounded-xl
            border-0
            p-0
            shadow-none
            transition-all
            active:scale-[0.97]

            disabled:cursor-not-allowed
            disabled:opacity-50
          `,
          variantClass,
        )}
      >
        {children}
      </Button>
    );
  },
);

ActionButton.displayName = "ActionButton";

// ======================================================
// SIDE MENU
// ======================================================

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
    // ==================================================
    // DERIVED VALUES
    // ==================================================

    const target = useMemo(
      () => parseFloat(cashoutAt),
      [cashoutAt],
    );

    const hasTarget = useMemo(
      () =>
        Number.isFinite(target) &&
        target >= 1.01,
      [target],
    );

    const availableBalance = useMemo(
      () =>
        userData?.wallets?.available_balance ?? 0,
      [userData],
    );

    const inRound =
      userGambled &&
      gameStarted &&
      !userCashedOut;

    const potentialPayout = useMemo(() => {
      if (!bet) return 0;

      if (inRound) {
        return bet * multiplier;
      }

      if (hasTarget) {
        return bet * target;
      }

      return 0;
    }, [
      bet,
      inRound,
      multiplier,
      hasTarget,
      target,
    ]);

    const potentialProfit = useMemo(() => {
      if (!bet) return 0;

      return Math.max(
        0,
        potentialPayout - bet,
      );
    }, [bet, potentialPayout]);

    const invalidBet = useMemo(
      () =>
        !bet ||
        bet < MIN_BET ||
        bet > MAX_BET ||
        availableBalance < bet,
      [bet, availableBalance],
    );

    // ==================================================
    // TARGET STEPPER
    // ==================================================

    const stepTarget = useCallback(
      (direction: 1 | -1) => {
        if (!hasTarget) {
          setCashoutAt("2.00");
          return;
        }

        const next = Math.max(
          1.01,
          Math.round(
            (target + direction * 0.5) * 100,
          ) / 100,
        );

        setCashoutAt(next.toFixed(2));
      },
      [
        hasTarget,
        target,
        setCashoutAt,
      ],
    );

    // ==================================================
    // MAIN ACTION
    // ==================================================

    const handleAction = useCallback(() => {
      // Already queued
      // The parent can handle cancellation through
      // handleBet if that is how your current logic works.
      if (queued) {
        handleBet();
        return;
      }

      // Active bet -> cash out
      if (
        userGambled &&
        gameStarted &&
        !userCashedOut
      ) {
        handleCashout();
        return;
      }

      // Normal betting
      handleBet();
    }, [
      queued,
      userGambled,
      gameStarted,
      userCashedOut,
      handleBet,
      handleCashout,
    ]);

    // ==================================================
    // INPUT STATE
    // ==================================================

    const inputsDisabled =
      disableButton ||
      queued ||
      (
        userGambled &&
        (
          !gameStarted ||
          userCashedOut
        )
      );

    // ==================================================
    // ACTION STATE
    // ==================================================

    const actionState = useMemo(() => {
      // -----------------------------------------------
      // NOT LOGGED IN
      // -----------------------------------------------

      if (!isLogged) {
        return {
          type: "disabled" as const,
          disabled: true,
          title: "Sign in",
          subtitle: "To play",
        };
      }

      // -----------------------------------------------
      // QUEUED
      // -----------------------------------------------

      if (queued) {
        return {
          type: "queued" as const,
          disabled: disableButton,
          title: "Cancel Bet",
          subtitle: bet
            ? `${bet.toFixed(2)} ETB`
            : "Next round",
        };
      }

      // -----------------------------------------------
      // USER ALREADY CASHED OUT
      // -----------------------------------------------

      if (userCashedOut) {
        return {
          type: "disabled" as const,
          disabled: true,
          title: "Cashed Out",
          subtitle: `${userMultiplier.toFixed(2)}x`,
        };
      }

      // -----------------------------------------------
      // USER HAS ACTIVE BET
      // -----------------------------------------------

      if (userGambled && gameStarted) {
        return {
          type: "cashout" as const,
          disabled: disableButton,
          title: "Cash Out",
          subtitle: `${potentialPayout.toFixed(2)} ETB`,
        };
      }

      // -----------------------------------------------
      // WAITING FOR NEXT ROUND
      // -----------------------------------------------

      if (gameStarted) {
        return {
          type: "bet" as const,
          disabled:
            disableButton ||
            invalidBet,
          title: "Bet Next",
          subtitle: bet
            ? `${bet.toFixed(2)} ETB`
            : "Enter amount",
        };
      }

      // -----------------------------------------------
      // INVALID BET
      // -----------------------------------------------

      if (!bet) {
        return {
          type: "disabled" as const,
          disabled: true,
          title: "Enter Bet",
          subtitle: "Minimum 10 ETB",
        };
      }

      if (bet < MIN_BET) {
        return {
          type: "disabled" as const,
          disabled: true,
          title: "Minimum Bet",
          subtitle: "10 ETB",
        };
      }

      if (bet > MAX_BET) {
        return {
          type: "disabled" as const,
          disabled: true,
          title: "Maximum Bet",
          subtitle: "1,000,000 ETB",
        };
      }

      if (availableBalance < bet) {
        return {
          type: "disabled" as const,
          disabled: true,
          title: "Insufficient",
          subtitle: "Balance",
        };
      }

      // -----------------------------------------------
      // NORMAL PLACE BET
      // -----------------------------------------------

      return {
        type: "bet" as const,
        disabled: disableButton,
        title: "Place Bet",
        subtitle: `${bet.toFixed(2)} ETB`,
      };
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

    // ==================================================
    // RENDER
    // ==================================================

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
        <div className="w-full p-2">
          {/* =================================================
              HEADER
          ================================================= */}

          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold">
                Bet
              </span>

              {gameStarted && (
                <span
                  className="
                    rounded-full
                    bg-emerald-500/10
                    px-1.5
                    py-0.5
                    text-[7px]
                    font-bold
                    uppercase
                    tracking-wide
                    text-emerald-500
                  "
                >
                  Live
                </span>
              )}

              {queued && (
                <span
                  className="
                    rounded-full
                    bg-orange-500/10
                    px-1.5
                    py-0.5
                    text-[7px]
                    font-bold
                    uppercase
                    tracking-wide
                    text-orange-500
                  "
                >
                  Queued
                </span>
              )}
            </div>

            <button
              type="button"
              onClick={toggleSound}
              className="
                flex
                h-7
                w-7
                items-center
                justify-center
                rounded-md
                text-muted-foreground
                transition-colors
                hover:bg-muted
                hover:text-foreground
              "
              aria-label="Toggle sound"
            >
              {soundEnabled ? (
                <Volume2 size={15} />
              ) : (
                <VolumeX size={15} />
              )}
            </button>
          </div>

          {/* =================================================
              MAIN CONTROL ROW
          ================================================= */}

          <div
            className="
              grid
              grid-cols-[minmax(0,1fr)_100px]
              gap-2
            "
          >
            {/* =================================================
                LEFT CONTROLS
            ================================================= */}

            <div className="min-w-0 space-y-2">
              {/* BET AMOUNT */}

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className="
                      text-[8px]
                      font-bold
                      uppercase
                      tracking-wide
                      text-muted-foreground
                    "
                  >
                    Bet Amount
                  </span>

                  <span className="text-[8px] text-muted-foreground">
                    Balance{" "}
                    <span className="font-semibold text-foreground">
                      <Monetary
                        value={availableBalance}
                        showFraction
                      />
                    </span>
                  </span>
                </div>

                <div
                  className="
                    overflow-hidden
                    rounded-lg
                    border
                    border-border/60
                    bg-background
                  "
                >
                  <BetAmount
                    value={
                      bet === null
                        ? ""
                        : String(bet)
                    }
                    onChange={(value) =>
                      setBet(
                        value === ""
                          ? null
                          : Math.min(
                            MAX_BET,
                            Number(value),
                          ),
                      )
                    }
                    onHalve={() =>
                      setBet(
                        Math.max(
                          1,
                          Math.floor(
                            (bet || 0) / 2,
                          ),
                        ),
                      )
                    }
                    onDouble={() =>
                      setBet(
                        Math.min(
                          MAX_BET,
                          (bet || 1) * 2,
                        ),
                      )
                    }
                    onMax={() =>
                      setBet(
                        Math.min(
                          MAX_BET,
                          userData?.wallets
                            ?.balance ?? MAX_BET,
                        ),
                      )
                    }
                    betValue={bet || 0}
                    disabled={inputsDisabled}
                  />
                </div>
              </div>

              {/* AUTO CASHOUT */}

              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span
                    className="
                      text-[8px]
                      font-bold
                      uppercase
                      tracking-wide
                      text-muted-foreground
                    "
                  >
                    Auto Cash Out
                  </span>

                  <span
                    className={cn(
                      "text-[8px] font-bold",
                      hasTarget
                        ? "text-amber-400"
                        : "text-muted-foreground/50",
                    )}
                  >
                    {hasTarget
                      ? `x${target.toFixed(2)}`
                      : "OFF"}
                  </span>
                </div>

                <div className="flex h-8 w-full">
                  <Input
                    type="text"
                    inputMode="decimal"
                    value={cashoutAt}
                    placeholder="Off"
                    disabled={inputsDisabled}
                    onChange={(e) =>
                      setCashoutAt(
                        e.target.value.replace(
                          /[^0-9.]/g,
                          "",
                        ),
                      )
                    }
                    className="
                      h-8
                      min-w-0
                      flex-1
                      rounded-r-none
                      border-border/60
                      bg-background
                      px-2
                      text-[10px]
                      font-semibold
                      focus-visible:z-10
                      focus-visible:ring-1
                      focus-visible:ring-amber-400/60
                    "
                  />

                  <Button
                    type="button"
                    variant="outline"
                    disabled={inputsDisabled}
                    onClick={() =>
                      stepTarget(-1)
                    }
                    className="
                      h-8
                      w-7
                      shrink-0
                      rounded-none
                      border-l-0
                      border-border/60
                      bg-background
                      p-0
                    "
                  >
                    <AiFillCaretDown size={9} />
                  </Button>

                  <Button
                    type="button"
                    variant="outline"
                    disabled={inputsDisabled}
                    onClick={() =>
                      stepTarget(1)
                    }
                    className="
                      h-8
                      w-7
                      shrink-0
                      rounded-l-none
                      border-l-0
                      border-border/60
                      bg-background
                      p-0
                    "
                  >
                    <AiFillCaretUp size={9} />
                  </Button>
                </div>
              </div>
            </div>

            {/* =================================================
                ACTION
            ================================================= */}

            <div className="flex min-w-0">
              <ActionButton
                disabled={actionState.disabled}
                variant={actionState.type}
                onClick={handleAction}
              >
                <div className="flex flex-col items-center justify-center leading-none">
                  <span
                    className="
                      text-[11px]
                      font-black
                      uppercase
                    "
                  >
                    {actionState.title}
                  </span>

                  <span
                    className="
                      mt-1
                      text-[9px]
                      font-bold
                      opacity-75
                    "
                  >
                    {actionState.subtitle}
                  </span>

                  {/* Active multiplier */}

                  {userGambled &&
                    gameStarted &&
                    !userCashedOut &&
                    !queued && (
                      <span
                        className="
                          mt-1
                          text-[8px]
                          font-semibold
                          opacity-70
                        "
                      >
                        {multiplier.toFixed(2)}x
                      </span>
                    )}
                </div>
              </ActionButton>
            </div>
          </div>

          {/* =================================================
              ACTIVE BET INFO
          ================================================= */}

          {userGambled &&
            gameStarted &&
            !userCashedOut &&
            !queued && (
              <div
                className="
                  mt-2
                  flex
                  items-center
                  justify-between
                  rounded-lg
                  bg-emerald-500/5
                  px-2
                  py-1.5
                  text-[8px]
                "
              >
                <span className="text-muted-foreground">
                  Potential profit
                </span>

                <span className="font-bold text-emerald-500">
                  +{potentialProfit.toFixed(2)} ETB
                </span>
              </div>
            )}

          {/* =================================================
              QUEUED
          ================================================= */}

          {queued && (
            <div
              className="
                mt-2
                flex
                items-center
                justify-between
                rounded-lg
                border
                border-orange-500/15
                bg-orange-500/5
                px-2
                py-1.5
                text-[8px]
              "
            >
              <span className="text-orange-500">
                Bet queued
              </span>

              <span className="font-semibold text-muted-foreground">
                Waiting for round
              </span>
            </div>
          )}

          {/* =================================================
              CASHED OUT
          ================================================= */}

          {userCashedOut && (
            <div
              className="
                mt-2
                flex
                items-center
                justify-between
                rounded-lg
                border
                border-emerald-500/15
                bg-emerald-500/5
                px-2
                py-1.5
                text-[8px]
              "
            >
              <span className="font-semibold text-emerald-500">
                ✓ Cashed Out
              </span>

              <span className="font-bold text-foreground">
                {userMultiplier.toFixed(2)}x
              </span>
            </div>
          )}
        </div>
      </Card>
    );
  },
);

SideMenu.displayName = "SideMenu";

export default SideMenu;