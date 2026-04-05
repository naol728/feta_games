import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import Board from "./Board"
import { getSocket } from "@/lib/socket"

type Player = {
  id: string
  value: 1 | 2
}

type GameRoom = {
  id: string
  board: number[][]
  players: Player[]
  turn: string
  winner?: Player
}

type GameResult = {
  winner: Player
  loser: Player
}



export default function ConnectFour() {
  const { roomId } = useParams<{ roomId: string }>()
  const [result, setResult] = useState<GameResult | null>(null)
  const [game, setGame] = useState<GameRoom | null>(null)
  const [myValue, setMyValue] = useState<1 | 2 | null>(null)
  const [hoverCol, setHoverCol] = useState<number | null>(null)

  const [playerId] = useState<string>(() => {
    let id = localStorage.getItem("playerId")
    if (!id) {
      id = "player_" + Math.floor(Math.random() * 100000)
      localStorage.setItem("playerId", id)
    }
    return id
  })
  const socket = getSocket();

  const navigate = useNavigate()

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!game) navigate("/") // fallback
    }, 3000)

    return () => clearTimeout(timeout)
  }, [game, navigate])

  useEffect(() => {
    if (!roomId) return

    socket.emit("player:register", { playerId })
    socket.emit("connectfour:join", { roomId })

    socket.on("connectfour:start", (room: GameRoom) => {
      setGame(room)
      const me = room.players.find((p) => p.id === playerId)
      if (me) setMyValue(me.value)
    })

    socket.on("connectfour:update", (room: GameRoom) => {
      setGame(room)
    })

    socket.on("connectfour:gameover", ({ room, result }: { room: GameRoom; result: GameResult }) => {
      setGame(room)
      setResult(result)
    })

    socket.on("connectfour:opponent_left", () => {
      alert("Opponent disconnected")
      navigate("/")
    })

    return () => {
      socket.off("connectfour:start")
      socket.off("connectfour:update")
      socket.off("connectfour:gameover")
      socket.off("connectfour:opponent_left")
    }
  }, [roomId, playerId, navigate])

  const isMyTurn = game?.turn === playerId
  const handleColumnClick = (col: number) => {
    if (!game || !isMyTurn || game.winner) return
    socket.emit("connectfour:move", { roomId, column: col, playerId })
  }

  if (!game) return <div className="p-4 text-center">Loading...</div>

  return (
    <div className="p-3 max-w-md mx-auto">
      <Card className="rounded-2xl shadow-lg">
        <CardContent className="p-4 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold">Connect Four</h2>
            {game.winner ? (
              <Badge variant="destructive">Game Over</Badge>
            ) : isMyTurn ? (
              <Badge className="bg-green-500">Your Turn</Badge>
            ) : (
              <Badge variant="secondary">Opponent</Badge>
            )}
          </div>

          <Board
            board={game.board}
            hoverCol={hoverCol}
            setHoverCol={setHoverCol}
            onColumnClick={handleColumnClick}
            disabled={!isMyTurn || !!game.winner}
            myValue={myValue}
          />
        </CardContent>
      </Card>
    </div>
  )
}


