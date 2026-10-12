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

const GAME_NAME = "dice";

// Keep this equal to HOUSE_EDGES.DICE on the front end (fraction, 0.01 = 1%).
// The server sends it to the client in "dice:sync", so the client always
// displays the multiplier the server actually pays.
const HOUSE_EDGE = 0.01;

const MIN_BET = 1;
const MAX_BET = 50_000;
const MIN_CHANCE = 2;
const MAX_CHANCE = 98;
// Safety cap so one lucky low-chance bet cannot drain the house.
const MAX_PAYOUT = 1_000_000;

// ============================================================
// MATH (single source of truth -- the client never decides outcomes)
// ============================================================

// Floored to 4 decimals so rounding can never favour the player.
function getMultiplier(winChance: number): number {
  return Math.floor(((100 - HOUSE_EDGE * 100) / winChance) * 10_000) / 10_000;
}

// Roll is 0.00 .. 99.99 (10,000 equally likely values), crypto-secure.
function rollDice(): number {
  return randomInt(0, 10_000) / 100;
}

// Target matches the front end: over -> 100 - chance, under -> chance.
// Win zones are exact so P(win) == winChance:
//   over : roll >= target  -> (100 - target) %  == chance
//   under: roll <  target  -> target %          == chance
function getTarget(winChance: number, rollOver: boolean): number {
  return rollOver ? 100 - winChance : winChance;
}

function isWin(roll: number, target: number, rollOver: boolean): boolean {
  return rollOver ? roll >= target : roll < target;
}

// ============================================================
// STATE
// ============================================================
//
// Dice is instant (no shared rounds), so the only state is a per-user
// "bet in flight" guard. It stops a user firing parallel bets that would
// race each other on the wallet. In-memory, so per process.

const inFlight = new Set<string>();

// ============================================================
// SOCKET HANDLERS
// ============================================================

const registerSocket = (socket: CustomSocket) => {
  const userId = socket.user?.userId;

  if (userId) socket.join(userId);

  const sendState = () => {
    socket.emit("dice:sync", {
      houseEdge: HOUSE_EDGE,
      minBet: MIN_BET,
      maxBet: MAX_BET,
      minChance: MIN_CHANCE,
      maxChance: MAX_CHANCE,
    });
  };

  sendState();

  socket.on("dice:requestState", sendState);

  socket.on(
    "dice:bet",
    async (payload: unknown, callback?: (result: any) => void) => {
      const reply = (result: any) => {
        try {
          if (typeof callback === "function") callback(result);
        } catch (err) {
          console.error("[dice] bet callback error:", err);
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
            ? (payload as {
                amount?: unknown;
                winChance?: unknown;
                rollOver?: unknown;
              })
            : {};

        const amount = Number(body.amount);
        const winChance = Math.round(Number(body.winChance) * 100) / 100;
        const rollOver = body.rollOver === true;

        if (!Number.isFinite(amount) || amount < MIN_BET || amount > MAX_BET) {
          return reply({
            error: `Bet must be between ${MIN_BET} and ${MAX_BET} ETB`,
          });
        }

        if (
          !Number.isFinite(winChance) ||
          winChance < MIN_CHANCE ||
          winChance > MAX_CHANCE
        ) {
          return reply({
            error: `Win chance must be between ${MIN_CHANCE}% and ${MAX_CHANCE}%`,
          });
        }

        const multiplier = getMultiplier(winChance);
        const potential = Math.round(amount * multiplier * 100) / 100;

        if (potential > MAX_PAYOUT) {
          return reply({ error: `Max payout is ${MAX_PAYOUT} ETB` });
        }

        // One DB call: lock funds and get the fresh wallet back.
        const lockedWallet = await lockBet(userId, amount);
        if (!lockedWallet) return reply({ error: "Insufficient funds" });
        locked = true;

        // Outcome is decided here, on the server.
        const target = getTarget(winChance, rollOver);
        const roll = rollDice();
        const won = isWin(roll, target, rollOver);
        const payout = won ? potential : 0;

        const entry: SettleEntry = {
          userId,
          bet: amount,
          payout,
          metadata: { roll, target, winChance, rollOver, multiplier },
        };

        // Every dice bet is its own "round" with a unique id, which also
        // makes settlement idempotent.
        const roundId = `dice-${randomUUID()}`;
        const results = await settleGameBatch(GAME_NAME, roundId, [entry]);

        // Settlement has answered: never unlock past this point.
        locked = false;

        const res =
          results.find((r: any) => r.user_id === userId) ?? results[0];

        if (!res || res.status !== "ok" || !res.wallet) {
          // duplicate/error: money stays safe, see logs (same as keno).
          console.error("[dice] settle not ok:", userId, roundId, res);
          return reply({
            error: "Could not settle bet, please check your balance",
          });
        }

        // Keep other tabs/devices of the same user in sync.
        io_emitWallet(socket, userId, res.wallet);

        return reply({
          ok: true,
          roll,
          won,
          target,
          multiplier,
          payout,
          wallet: res.wallet,
        });
      } catch (error) {
        console.error("[dice] bet error:", userId, error);

        // Funds were locked but settlement never answered: give them back.
        if (locked) {
          try {
            await walletService.unlockBalance(userId);
          } catch (unlockErr) {
            console.error("[dice] unlock after failed bet failed:", unlockErr);
          }
        }

        reply({ error: "Something went wrong, please try again" });
      } finally {
        inFlight.delete(userId);
      }
    },
  );
};

// Emits to every socket in the user's room (including this one).
let ioRef: Server | null = null;
function io_emitWallet(socket: Socket, userId: string, wallet: unknown) {
  (ioRef ?? (socket as any).server)?.to(userId).emit("dice:wallet", wallet);
}

// ============================================================
// ENTRY POINT (same shape as Keno)
// ============================================================

export default function Dice(io: Server, socket: CustomSocket) {
  ioRef = io;
  registerSocket(socket);
}
