/*eslint-disable*/
import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Trophy, Coins, User, Clock } from "lucide-react";
import Players from "./Players";
import CardContainer from "./CardContainer";
import { toast } from "react-toastify";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import confetti from "canvas-confetti";
import { getSocket } from "@/lib/socket";
import { useAppSelector } from "@/store/hook";
import { playGameplaySound, stopGameplaySound } from "@/lib/sound";
import { Card, CardContent } from "@/components/ui/card";
type Pick = { value: number };
export type Player = { id: string; total: number; picks: Pick[] };
export type Match = {
  matchId: string;
  players: Player[];
  betAmount: number;
  status: string;
  winner: string | null;
  deck: any[];
  turn: string;
  round: number;
  totalPot: number;
  fee: number;
  winnerAmount: number;
  reason?: string;
};

export default function CardDraw() {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const socket = getSocket();
  const playerId = useAppSelector((state) => state.auth.user?.id)
  const auth = useAppSelector((state) => state.auth)
  const [match, setMatch] = useState<Match | null>(null);
  const [showResult, setShowResult] = useState(false);

  const isWin = match?.winner === playerId;
  const isLose = match?.winner !== playerId && match?.reason !== "opponent_left";
  const isLeft = match?.reason === "opponent_left";
  const profit = match ? match?.winnerAmount - match?.betAmount : 0;

  const status = isWin ? "WIN" : isLose ? "LOSE" : "DRAW";
  useEffect(() => {
    if (!match) return;

    if (match.status === "playing") {
      playGameplaySound();
    }

    if (match.status === "finished") {
      stopGameplaySound();
    }

    return () => stopGameplaySound();
  }, [match?.status]);

  // Confetti on win
  useEffect(() => {
    if (showResult && isWin) {
      confetti({ particleCount: 200, spread: 70, origin: { y: 0.6 } });
    }
  }, [showResult]);

  useEffect(() => {
    if (match?.status === "finished") setShowResult(true);
  }, [match?.status]);

  useEffect(() => {
    if (!roomId) return;

    socket.emit("player:register", { playerId });
    socket.emit("carddraw:join", { roomId });

    socket.on("carddraw:start", (data) => {
      toast.success("Game Started");
      setMatch(data);
    });

    socket.on("carddraw:update", ({ match }) => setMatch(match));
    socket.on("carddraw:result", (finalMatch) => setMatch(finalMatch));

    socket.on("carddraw:opponent-left", () => {
      toast.error("Opponent Left");
      setMatch((prev) =>
        prev
          ? { ...prev, status: "finished", winner: playerId || null, reason: "opponent_left" }
          : prev
      );
      setTimeout(() => navigate("/carddraw"), 5000);
    });

    return () => {
      socket.off("carddraw:start");
      socket.off("carddraw:update");
      socket.off("carddraw:result");
      socket.off("carddraw:opponent-left");
      stopGameplaySound();
    };
  }, [roomId, playerId, navigate]);

  if (!match)
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background to-muted animate-fadeIn">
        <div className="w-96 text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-2"></div>
          <p className="text-muted-foreground">Waiting for match to start...</p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen px-3 py-5 space-y-5">
      {/* Top info */}
      <div className="flex justify-between items-center bg-muted/30 border border-border/30 px-3 py-2 rounded-md">
        <div className="flex gap-3 text-[11px]">
          <span className="flex items-center gap-1 font-medium"><Trophy className="w-3 h-3" /> R{match.round}</span>
          <span className="flex items-center gap-1 text-muted-foreground"><Coins className="w-3 h-3" /> bet amount {match.betAmount}</span>
          <span className="flex items-center gap-1 text-muted-foreground"><Coins className="w-3 h-3" />win amount {match.winnerAmount}</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] whitespace-nowrap">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          {match.status === "finished" ? <span className="text-red-500 font-medium">Ended</span> : match.turn === playerId ? (
            <span className="text-primary font-semibold flex items-center gap-1"><User className="w-3 h-3" /> Your Turn</span>
          ) : <span className="text-muted-foreground">Opponent</span>}
        </div>
      </div>

      {/* Players */}
      <div className="flex flex-col gap-2">
        {match.players.map((player, idx) => <Players key={idx} player={player} />)}
      </div>

      {/* Deck */}
      <div className="py-5 space-y-3">
        <div className="flex justify-between items-center px-2">
          <h3 className="text-[12px] font-semibold text-muted-foreground">Game Deck</h3>
          <Badge variant="outline" className="text-[10px] px-2 py-[2px]">{match.deck.filter(d => d.revealed).length} cards remaining</Badge>
        </div>
        <CardContainer deck={match.deck} roomId={roomId} playerId={playerId} match={match} />
      </div>

      {/* Result Dialog */}
      <Dialog open={showResult}>
        <DialogContent showCloseButton={false} className={`w-[300px] text-center p-6 border border-white/10 bg-[#0f172a] text-white backdrop-blur-xl 
          ${isWin ? "shadow-[0_0_40px_rgba(16,185,129,0.35)] animate-[winPop_0.4s_ease]" : ""}
          ${isLose ? "shadow-[0_0_40px_rgba(239,68,68,0.35)] animate-[loseShake_0.4s_ease]" : ""}
          ${isLeft ? "shadow-[0_0_40px_rgba(245,158,11,0.35)]" : ""}
        `}>
          <DialogHeader>
            <DialogTitle className="text-lg font-bold tracking-wide">
              {isLeft ? "Opponent Left" : isWin ? "Victory" : "Defeat"}
            </DialogTitle>
            <DialogDescription className="text-xs text-white/70 mt-1">
              {isLeft ? "Win by default" : isWin ? "Well played" : "Try again"}
            </DialogDescription>
          </DialogHeader>

          <Card className="mt-5 bg-muted/40 border-border/60 backdrop-blur-sm">
            <CardContent className="p-4 space-y-2">

              {/* Header */}
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">Result</span>

                <Badge
                  variant="secondary"
                  className={`
              text-[10px] px-2 py-0.5
              ${isWin ? "bg-emerald-500/10 text-emerald-500" : ""}
              ${isLose ? "bg-red-500/10 text-red-500" : ""}
              ${!isWin && !isLose ? "bg-amber-500/10 text-amber-500" : ""}
            `}
                >
                  {status}
                </Badge>
              </div>

              {/* Amount */}
              <div className="flex items-end gap-1">
                <span
                  className={`
              text-3xl font-semibold tracking-tight
              ${isWin ? "text-emerald-500" : ""}
              ${isLose ? "text-red-500" : ""}
              ${!isWin && !isLose ? "text-amber-500" : ""}
            `}
                >
                  {isWin || isLeft
                    ? `+${profit.toLocaleString()}`
                    : `-${match.betAmount.toLocaleString()}`}
                </span>

                <span className="text-xs text-muted-foreground mb-1">
                  ETB
                </span>
              </div>

              {/* Footer Info */}
              <div className="text-[11px] text-muted-foreground">
                Bet: {match.betAmount.toLocaleString()} ETB
              </div>

            </CardContent>
          </Card>

          <Button className="mt-6 w-full text-sm bg-white/10 hover:bg-white/20 text-white border border-white/10" onClick={() => navigate("/carddraw")}>Play Again</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}