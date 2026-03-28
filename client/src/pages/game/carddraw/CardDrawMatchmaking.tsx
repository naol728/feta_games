import { useEffect, useState } from "react";
import { socket } from "@/lib/socket";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import { toast } from "react-toastify";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
export default function CardDrawMatchmaking() {
  const navigate = useNavigate();
  const [showRules, setShowRules] = useState(false);
  const [playerId] = useState(() => {
    let id = localStorage.getItem("playerId");
    if (!id) {
      id = "player_" + Math.floor(Math.random() * 100000);
      localStorage.setItem("playerId", id);
    }
    return id;
  });
  useEffect(() => {
    const t = setTimeout(() => {
      setShowRules(true);
    }, 300);

    return () => clearTimeout(t);
  }, []);
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("hide_rules")) {
      setShowRules(true);
    }
  }, []);


  const [loadingQueues, setLoadingQueues] = useState(true);
  const [betAmount, setBetAmount] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [queues, setQueues] = useState<[]>([]);

  useEffect(() => {
    socket.emit("carddraw:queue:list");

    socket.on("carddraw:queue:list", (data) => {
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
    socket.emit("player:register", { playerId });

    socket.on("carddraw:waiting", () => {
      setSearching(true);
      toast("🔍 Finding opponent...", { type: "info" });
    });

    socket.on("carddraw:matched", ({ roomId }) => {
      toast.dismiss();
      toast("⚡ Match found!", { type: "success" });
      setSearching(false);
      navigate(`/carddraw/${roomId}`);
    });

    socket.on("carddraw:cancelled", () => {
      toast("Cancelled", { type: "info" });
      setSearching(false);
    });

    socket.on("error", () => {
      toast("Something went wrong", { type: "error" });
      setSearching(false);
    });

    return () => {
      socket.off("carddraw:waiting");
      socket.off("carddraw:matched");
      socket.off("carddraw:cancelled");
      socket.emit("carddraw:cancel");
    };
  }, [playerId, navigate]);

  const startMatchmaking = () => {
    if (!betAmount || searching) return;

    setSearching(true);
    socket.emit("carddraw:queue", {
      playerId,
      bet: Number(betAmount),
    });
  };

  const cancelMatchmaking = () => {
    setSearching(false);
    toast.info("Finding Canceled...");
    socket.emit("carddraw:cancel");
  };

  return (
    <div className="min-h-screen bg-background text-foreground px-3 py-2 space-y-3">

      {/* Header */}
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="rounded-full h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>

        <h1 className="text-sm font-semibold tracking-wide">
          CARD DRAW
        </h1>
      </div>

      {/* Betting Card */}
      <Card className="bg-card border border-border shadow-md">
        <CardContent className="p-3 space-y-3">
          <div className="mt-3 px-2 space-y-3">

            {!searching ? (
              <>
                <div className="text-[11px] text-muted-foreground text-center">
                  Select bet
                </div>

                <div className="flex gap-2">
                  {[10, 50, 100].map((amount) => (
                    <button
                      key={amount}
                      onClick={() => setBetAmount(amount)}
                      className={`
              flex-1 py-2 rounded-md text-xs font-semibold border
              ${betAmount === amount
                          ? "bg-primary/15 border-primary text-primary"
                          : "bg-muted/30 border-border"
                        }
            `}
                    >
                      {amount}
                    </button>
                  ))}
                </div>

                <Button
                  onClick={startMatchmaking}
                  disabled={!betAmount}
                  className="w-full h-9 text-sm"
                >
                  Find Match
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 py-3">
                <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                <p className="text-[11px] text-muted-foreground">
                  Matching {betAmount} ETB
                </p>

                <Button
                  variant="destructive"
                  onClick={cancelMatchmaking}
                  className="w-full h-8 text-xs"
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Queue Lobby */}
      {!searching && (
        <div className="mt-4 space-y-2 px-2">
          <div className="text-[11px] text-muted-foreground">
            Live tables
          </div>

          {loadingQueues ? (
            <div className="flex justify-center py-4">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : queues.map((q: any) => (
            <div
              key={q.bet}
              className="rounded-md border border-border/40 bg-muted/20 p-2"
            >
              <div className="flex justify-between items-center text-[11px] mb-1">
                <span className="font-semibold">{q.bet} ETB</span>
                <span className="text-muted-foreground">{q.count} players</span>
              </div>

              <div className="space-y-1 max-h-[120px] overflow-y-auto">
                {q.players.length === 0 ? (
                  <div className="text-[10px] text-muted-foreground">
                    Empty
                  </div>
                ) : (
                  q.players.map((p: any) => (
                    <div
                      key={p.queueId}
                      className="flex justify-between items-center text-[10px] bg-muted/30 px-2 py-1 rounded"
                    >
                      <span className="truncate">{p.playerId}</span>

                      <button
                        className="text-primary text-[10px]"
                        onClick={() =>
                          socket.emit("carddraw:queue:join", {
                            queueId: p.queueId,
                            bet: q.bet,
                            playerId,
                          })
                        }
                      >
                        Join
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          ))}
        </div>
      )
      }

      <Dialog open={showRules} onOpenChange={setShowRules} >
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
          <label className="flex items-center gap-2 text-[11px] mt-2">
            <input
              type="checkbox"
              onChange={(e) => {
                if (e.target.checked) {
                  localStorage.setItem("hide_rules", "1");
                }
              }}
            />
            Don't show again
          </label>

          <Button
            className="mt-3 w-full"
            onClick={() => setShowRules(false)}
          >
            Got it
          </Button>
        </DialogContent>
      </Dialog>
    </div>);
}