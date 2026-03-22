import { useEffect, useState } from "react"
import { socket } from "@/lib/socket"
import { useNavigate } from "react-router-dom"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { ArrowLeft } from "lucide-react"



export default function ConnectFourMatchmaking() {
  const navigate = useNavigate()

  const [playerId] = useState(() => {
    let id = localStorage.getItem("playerId")
    if (!id) {
      id = "player_" + Math.floor(Math.random() * 100000)
      localStorage.setItem("playerId", id)
    }
    return id
  })

  const [betAmount, setBetAmount] = useState<number | null>(null)
  const [searching, setSearching] = useState(false)

  const [rooms, setRooms] = useState<any[]>([])

useEffect(() => {
  socket.emit("connectfour:queue:list")

  socket.on("connectfour:queue:list", (data) => {
    setRooms(data)
  })
  socket.on("connectfour:queue:update", () => {
  socket.emit("connectfour:queue:list")
})

  return () => {
    socket.off("connectfour:queue:list")
     socket.off("connectfour:queue:update")
  }
}, [])

  useEffect(() => {
    socket.emit("player:register", { playerId })

    socket.on("connectfour:matched", ({ roomId }: { roomId: string }) => {
      navigate(`/connectfour/${roomId}`)
    })
    socket.on("error", (msg) => {
  console.error(msg)
  setSearching(false)
})  
    socket.on("connectfour:cancelled", () => {
      setSearching(false)
  socket.emit("connectfour:queue:list")
     console.log("Matchmaking cancelled")
    })
    

    return () => {
      socket.off("connectfour:matched")
    }
  }, [playerId, navigate])

  const startMatchmaking = () => {
   if (!betAmount || searching) return 
    setSearching(true)

    socket.emit("connectfour:queue", {
      playerId,
      bet: Number(betAmount),
    })
  }

  const cancelMatchmaking = () => {
    setSearching(false)
    socket.emit("connectfour:cancel", { playerId })
  }

  useEffect(() => {
  const interval = setInterval(() => {
    socket.emit("connectfour:queue:list")
  }, 5000)

  return () => clearInterval(interval)
}, [])

 const joinRoom = (targetPlayerId: string, bet: number) => {
  if(targetPlayerId === playerId) return
  socket.emit("connectfour:queue:join_player", {
    playerId,
    targetPlayerId,
    bet
  })
}

  return (
    <div className="relative flex flex-col min-h-screen overflow-hidden">

      {/* Animated Background */}
      <div className="absolute inset-0 -z-10 animate-gradient bg-[linear-gradient(270deg,hsl(var(--primary)),hsl(var(--secondary)),hsl(var(--accent)),hsl(var(--primary)))] bg-[length:600%_600%]" />
      {/* Top Bar */}
      <div className="flex items-center px-3 pt-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="rounded-full"  
        >
          <ArrowLeft className="h-3 w-3" /> <span className="text-xs">Back</span>
        </Button> 
        <h1 className="text-lg font-semibold mx-auto pr-8">
          Matchmaking
        </h1>
      </div>

      {/* Content */}
      <div className="flex-1 p-3 space-y-4">

        {/* Matchmaking Card */}
        <Card className="bg-card/80 backdrop-blur-xl">
          <CardContent className="p-4 space-y-4">
            {!searching ? (
              <>
                <h2 className="text-base font-medium text-center">
                  Select Bet
                </h2>

                <RadioGroup
                  value={betAmount?.toString() || ""}
                  onValueChange={(v) => setBetAmount(Number(v))}
                  className="flex justify-between"
                >
                  {[10, 50, 100].map((amount) => (
                    <Label
                      key={amount}
                      htmlFor={`bet-${amount}`}
                      className={`
                        flex flex-col items-center justify-center
                        w-full py-3 rounded-xl border cursor-pointer
                        ${betAmount === amount ? "border-primary bg-primary/10" : "border-border"}
                      `}
                    >
                      <RadioGroupItem
                        value={amount.toString()}
                        id={`bet-${amount}`}
                        className="hidden"
                      />
                      <span className="text-sm font-medium">
                        {amount} birr
                      </span>
                    </Label>
                  ))}
                </RadioGroup>

                <Button
                  onClick={startMatchmaking}
                  disabled={!betAmount}
                  className="w-full h-11 text-base"
                >
                  Start Match
                </Button>
              </>
            ) : (
              <div className="flex flex-col items-center gap-4 py-4">
                <div className="w-10 h-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
                <p className="text-sm text-center">
                  Finding opponent ({betAmount} birr)
                </p>

                <Button
                  variant="destructive"
                  onClick={cancelMatchmaking}
                  className="w-full"
                >
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Rooms List */}
        {!searching && (
          <Card className="bg-card/80 backdrop-blur-xl">
            <CardContent className="p-4 space-y-3">
              <h2 className="text-sm font-medium">
                Available Rooms
              </h2>

             {rooms.map((group) => (
  <div key={group.bet}>
    
    <p className="text-sm font-medium mb-2">{group.bet} birr</p>

    {group.players.length === 0 ? (
  <p className="text-xs text-muted-foreground">No players</p>
) : group.players.filter((p: any) => p.playerId !== playerId).map((p: any) => (
      <div
        key={p.playerId}
        className="flex justify-between p-2 border rounded"
      >
        <span className="text-xs">{p.playerId}</span>

        <Button
          size="sm"
          disabled={searching} // ✅ prevent conflict
          onClick={() => joinRoom(p.playerId, group.bet)}
        >
          Join
        </Button>
      </div>
    ))}
  </div>
))}
            </CardContent>
          </Card>
        )}
      </div>

      {/* Gradient Animation */}
      <style>
        {`
          @keyframes gradientMove {
            0% { background-position: 0% 50% }
            50% { background-position: 100% 50% }
            100% { background-position: 0% 50% }
          }
          .animate-gradient {
            animation: gradientMove 8s ease infinite;
          }
        `}
      </style>
    </div>
  )
}