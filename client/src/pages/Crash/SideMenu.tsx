/* eslint-disable */

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

  /*
   * Live profit while the player's bet is riding.
   * Otherwise show the planned profit.
   */
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
    (userData && userData.wallets.balance < bet);

  const renderMessage = () => {
    if (!isLogged) {
      return "Sign in to play";
    }

    if (userCashedOut && gameStarted) {
      return `Cashed out at ${userMultiplier.toFixed(2)}x`;
    }

    if (userGambled) {
      return gameStarted
        ? "Cash Out"
        : "You're in!";
    }

    if (!bet || bet < 1) {
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

  const disabled =
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
        border-b
        border-t-0
        bg-[#171720]
        p-0
        shadow-none
        xl:w-[340px]
        xl:shrink-0
        xl:rounded-xl
        xl:border
      "
    >
      <div className="flex w-full flex-col gap-2 p-2.5 sm:p-3">

        {/* =========================
            BET AMOUNT
        ========================== */}
        <div className="w-full">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
              Bet Amount
            </span>

            <span className="text-[10px] text-white/30">
              Balance:{" "}
              <Monetary
                value={userData?.wallets.balance ?? 0}
                showFraction
              />
            </span>
          </div>

          <div className="overflow-hidden rounded-lg border border-white/10 bg-[#20202b]">
            <BetAmount
              value={bet === null ? "" : String(bet)}
              onChange={(value) =>
                setBet(
                  value === ""
                    ? null
                    : Math.min(MAX_BET, Number(value))
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
              betValue={bet || 0}
            />
          </div>
        </div>

        {/* =========================
            AUTO CASHOUT
        ========================== */}
        <div className="w-full">

          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
              Auto Cash Out
            </span>

            <span
              className={`
                text-[10px] font-bold
                ${hasTarget
                  ? "text-[#f5b83d]"
                  : "text-white/30"
                }
              `}
            >
              {hasTarget
                ? `x${target.toFixed(2)}`
                : "OFF"}
            </span>
          </div>

          <div className="flex h-9 w-full">

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
                h-9
                min-w-0
                flex-1
                rounded-r-none
                border-white/10
                bg-[#20202b]
                px-2.5
                text-xs
                text-white
                placeholder:text-white/25
                focus-visible:ring-1
                focus-visible:ring-[#f5b83d]
              "
            />

            <Button
              type="button"
              variant="ghost"
              onClick={() => stepTarget(-1)}
              className="
                h-9
                w-9
                rounded-none
                border-y
                border-white/10
                bg-[#252530]
                p-0
                text-white/50
                hover:bg-[#30303c]
                hover:text-white
              "
            >
              <AiFillCaretDown size={12} />
            </Button>

            <Button
              type="button"
              variant="ghost"
              onClick={() => stepTarget(1)}
              className="
                h-9
                w-9
                rounded-l-none
                border
                border-white/10
                bg-[#252530]
                p-0
                text-white/50
                hover:bg-[#30303c]
                hover:text-white
              "
            >
              <AiFillCaretUp size={12} />
            </Button>
          </div>
        </div>

        {/* =========================
            PROFIT
        ========================== */}
        <div
          className="
            flex
            items-center
            justify-between
            rounded-lg
            border
            border-white/5
            bg-[#20202b]
            px-2.5
            py-2
          "
        >
          <div className="flex flex-col">
            <span className="text-[9px] uppercase tracking-wide text-white/35">
              Profit on Win
            </span>

            <span className="text-[9px] text-white/25">
              {hasTarget
                ? `at ${target.toFixed(2)}x`
                : "Auto cashout off"}
            </span>
          </div>

          <span className="text-sm font-bold text-[#f5b83d]">
            <Monetary
              value={profit}
              showFraction
            />
          </span>
        </div>

        {/* =========================
            MAIN ACTION
        ========================== */}
        <Button
          onClick={
            userGambled && gameStarted
              ? handleCashout
              : handleBet
          }
          disabled={disabled}
          className={`
            h-11
            w-full
            rounded-lg
            border-0
            text-xs
            font-extrabold
            uppercase
            tracking-wide
            shadow-none
            transition-all
            active:scale-[0.98]
            ${userGambled && gameStarted
              ? "bg-[#22c55e] text-white hover:bg-[#16a34a]"
              : queued
                ? "bg-[#eab308] text-black hover:bg-[#ca8a04]"
                : "bg-[#f5b83d] text-black hover:bg-[#d99d25]"
            }
            disabled:cursor-not-allowed
            disabled:opacity-40
          `}
        >
          {renderMessage()}
        </Button>

        {/* =========================
            CURRENT MULTIPLIER
        ========================== */}
        {userCashedOut && (
          <div
            className="
              flex
              items-center
              justify-center
              rounded-md
              bg-green-500/10
              px-2
              py-1.5
              text-[10px]
              font-semibold
              text-green-400
            "
          >
            ✓ Cashed out at{" "}
            {userMultiplier.toFixed(2)}x
          </div>
        )}

      </div>
    </Card>
  );
};

export default SideMenu;