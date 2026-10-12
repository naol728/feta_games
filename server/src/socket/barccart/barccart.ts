/* eslint-disable */

import { randomInt, randomUUID } from "crypto";
import { Server, Socket } from "socket.io";

import { walletService } from "../../services/wallet.service";
import {
  lockBet,
  settleGameBatch,
  SettleEntry,
} from "../../services/game-settlement.service";

interface JwtPayload {
  userId: string;
  telegramId: number;
}

interface CustomSocket extends Socket {
  user: JwtPayload;
}

// ============================================================
// CONFIG
// ============================================================

const GAME_NAME = "baccarat";

type Side = "PLAYER" | "BANKER" | "TIE";

// Same payouts the front end always showed (total return, stake included).
const PAYOUTS: Record<Side, number> = {
  PLAYER: 2,
  BANKER: 1.95,
  TIE: 9,
};

// Business decision:
//   false -> a Tie result loses Player/Banker bets (what the old UI did)
//   true  -> a Tie result returns Player/Banker stakes (standard casino rule)
const PUSH_ON_TIE = false;

const DECKS = 8;
const MIN_BET = 1;
const MAX_BET = 50_000;

// ============================================================
// CARDS & HAND DEALING (all outcomes decided on the server)
// ============================================================

export interface Card {
  rank: number; // 1 (Ace) .. 13 (King)
  suit: number; // 0 spade, 1 heart, 2 diamond, 3 club
}

const cardValue = (rank: number) => (rank >= 10 ? 0 : rank);
const handTotal = (cards: Card[]) =>
  cards.reduce((sum, c) => sum + cardValue(c.rank), 0) % 10;

// Fresh 8-deck shoe per hand, drawn without replacement with crypto RNG.
function createShoe() {
  const counts = new Array<number>(13).fill(DECKS * 4);
  let remaining = 13 * DECKS * 4;

  return {
    draw(): Card {
      let n = randomInt(0, remaining);
      let i = 0;
      for (; i < 13; i++) {
        if (n < counts[i]) break;
        n -= counts[i];
      }
      counts[i]--;
      remaining--;
      return { rank: i + 1, suit: randomInt(0, 4) };
    },
  };
}

// Standard banker third-card table. p3 is the value of the player's third card.
function bankerDrawsOnPlayerThird(bankerTotal: number, p3: number): boolean {
  switch (bankerTotal) {
    case 0:
    case 1:
    case 2:
      return true;
    case 3:
      return p3 !== 8;
    case 4:
      return p3 >= 2 && p3 <= 7;
    case 5:
      return p3 >= 4 && p3 <= 7;
    case 6:
      return p3 === 6 || p3 === 7;
    default:
      return false;
  }
}

export function dealHand() {
  const shoe = createShoe();

  // Real dealing order: P, B, P, B
  const player: Card[] = [shoe.draw()];
  const banker: Card[] = [shoe.draw()];
  player.push(shoe.draw());
  banker.push(shoe.draw());

  const pInitial = handTotal(player);
  const bInitial = handTotal(banker);

  // 8 or 9 on either hand is a "natural": nobody draws.
  if (pInitial < 8 && bInitial < 8) {
    let p3: number | null = null;

    if (pInitial <= 5) {
      const c = shoe.draw();
      player.push(c);
      p3 = cardValue(c.rank);
    }

    const bankerDraws =
      p3 === null ? bInitial <= 5 : bankerDrawsOnPlayerThird(bInitial, p3);

    if (bankerDraws) banker.push(shoe.draw());
  }

  const pTotal = handTotal(player);
  const bTotal = handTotal(banker);
  const winner: Side =
    pTotal > bTotal ? "PLAYER" : bTotal > pTotal ? "BANKER" : "TIE";

  return { player, banker, pTotal, bTotal, winner };
}

export function resolveBet(side: Side, winner: Side) {
  if (side === winner) {
    return { won: true, push: false, multiplier: PAYOUTS[side] };
  }
  if (PUSH_ON_TIE && winner === "TIE") {
    return { won: false, push: true, multiplier: 1 };
  }
  return { won: false, push: false, multiplier: 0 };
}

