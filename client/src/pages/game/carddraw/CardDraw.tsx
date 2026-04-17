/*eslint-disable*/
import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { Badge } from "@/components/ui/badge"
import { Trophy, Coins, User, Clock, Volume2, VolumeX } from "lucide-react"
import Players from "./Players"
import CardContainer from "./CardContainer"
import { toast } from "react-toastify"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import confetti from "canvas-confetti"
import { getSocket } from "@/lib/socket"
import { useAppSelector } from "@/store/hook"
import {
  playGameplaySound,
  stopGameplaySound,
  toggleMute,
  getMuteState,
} from "@/lib/sound"
import { Card, CardContent } from "@/components/ui/card"

type Pick = { value: number }

export type Player = {
  id: string
  total: number
  picks: Pick[]
}

export type Match = {
  matchId: string
  players: Player[]
  betAmount: number
  status: string
  winner: string | null
  deck: any[]
  turn: string
  round: number
  totalPot: number
  fee: number
  winnerAmount: number
  reason?: string
}

export default function CardDraw() {
  const { roomId } = useParams<{ roomId: string }>()
  const navigate = useNavigate()
  const socket = getSocket()

  const playerId = useAppSelector((state) => state.auth.user?.id)

  const [match, setMatch] = useState<Match | null>(null)
  const [showResult, setShowResult] = useState(false)
  const [muted, setMuted] = useState(getMuteState())

  const isWin = match?.winner === playerId
  const isLose =
    match?.winner !== playerId && match?.reason !== "opponent_left"
  const isLeft = match?.reason === "opponent_left"
  const profit = match ? match.winnerAmount - match.betAmount : 0

  const status = isWin ? "WIN" : isLose ? "LOSE" : "DRAW"

  // 🔊 MUTE
  const handleToggleMute = () => {
    const state = toggleMute()
    setMuted(state)
  }

  // 🔊 SOUND CONTROL
  useEffect(() => {
    if (!match) return

    if (match.status === "playing") {
      playGameplaySound()
    }

    if (match.status === "finished") {
      stopGameplaySound()
    }

    return () => stopGameplaySound()
  }, [match?.status])

  // 🎉 CONFETTI
  useEffect(() => {
    if (showResult && isWin) {
      confetti({
        particleCount: 200,
        spread: 70,
        origin: { y: 0.6 },
      })
    }
  }, [showResult, isWin])

  useEffect(() => {
    if (match?.status === "finished") setShowResult(true)
  }, [match?.status])

  // 🔌 SOCKET
  useEffect(() => {
    if (!roomId) return

    socket.emit("player:register", { playerId })
    socket.emit("carddraw:join", { roomId })

    socket.on("carddraw:start", (data: Match) => {
      toast.success("Game Started")
      setMatch(data)
    })

    socket.on("carddraw:update", ({ match }: { match: Match }) =>
      setMatch(match)
    )

    socket.on("carddraw:result", (finalMatch: Match) =>
      setMatch(finalMatch)
    )

    socket.on("carddraw:opponent-left", () => {
      toast.error("Opponent Left")

      setMatch((prev) =>
        prev
          ? {
            ...prev,
            status: "finished",
            winner: playerId || null,
            reason: "opponent_left",
          }
          : prev
      )

      setTimeout(() => navigate("/carddraw"), 5000)
    })

    return () => {
      socket.off("carddraw:start")
      socket.off("carddraw:update")
      socket.off("carddraw:result")
      socket.off("carddraw:opponent-left")
      stopGameplaySound()
    }
  }, [roomId, playerId, navigate])

  // ⏳ LOADING
  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin h-10 w-10 border-b-2 border-primary rounded-full mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            Waiting for match...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen px-3 py-5 space-y-5 animate-in fade-in duration-300">

      {/* 🔝 HEADER */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-sm font-bold">CARD DRAW</h1>
          <p className="text-[11px] text-muted-foreground">
            1v1 ቀጥታ ውርድ ግጥሚያ
          </p>
        </div>

        <div className="flex items-center gap-2">
          {/* 🔊 MUTE */}
          <button
            onClick={handleToggleMute}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-muted/40 border border-border hover:bg-muted transition"
          >
            {muted ? (
              <VolumeX className="w-4 h-4 text-red-500" />
            ) : (
              <Volume2 className="w-4 h-4 text-primary" />
            )}
          </button>

          {/* LIVE */}
          {match.status !== "finished" && (
            <div className="flex items-center gap-1 text-[10px] text-green-500">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              LIVE
            </div>
          )}
        </div>
      </div>

      {/* 📊 MATCH INFO */}
      <Card className="bg-muted/30 border border-border/40">
        <CardContent className="flex justify-between items-center px-3 py-2 text-[11px]">
          <div className="flex gap-3">
            <span className="flex items-center gap-1 font-medium">
              <Trophy className="w-3 h-3" /> R{match.round}
            </span>

            <span className="flex items-center gap-1 text-muted-foreground">
              <Coins className="w-3 h-3" /> {match.betAmount} ETB
            </span>

            <span className="flex items-center gap-1 text-green-500">
              <Coins className="w-3 h-3" /> {match.winnerAmount}
            </span>
          </div>

          <div className="flex items-center gap-1">
            <Clock className="w-3 h-3 text-muted-foreground" />
            {match.status === "finished" ? (
              <span className="text-red-500">Ended</span>
            ) : match.turn === playerId ? (
              <span className="text-primary font-semibold">
                Your Turn
              </span>
            ) : (
              <span className="text-muted-foreground">Opponent</span>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 👥 PLAYERS */}
      <div className="space-y-2">
        {match.players.map((player, idx) => (
          <Players key={idx} player={player} />
        ))}
      </div>

      {/* 🃏 DECK */}
      <Card className="border border-border/40">
        <CardContent className="p-3 space-y-3">
          <div className="flex justify-between">
            <h3 className="text-[12px] font-semibold text-muted-foreground">
              Game Deck
            </h3>

            <Badge variant="outline" className="text-[10px]">
              {match.deck.filter((d) => d.revealed).length} opened
            </Badge>
          </div>

          <CardContainer
            deck={match.deck}
            roomId={roomId}
            playerId={playerId}
            match={match}
          />
        </CardContent>
      </Card>

      {/* 🏁 RESULT */}
      <Dialog open={showResult}>
        <DialogContent className="w-[300px] text-center">
          <DialogHeader>
            <DialogTitle>
              {isLeft
                ? "Opponent Left"
                : isWin
                  ? "You Won 🎉"
                  : "You Lost"}
            </DialogTitle>

            <DialogDescription>
              {isLeft
                ? "Win by default"
                : isWin
                  ? "Well played"
                  : "Try again"}
            </DialogDescription>
          </DialogHeader>

          <Card className="mt-4">
            <CardContent className="p-4 space-y-2">
              <div className="flex justify-between text-xs">
                <span>Result</span>
                <Badge>{status}</Badge>
              </div>

              <div className="text-3xl font-bold">
                {isWin || isLeft
                  ? `+${profit}`
                  : `-${match.betAmount}`}{" "}
                ETB
              </div>

              <p className="text-xs text-muted-foreground">
                Bet: {match.betAmount} ETB
              </p>
            </CardContent>
          </Card>

          <Button
            className="mt-4 w-full"
            onClick={() => navigate("/carddraw")}
          >
            Play Again
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}