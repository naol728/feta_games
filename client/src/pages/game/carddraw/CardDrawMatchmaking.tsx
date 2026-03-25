import { useEffect, useState } from "react";
import { socket } from "@/lib/socket";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ArrowLeft } from "lucide-react";
import { toast } from "react-toastify";
import { Badge } from "@/components/ui/badge";

export default function CardDrawMatchmaking() {
  const navigate = useNavigate();

  const [playerId] = useState(() => {
    let id = localStorage.getItem("playerId");
    if (!id) {
      id = "player_" + Math.floor(Math.random() * 100000);
      localStorage.setItem("playerId", id);
    }
    return id;
  });

  const [betAmount, setBetAmount] = useState<number | null>(null);
  const [searching, setSearching] = useState(false);
  const [queues, setQueues] = useState<[]>([]);

  useEffect(() => {
    socket.emit("carddraw:queue:list");

    socket.on("carddraw:queue:list", (data) => setQueues(data));
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
      toast.info("Finding Match...");
    });

    socket.on("carddraw:matched", ({ roomId }) => {
      setSearching(false);
      navigate(`/carddraw/${roomId}`);
    });

    socket.on("carddraw:cancelled", () => setSearching(false));

    socket.on("error", () => setSearching(false));

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

          {!searching ? (
            <>
              <div className="text-xs text-muted-foreground text-center">
                Select Bet Amount
              </div>

              <RadioGroup
                value={betAmount?.toString() || ""}
                onValueChange={(v) => setBetAmount(Number(v))}
                className="grid grid-cols-3 gap-2"
              >
                {[10, 50, 100].map((amount) => (
                  <Label
                    key={amount}
                    className={`
                      flex items-center justify-center
                      py-2 rounded-md text-sm font-semibold cursor-pointer
                      border transition-all
                      ${betAmount === amount
                        ? "border-primary bg-primary/20 shadow-sm"
                        : "border-border hover:border-primary/40"
                      }
                    `}
                  >
                    <RadioGroupItem
                      value={amount.toString()}
                      className="hidden"
                    />
                    {amount} ETB
                  </Label>
                ))}
              </RadioGroup>

              <Button
                onClick={startMatchmaking}
                disabled={!betAmount}
                className="w-full h-9 text-sm font-semibold"
              >
                Find Match
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center gap-3 py-3">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />

              <p className="text-xs text-muted-foreground">
                Matching ({betAmount} ETB)
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
        </CardContent>
      </Card>

      {/* Queue Lobby */}
      {!searching && (
        <div className="space-y-2">
          {queues.map((q: { bet: number; count: number; players: [] }) => (
            <Card
              key={q.bet}
              className="bg-card border border-border/80 shadow-sm"
            >
              <CardHeader className="flex flex-row items-center justify-between px-3 py-2">
                <span className="text-xs font-semibold">
                  {q.bet} ETB
                </span>

                <Badge
                  variant="secondary"
                  className="text-[10px] px-2 py-0.5"
                >
                  {q.count}
                </Badge>
              </CardHeader>

              <CardContent className="px-2 pb-2 space-y-1">
                {q.players.length === 0 && (
                  <div className="text-[10px] text-muted-foreground px-1">
                    Empty queue
                  </div>
                )}

                {q.players.map(
                  (p: { queueId: number; playerId: number }) => (
                    <div
                      key={p.queueId}
                      className="
                        flex items-center justify-between
                        px-2 py-1.5 rounded-md
                        border border-border/60
                        bg-muted/20
                        hover:bg-muted/40
                        transition
                      "
                    >
                      <span className="text-[11px] font-mono opacity-80">
                        {p.playerId}
                      </span>

                      <Button
                        size="sm"
                        className="h-6 px-2 text-[10px]"
                        onClick={() =>
                          socket.emit("carddraw:queue:join", {
                            queueId: p.queueId,
                            bet: q.bet,
                            playerId,
                          })
                        }
                      >
                        Join
                      </Button>
                    </div>
                  )
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}