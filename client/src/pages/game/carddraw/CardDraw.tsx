import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { socket } from "@/lib/socket";
import { CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Coins, User, Clock } from "lucide-react";
import Players from "./Players";
import CardContainer from "./CardContainer";
import { toast } from "react-toastify";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import confetti from "canvas-confetti";

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
  const navigate = useNavigate();

  const [playerId] = useState(() => {
    let id = localStorage.getItem("playerId");
    if (!id) {
      id = "player_" + Math.floor(Math.random() * 100000);
      localStorage.setItem("playerId", id);
    }
    return id;
  });

  const [match, setMatch] = useState<Match | null>(null);
  const [showResult, setShowResult] = useState(false);
  const isWin = match?.winner === playerId;
  const isLose =
    match?.winner !== playerId && match?.reason !== "opponent_left";
  const isLeft = match?.reason === "opponent_left";

  useEffect(() => {
    if (!showResult) return;

    if (isWin) {
      confetti({
        particleCount: 120,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [showResult]);
  useEffect(() => {
    if (match?.status === "finished") {
      setShowResult(true);
    }
  }, [match?.status]);

  useEffect(() => {
    if (!roomId) return;

    socket.emit("player:register", { playerId });
    socket.emit("carddraw:join", { roomId });

    socket.on("carddraw:start", (data) => {
      toast.success("Game Started")
      setMatch(data);
    });

    socket.on("carddraw:update", ({ match }) => {
      setMatch(match);
    });

    socket.on("carddraw:result", (finalMatch) => {
      setMatch(finalMatch);
    });

    socket.on("carddraw:opponent-left", () => {
      toast.error("Opponet Left")
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
      socket.off("carddraw:opponent-left");
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
        <div className="mt-3 px-2 py-2 rounded-md bg-muted/30 border border-border/30">
          <div className="flex items-center justify-between gap-2">

            {/* LEFT: round + bet */}
            <div className="flex items-center gap-2 text-[11px] min-w-0">
              <span className="flex items-center gap-1 font-medium">
                <Trophy className="w-3 h-3" />
                R{match.round}
              </span>

              <span className="flex items-center gap-1 text-muted-foreground">
                <Coins className="w-3 h-3" />
                {match.betAmount}
              </span>
            </div>

            {/* RIGHT: status */}
            <div className="flex items-center gap-1 text-[11px] whitespace-nowrap">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />

              {match.status === "finished" ? (
                <span className="text-red-500 font-medium">
                  Ended
                </span>
              ) : match.turn === playerId ? (
                <span className="text-primary font-semibold flex items-center gap-1">
                  <User className="w-3 h-3" />
                  Your Turn
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Opponent
                </span>
              )}
            </div>

          </div>
        </div>

        <div className="flex flex-col gap-2 mt-3 px-2">
          {match.players.map((player: Player, idx: number) => (
            <Players key={idx} player={player} />
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

        <Dialog open={showResult}>
          <DialogContent
            className={`
      w-[300px] text-center p-6 border border-white/10
      bg-[#0f172a] text-white backdrop-blur-xl

      ${isWin && "shadow-[0_0_40px_rgba(16,185,129,0.35)]"}
      ${isLose && "shadow-[0_0_40px_rgba(239,68,68,0.35)]"}
      ${isLeft && "shadow-[0_0_40px_rgba(245,158,11,0.35)]"}

      ${isWin && "animate-[winPop_0.4s_ease]"}
      ${isLose && "animate-[loseShake_0.4s_ease]"}
    `}
          >
            <DialogHeader>
              <DialogTitle className="text-lg font-bold tracking-wide">
                {isLeft
                  ? "Opponent Left"
                  : isWin
                    ? "Victory"
                    : "Defeat"}
              </DialogTitle>

              <DialogDescription className="text-xs text-white/70 mt-1">
                {isLeft
                  ? "Win by default"
                  : isWin
                    ? "Well played"
                    : "Try again"}
              </DialogDescription>
            </DialogHeader>

            {/* RESULT AMOUNT */}
            <div className="mt-5">
              <div className="text-[11px] text-white/50">Result</div>

              <div
                className={`
          text-3xl font-bold mt-1 tracking-wide
          ${isWin && "text-emerald-400"}
          ${isLose && "text-red-400"}
          ${isLeft && "text-amber-400"}
        `}
              >
                {isWin || isLeft ? "+" : "-"}
                {match?.betAmount}
                <span className="text-xs ml-1 text-white/60">ETB</span>
              </div>
            </div>

            {/* ACTION */}
            <Button
              className="mt-6 w-full text-sm bg-white/10 hover:bg-white/20 text-white border border-white/10"
              onClick={() => navigate("/carddraw")}
            >
              Play Again
            </Button>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}