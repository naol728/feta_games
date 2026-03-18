import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { socket } from "./../../lib/socket"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

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

function isTopEmpty(board: number[][], row: number, col: number): boolean {
  for (let r = 5; r >= 0; r--) {
    if (board[r][col] === 0) {
      return r === row
    }
  }
  return false
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

type BoardProps = {
  board: number[][]
  hoverCol: number | null
  setHoverCol: (col: number | null) => void
  onColumnClick: (col: number) => void
  disabled: boolean
  myValue: 1 | 2 | null
}

function Board({ board, hoverCol, setHoverCol, onColumnClick, disabled, myValue }: BoardProps) {
  return (
    <div className="w-full flex justify-center">
      <div className="grid grid-cols-7 gap-1 bg-blue-900 p-2 rounded-xl touch-manipulation">
        {board.map((row, rIndex) =>
          row.map((cell, cIndex) => {
            let color = "bg-white"
            if (cell === 1) color = "bg-red-500"
            if (cell === 2) color = "bg-yellow-400"

            if (hoverCol === cIndex && cell === 0 && isTopEmpty(board, rIndex, cIndex)) {
              color = myValue === 1 ? "bg-red-300" : "bg-yellow-200"
            }

            return (
              <div
                key={`${rIndex}-${cIndex}`}
                onMouseEnter={() => setHoverCol(cIndex)}
                onMouseLeave={() => setHoverCol(null)}
                onClick={() => !disabled && onColumnClick(cIndex)}
                className={`
                  w-9 h-9 sm:w-12 sm:h-12
                  rounded-full border-2 border-gray-800
                  ${color}
                  ${disabled ? "opacity-70" : "cursor-pointer active:scale-95"}
                  transition-all duration-150
                `}
              />
            )
          })
        )}
      </div>
    </div>
  )
}