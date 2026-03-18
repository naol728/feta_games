import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { socket } from "./../../lib/socket"

import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"

function isTopEmpty(board, row, col){
  for(let r = 5; r >= 0; r--){
    if(board[r][col] === 0){
      return r === row
    }
  }
  return false
}

export default function ConnectFour(){

  const { roomId } = useParams()
const [result,setResult] = useState(null)
  const [game,setGame] = useState(null)
  const [myValue,setMyValue] = useState(null)
  const [hoverCol,setHoverCol] = useState(null)

  const [playerId] = useState(()=>{
    let id = localStorage.getItem("playerId")
    if(!id){
      id = "player_" + Math.floor(Math.random()*100000)
      localStorage.setItem("playerId", id)
    }
    return id
  })
  const navigate=useNavigate()
 useEffect(() => {

  let timeout = setTimeout(() => {
    if(!game){
      navigate("/") // fallback
    }
  }, 3000)

  return () => clearTimeout(timeout)

}, [game])

  useEffect(()=>{

    socket.emit("player:register",{ playerId })
    socket.on("connectfour:opponent_left", () => {
  alert("Opponent disconnected")
  navigate("/")
})
      socket.on("connectfour:opponent_left", () => {
    alert("Opponent disconnected")
    navigate("/") // or home
  })
    socket.emit("connectfour:join",{ roomId })

    socket.on("connectfour:start",(room)=>{
      setGame(room)
      const me = room.players.find(p=>p.id === playerId)
      if(me) setMyValue(me.value)
    })
  socket.on("connectfour:gameover", ({ room, result })=>{
  setGame(room)
  setResult(result)
})

    socket.on("connectfour:update",(room)=>{
      setGame(room)
    })

    return ()=>{
      socket.off("connectfour:start")
      socket.off("connectfour:update")
      socket.off("connectfour:gameover")
      socket.off("connectfour:opponent_left")
    }

  },[roomId])

  const isMyTurn = game?.turn === playerId

  const handleColumnClick = (col)=>{
    if(!game || !isMyTurn || game.winner) return

    socket.emit("connectfour:move",{
      roomId,
      column:col,
      playerId
    })
  }
const myPlayer = game?.players.find(p => p.id === playerId)

const amIWinner = result?.winner?.id === playerId
const amILoser = result?.loser?.id === playerId
  if(!game){
    return <div className="p-4 text-center">Loading...</div>
  }

  return (
    <div className="p-3 max-w-md mx-auto">

      <Card className="rounded-2xl shadow-lg">
        <CardContent className="p-4 space-y-4">

          {/* Header */}
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

          {/* Board */}
          <Board
            board={game.board}
            hoverCol={hoverCol}
            setHoverCol={setHoverCol}
            onColumnClick={handleColumnClick}
            disabled={!isMyTurn || game.winner}
            myValue={myValue}
          />

        </CardContent>
      </Card>

    </div>
  )
}

function Board({
  board,
  hoverCol,
  setHoverCol,
  onColumnClick,
  disabled,
  myValue
}){

  return (
    <div className="w-full flex justify-center">
      <div
        className="
          grid grid-cols-7 gap-1
          bg-blue-900 p-2 rounded-xl
          touch-manipulation
        "
      >
        {board.map((row,rIndex)=>
          row.map((cell,cIndex)=>{

            let color = "bg-white"

            if(cell === 1) color = "bg-red-500"
            if(cell === 2) color = "bg-yellow-400"

            // hover preview
            if(
              hoverCol === cIndex &&
              cell === 0 &&
              isTopEmpty(board, rIndex, cIndex)
            ){
              color = myValue === 1
                ? "bg-red-300"
                : "bg-yellow-200"
            }

            return (
              <div
                key={`${rIndex}-${cIndex}`}
                onMouseEnter={()=>setHoverCol(cIndex)}
                onMouseLeave={()=>setHoverCol(null)}
                onClick={()=>!disabled && onColumnClick(cIndex)}
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