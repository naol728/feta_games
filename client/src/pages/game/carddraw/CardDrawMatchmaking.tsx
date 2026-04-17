import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "react-toastify";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { getSocket } from "@/lib/socket";
import { useAppSelector } from "@/store/hook";

type Player = {
  playerId: number;
  queueId: number;
};

type Queue = {
  bet: number;
  count: number;
  players: Player[];
};
export default function CardDrawMatchmaking() {
  const navigate = useNavigate();
  const [showRules, setShowRules] = useState(false);
  const socket = getSocket();
  const balance = useAppSelector((state) => state.auth.user?.wallets.balance ?? 0)
  const playerId = useAppSelector((state) => state.auth.user?.telegram_id)
  const [loadingQueues, setLoadingQueues] = useState(true);
  const [betAmount, setBetAmount] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [queues, setQueues] = useState<Queue[]>([]);
  const [showHelp, setShowHelp] = useState(false);
  useEffect(() => {
    if (localStorage.getItem("hide_rules")) return;

    const t = setTimeout(() => {
      setShowRules(true);
    }, 300);

    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    socket.emit("carddraw:queue:list");

    socket.on("carddraw:queue:list", (data: Queue[]) => {
      setQueues(data);
      setLoadingQueues(false);
    });

    socket.on("carddraw:queue:update", () => {
      socket.emit("carddraw:queue:list");
    });

    return () => {
      socket.off("carddraw:queue:list");
      socket.off("carddraw:queue:update");
    };
  }, []);

  useEffect(() => {
    socket.emit("player:register");

    socket.on("carddraw:waiting", () => {
      setSearching(true);
      toast(" Finding Player...", { type: "info" });
    });

    socket.on("carddraw:matched", ({ roomId }) => {
      toast.dismiss();
      toast(" Player found!", { type: "success" });
      setSearching(false);
      navigate(`/carddraw/${roomId}`);
    });

    socket.on("carddraw:cancelled", () => {
      toast("Cancelled", { type: "info" });
      setSearching(false);
    });

    return () => {
      socket.off("carddraw:waiting");
      socket.off("carddraw:matched");
      socket.off("carddraw:cancelled");
      socket.emit("carddraw:cancel");
    };
  }, [navigate]);

  const startMatchmaking = () => {
    if (!betAmount || searching) return;

    if (balance == null) {
      toast.error("Balance not loaded yet");
      return;
    }

    if (balance < betAmount) {
      toast.error("Insufficient Balance");
      return;
    }

    setSearching(true);
    socket.emit("carddraw:queue", {
      bet: Number(betAmount),
    });
  };

  const cardrawqueuejoin = (q: { bet: number }, p: { queueId: number }) => {
    if (searching) return;

    if (balance == null) {
      toast.error("Balance not loaded yet");
      return;
    }

    if (balance < q.bet) {
      toast.error("Insufficient Balance");
      return;
    }

    socket.emit("carddraw:queue:join", {
      queueId: p.queueId,
      bet: q.bet,
      playerId,
    })
  }

  const cancelMatchmaking = () => {
    setSearching(false);
    socket.emit("carddraw:cancel");
  };

  return (
    <div className=" bg-background text-foreground px-3 py-3 space-y-4">

      {/* HEADER */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-sm font-bold tracking-wide">CARD DRAW</h1>
          <p className="text-[11px] text-muted-foreground">
            1v1 ቀጥታ የተወዳዳሪ ውርድ ግጥሚያ
          </p>
        </div>

        {/* HELP BUTTON (?) */}
        <button
          onClick={() => setShowHelp(true)}
          className="w-7 h-7 rounded-full border border-border flex items-center justify-center text-xs font-bold hover:bg-muted transition"
        >
          ?
        </button>
      </div>

      {/* MATCH CARD */}
      <Card className="bg-card border border-border shadow-lg rounded-xl">
        <CardContent className="p-4 space-y-4">

          {!searching ? (
            <>
              <div className="text-center">
                <p className="text-[11px] text-muted-foreground">
                  የውርድ መጠን ይምረጡ
                </p>
              </div>

              {/* BET SELECTION */}
              <div className="grid grid-cols-3 gap-2">
                {[10, 50, 100, 500, 1000, 1500].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => setBetAmount(amount)}
                    className={`
                    py-2 rounded-lg text-xs font-semibold border transition
                    ${betAmount === amount
                        ? "bg-primary/15 border-primary text-primary scale-[1.02]"
                        : "bg-muted/20 border-border"
                      }
                  `}
                  >
                    {amount} ETB
                  </button>
                ))}
              </div>

              <Button
                onClick={startMatchmaking}
                disabled={!betAmount}
                className="w-full h-10 text-sm font-semibold"
              >
                Find Match
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-4">

              {/* SPINNER */}
              <div className="relative">
                <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <span className="absolute inset-0 flex items-center justify-center text-[10px] text-primary">
                  VS
                </span>
              </div>

              <p className="text-sm font-semibold">
                Matching {betAmount} ETB
              </p>

              <p className="text-[11px] text-muted-foreground">
                Finding opponent...
              </p>

              <Button
                variant="destructive"
                onClick={cancelMatchmaking}
                className="w-full h-9 text-xs"
              >
                Cancel Match
              </Button>
            </div>
          )}

        </CardContent>
      </Card>

      {/* LIVE TABLES */}
      {!searching && (
        <div className="space-y-2">

          <div className="flex items-center justify-between px-1">
            <h2 className="text-[11px] text-muted-foreground">
              Live Tables
            </h2>

            <span className="flex items-center gap-1 text-[10px] text-green-500">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              active
            </span>
          </div>

          {loadingQueues ? (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            queues.map((q) => (
              <div
                key={q.bet}
                className="rounded-xl border border-border bg-muted/10 p-3 space-y-2"
              >

                <div className="flex justify-between text-[11px]">
                  <span className="font-semibold">
                    💰 {q.bet} ETB Table
                  </span>
                  <span className="text-muted-foreground">
                    {q.count} players
                  </span>
                </div>

                <div className="space-y-1 max-h-[140px] overflow-y-auto">
                  {q.players.length === 0 ? (
                    <div className="text-[10px] text-muted-foreground">
                      No players yet
                    </div>
                  ) : (
                    q.players.map((p) => (
                      <div
                        key={p.queueId}
                        className="flex justify-between items-center text-[10px] bg-muted/20 px-2 py-1 rounded-md"
                      >
                        <span className="truncate opacity-80">
                          Player {p.playerId}
                        </span>

                        <button
                          className="text-primary font-semibold"
                          onClick={() => cardrawqueuejoin(q, p)}
                        >
                          Join
                        </button>
                      </div>
                    ))
                  )}
                </div>

              </div>
            ))
          )}
        </div>
      )}

      {/* RULES (UNCHANGED - EXACT SAME) */}
      <Dialog open={showRules} onOpenChange={setShowRules}>
        <DialogContent className="w-[300px] text-sm">
          <DialogHeader>
            <DialogTitle>How to Play</DialogTitle>
          </DialogHeader>

          <div className="space-y-2 text-[12px] text-muted-foreground">
            <p>• Each player draws cards from the deck</p>
            <p>• Highest total score wins</p>
            <p>• You take turns picking cards</p>
            <p>• Game ends after all rounds</p>
            <p>• Winner takes the bet</p>
          </div>

          <div className="flex items-center gap-2 mt-2 text-[11px]">
            <Label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="w-3 h-3 accent-primary"
                onChange={(e) => {
                  if (e.target.checked) {
                    localStorage.setItem("hide_rules", "1");
                  } else {
                    localStorage.removeItem("hide_rules");
                  }
                }}
              />
              Don't show again
            </Label>
          </div>

          <Button className="mt-3 w-full" onClick={() => setShowRules(false)}>
            Got it
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={showHelp} onOpenChange={setShowHelp}>
        <DialogContent className="w-[300px] text-sm">
          <DialogHeader>
            <DialogTitle>Help</DialogTitle>
          </DialogHeader>

          <div className="text-[12px] text-muted-foreground space-y-2">
            <p>🎮 This is a 1v1 betting game</p>
            <p>💰 Choose stake and find opponent</p>
            <p>🏆 Winner takes the bet</p>
          </div>

          <Button className="w-full mt-3" onClick={() => setShowHelp(false)}>
            Close
          </Button>
        </DialogContent>
      </Dialog>

    </div>
  )
}