import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom"; // ✅ add
import { socket } from "@/lib/socket";
import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Coins, User, Clock } from "lucide-react";
import Players from "./Players";
import CardContainer from "./CardContainer";

type Pick = {
  value: number;
};

export type Player = {
  id: string;
  total: number;
  picks: Pick[];
};

export type Match = {
  matchId: string;
  players: Player[];
  betAmount: number;
  status: string;
  winner: string | null;
  deck: [];
  turn: string;
  round: number;
  reason?: string; 
};

export default function CardDraw() {
  const { roomId } = useParams();
  const navigate = useNavigate(); // ✅

  const [playerId] = useState(() => {
    let id = localStorage.getItem("playerId");
    if (!id) {
      id = "player_" + Math.floor(Math.random() * 100000);
      localStorage.setItem("playerId", id);
    }
    return id;
  });

  const [match, setMatch] = useState<Match | null>(null);

  useEffect(() => {
    if (!roomId) return;

    socket.emit("player:register", { playerId });
    socket.emit("carddraw:join", { roomId });

    socket.on("carddraw:start", (data) => {
      setMatch(data);
    });

    socket.on("carddraw:update", ({ match }) => {
      setMatch(match);
    });

    socket.on("carddraw:result", (finalMatch) => {
      setMatch(finalMatch);
    });

    // ✅ NEW: opponent left handler
    socket.on("carddraw:opponent-left", () => {
      setMatch((prev) =>
        prev
          ? {
            ...prev,
            status: "finished",
            winner: null,
            reason: "opponent_left",
          }
          : prev
      );

      // small delay for UX
      setTimeout(() => {
        navigate("/carddraw"); // or "/" or matchmaking page
      }, 2000);
    });

    return () => {
      socket.off("carddraw:start");
      socket.off("carddraw:update");
      socket.off("carddraw:result");
      socket.off("carddraw:opponent-left"); // ✅ cleanup
    };
  }, [roomId, playerId, navigate]);

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
          {match.players.map((player: Player, idx: number) => (
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
            <CardContainer
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
              ${match.reason === "opponent_left"
                  ? "bg-yellow-500 text-white" // ✅ special case
                  : match.winner === playerId
                    ? "bg-green-500 text-white"
                    : "bg-red-500 text-white"
                }`}
            >
              {match.reason === "opponent_left"
                ? "⚠️ Opponent Left"
                : match.winner === playerId
                  ? "🎉 You Win"
                  : "💀 You Lose"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}