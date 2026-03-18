import { useEffect, useState } from "react"
import { socket } from "@/lib/socket"
import { useNavigate } from "react-router-dom"

export default function MatchMaking(){

  const navigate = useNavigate()

  const [playerId] = useState(()=>{
    let id = localStorage.getItem("playerId")
    if(!id){
      id = "player_" + Math.floor(Math.random()*100000)
      localStorage.setItem("playerId", id)
    }
    return id
  })

  const [betAmount, setBetAmount] = useState<number | null>(null)
  const [searching, setSearching] = useState(false)

  useEffect(()=>{
    socket.emit("player:register",{ playerId })

    socket.on("connectfour:waiting",()=>{
      console.log("Waiting for opponent...")
    })

    socket.on("connectfour:matched",({ roomId })=>{
      navigate(`/connectfour/${roomId}`)
    })

    return ()=>{
      socket.off("connectfour:waiting")
      socket.off("connectfour:matched")
    }
  },[])

  const startMatchmaking = () => {
    if(!betAmount) return
    setSearching(true)

    socket.emit("connectfour:queue", {
  playerId,
  bet: Number(betAmount) // force number
})
  }

  return (
    <div style={{padding:40}}>
      {!searching ? (
        <>
          <h2>Select Bet Amount</h2>

          <div style={{display:"flex", gap:10}}>
            {[10,50,100].map((amount)=>(
              <button
                key={amount}
                onClick={()=>setBetAmount(amount)}
                style={{
                  padding:10,
                  border: betAmount === amount ? "2px solid green" : "1px solid gray"
                }}
              >
                {amount} birr
              </button>
            ))}
          </div>

          <button
            onClick={startMatchmaking}
            disabled={!betAmount}
            style={{marginTop:20, padding:10}}
          >
            Start Match
          </button>
        </>
      ) : (
        <h2>Finding opponent for {betAmount} birr...</h2>
      )}
    </div>
  )
}