// ============================================================
// STATE
// ============================================================
//
// Hands are instant and independent, so the only state is a per-user
// "bet in flight" guard (prevents parallel bets racing on the wallet).
// In-memory: per process, like keno.

const inFlight = new Set<string>();

// ============================================================
// SOCKET HANDLERS
// ============================================================

const registerSocket = (socket: CustomSocket) => {
  const userId = socket.user?.userId;

  if (userId) socket.join(userId);

  const sendState = () => {
    socket.emit("baccarat:sync", {
      payouts: PAYOUTS,
      pushOnTie: PUSH_ON_TIE,
      minBet: MIN_BET,
      maxBet: MAX_BET,
    });
  };

  sendState();
  socket.on("baccarat:requestState", sendState);

  socket.on(
    "baccarat:bet",
    async (payload: unknown, callback?: (result: any) => void) => {
      const reply = (result: any) => {
        try {
          if (typeof callback === "function") callback(result);
        } catch (err) {
          console.error("[baccarat] bet callback error:", err);
        }
      };

      if (!userId) return reply({ error: "You must be logged in" });

      if (inFlight.has(userId)) {
        return reply({ error: "Previous bet is still processing" });
      }
      inFlight.add(userId);

      let locked = false;

      try {
        const body =
          typeof payload === "object" && payload !== null
            ? (payload as { amount?: unknown; side?: unknown })
            : {};

        const amount = Number(body.amount);
        const side = body.side as Side;

        if (side !== "PLAYER" && side !== "BANKER" && side !== "TIE") {
          return reply({ error: "Pick Player, Banker or Tie" });
        }

        if (
          !Number.isFinite(amount) ||
          amount < MIN_BET ||
          amount > MAX_BET
        ) {
          return reply({
            error: `Bet must be between ${MIN_BET} and ${MAX_BET} ETB`,
          });
        }

        // One DB call: lock funds.
        const lockedWallet = await lockBet(userId, amount);
        if (!lockedWallet) return reply({ error: "Insufficient funds" });
        locked = true;

        // Outcome is decided here, on the server.
        const hand = dealHand();
        const { won, push, multiplier } = resolveBet(side, hand.winner);
        const payout = Math.round(amount * multiplier * 100) / 100;

        const entry: SettleEntry = {
          userId,
          bet: amount,
          payout,
          metadata: {
            side,
            winner: hand.winner,
            pTotal: hand.pTotal,
            bTotal: hand.bTotal,
            player: hand.player,
            banker: hand.banker,
          },
        };

        // Every hand is its own "round" with a unique id (idempotent settle).
        const roundId = `baccarat-${randomUUID()}`;
        const results = await settleGameBatch(GAME_NAME, roundId, [entry]);

        // Settlement has answered: never unlock past this point.
        locked = false;

        const res =
          results.find((r: any) => r.user_id === userId) ?? results[0];

        if (!res || res.status !== "ok" || !res.wallet) {
          // duplicate/error: money stays safe, see logs (same as keno).
          console.error("[baccarat] settle not ok:", userId, roundId, res);
          return reply({
            error: "Could not settle bet, please check your balance",
          });
        }

        // Sync the user's OTHER tabs/devices. The sender is excluded on
        // purpose: this client reveals the hand first, then applies the wallet
        // from the reply, so the balance never spoils the result.
        socket.to(userId).emit("baccarat:wallet", res.wallet);

        return reply({
          ok: true,
          side,
          winner: hand.winner,
          won,
          push,
          multiplier,
          payout,
          player: { cards: hand.player, total: hand.pTotal },
          banker: { cards: hand.banker, total: hand.bTotal },
          wallet: res.wallet,
        });
      } catch (error) {
        console.error("[baccarat] bet error:", userId, error);

        // Funds were locked but settlement never answered: give them back.
        if (locked) {
          try {
            await walletService.unlockBalance(userId);
          } catch (unlockErr) {
            console.error(
              "[baccarat] unlock after failed bet failed:",
              unlockErr,
            );
          }
        }

        reply({ error: "Something went wrong, please try again" });
      } finally {
        inFlight.delete(userId);
      }
    },
  );
};

// ============================================================
// ENTRY POINT (same shape as Keno / Dice)
// ============================================================

export default function Baccarat(io: Server, socket: CustomSocket) {
  registerSocket(socket);
}