import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { socket } from "@/lib/socket";
import { Card as ShadcnCard, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import { Trophy, Coins, User, Clock } from "lucide-react";
import Players from "./Players";

function getPickedMap(match: any) {
  const map: Record<number, string> = {};

  match.players.forEach((p: any) => {
    p.picks?.forEach((card: any) => {
      const index = match.deck.findIndex(
        (d: any) => d === card // same reference (works if server sends same object)
      );
      if (index !== -1) map[index] = p.id;
    });
  });

  return map;
}

/* --- card images mapping --- */
const cardMap: Record<string, string> = {
  "1": "/cards/AS.png",
  "2": "/cards/2S.png",
  "3": "/cards/3S.png",
  "4": "/cards/4S.png",
  "5": "/cards/5S.png",
  "6": "/cards/6S.png",
  "7": "/cards/7S.png",
  "8": "/cards/8S.png",
  "9": "/cards/9S.png",
  "10": "/cards/10S.png",
  J: "/cards/JS.png",
  Q: "/cards/QS.png",
  K: "/cards/KS.png",
};
function Card({ card, index, roomId, playerId, disabled, pickedBy }: any) {
  function handlepick() {
    if (disabled) return;

    socket.emit("carddraw:card-pick", {
      roomId,
      cardindex: index,
      playerId,
    });
  }

  const isMine = pickedBy === playerId;
  const isOpponent = pickedBy && pickedBy !== playerId;

  return (
    <div
      className={`relative w-[60px] h-[80px] perspective mx-auto ${disabled ? "opacity-50" : "cursor-pointer hover:scale-[1.03]"
        } transition`}
      onClick={handlepick}
    >
      <div
        className={`relative w-full h-full transition-transform duration-500 transform-style-preserve-3d ${card.revealed ? "rotate-y-180" : ""
          }`}
      >
        <img
          src="/cards/back2.png"
          className="absolute w-full h-full bg-white backface-hidden border  shadow-sm"
        />

        <img
          src={cardMap[card.value]}
          className="absolute w-full h-full bg-white rotate-y-180 backface-hidden border  shadow-sm"
        />
      </div>

      {pickedBy && (
        <div
          className={`absolute inset-0 rounded-sm border-[2px] ${isMine ? "border-green-500" : "border-red-500"
            }`}
        />
      )}
    </div>
  );
}

/* --- grid --- */
function CardHand({ deck, roomId, playerId, match }: any) {
  const isMyTurn = match.turn === playerId;
  const pickedMap = getPickedMap(match);

  return (
    <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5 bg-muted/20 mt-5 mx-auto p-2 rounded-xl">
      {deck.map((card: any, i: number) => (
        <Card
          key={i}
          card={card}
          index={i}
          roomId={roomId}
          playerId={playerId}
          pickedBy={pickedMap[i]}
          disabled={
            !isMyTurn || card.revealed || match.status === "finished"
          }
        />
      ))}
    </div>
  );
}

/* --- main --- */
export default function CardDraw() {
  const { roomId } = useParams();

  const [playerId] = useState(() => {
    let id = localStorage.getItem("playerId");
    if (!id) {
      id = "player_" + Math.floor(Math.random() * 100000);
      localStorage.setItem("playerId", id);
    }
    return id;
  });

  const [match, setMatch] = useState<any>(null);

  useEffect(() => {
    if (!roomId) return;

    socket.emit("player:register", { playerId });
    socket.emit("carddraw:join", { roomId });

    socket.on("carddraw:start", (data) => {
      setMatch(data);
    });

    socket.on("carddraw:update", ({ match }) => {
      setMatch(match); // 🔥 re-render UI
    });

    socket.on("carddraw:result", (finalMatch) => {
      setMatch(finalMatch);
    });

    return () => {
      socket.off("carddraw:start");
      socket.off("carddraw:update");
      socket.off("carddraw:result");
    };
  }, [roomId, playerId]);

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted">
        <div className="w-96">
          <CardContent className="pt-6 text-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
            <p className="text-muted-foreground">Waiting for match to start...</p>
            <Badge variant="outline" className="text-xs">
              Room: {roomId}
            </Badge>
          </CardContent>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="mx-auto space-y-5 px-3">

        {/* top info */}
        <div className="border border-border/40 mt-4 p-3 rounded-xl bg-muted/20">
          <div className="flex justify-between items-center flex-wrap gap-3">

            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1 text-[11px] px-2 py-[2px]">
                <Trophy className="w-3 h-3" />
                Round {match.round}
              </Badge>

              <Badge variant="outline" className="gap-1 text-[11px] px-2 py-[2px]">
                <Coins className="w-3 h-3" />
                {match.betAmount} ETB
              </Badge>
            </div>

            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />

              {match.status === "finished" ? (
                <Badge variant="destructive" className="text-[11px] px-2 py-[2px]">
                  Game Ended
                </Badge>
              ) : (
                <Badge
                  variant={match.turn === playerId ? "default" : "secondary"}
                  className="gap-1 text-[11px] px-2 py-[2px]"
                >
                  {match.turn === playerId ? (
                    <>
                      <User className="w-3 h-3" />
                      Your Turn
                    </>
                  ) : (
                    "Opponent's Turn"
                  )}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* players */}
        <div className="flex gap-3 justify-center mt-4">
          {match.players.map((player: any, idx: number) => (
            <div key={idx}>
              <Players player={player} />
            </div>
          ))}
        </div>

        {/* deck */}
        <div className="py-5 space-y-3">
          <div className="flex items-center justify-between px-2">
            <h3 className="text-[12px] font-semibold text-muted-foreground">
              Game Deck
            </h3>

            <Badge variant="outline" className="text-[10px] px-2 py-[2px]">
              {
                match.deck.filter(
                  (d: { revealed: boolean }) => d.revealed == true
                ).length
              }{" "}
              cards remaining
            </Badge>
          </div>

          <div className="mx-auto px-2">
            <CardHand
              deck={match.deck}
              roomId={roomId}
              playerId={playerId}
              match={match}
            />
          </div>
        </div>

        {match.status === "finished" && (
          <div className="text-center mt-6">
            <div
              className={`inline-block px-6 py-2.5 rounded-xl text-base font-semibold shadow-md
            ${match.winner === playerId
                  ? "bg-green-500 text-white"
                  : "bg-red-500 text-white"
                }`}
            >
              {match.winner === playerId ? "🎉 You Win" : "💀 You Lose"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}