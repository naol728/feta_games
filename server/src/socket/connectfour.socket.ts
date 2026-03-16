import { redis } from "../config/radis"

function createBoard(){
  return Array(6).fill(null).map(()=>Array(7).fill(0))
}

export default function connectFourSocket(io, socket){

  socket.on("connectfour:join", async ({ playerId }) => {
    const queueKey = "queue:connectfour"

    // check if someone is waiting
    const waitingPlayer = await redis.rpop(queueKey)

    // -------------------------
    // CASE 1: no player waiting
    // -------------------------
    if(!waitingPlayer){

      await redis.lpush(queueKey, playerId)

      socket.emit("connectfour:waiting",{
        status:"waiting"
      })

      return
    }

    // -------------------------
    // CASE 2: found opponent
    // -------------------------

    const roomId = `cf_${Date.now()}`

    const room = {
      roomId,
      game:"connectfour",
      players:[
        { id: waitingPlayer, color:"red" },
        { id: playerId, color:"yellow" }
      ],
      turn: waitingPlayer,
      board: createBoard(),
      winner:null,
      status:"playing"
    }

    await redis.set(`room:connectfour:${roomId}`,room)

    // join socket room
    socket.join(roomId)

    // notify both players
    io.emit("connectfour:start",room)

  })

}