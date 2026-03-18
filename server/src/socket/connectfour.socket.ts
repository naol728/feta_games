import { redis } from "../config/radis"

const QUEUE_KEY = (bet) => `queue:connectfour:${bet}`
function createBoard(){
  return Array(6).fill(null).map(()=>Array(7).fill(0))
}

function checkWinner(board){
  const dirs = [[0,1],[1,0],[1,1],[1,-1]]

  for(let r=0;r<6;r++){
    for(let c=0;c<7;c++){
      const p = board[r][c]
      if(!p) continue

      for(const [dr,dc] of dirs){
        let count = 1
        let rr=r+dr, cc=c+dc

        while(rr>=0 && rr<6 && cc>=0 && cc<7 && board[rr][cc]===p){
          count++
          rr+=dr
          cc+=dc
        }

        if(count >= 4) return p
      }
    }
  }
  return null
}

export default function connectFourSocket(io, socket){

  socket.on("player:register", async ({ playerId })=>{
  socket.playerId = playerId // ✅ REQUIRED
  await redis.set(`player:${playerId}`, socket.id)
})

socket.on("connectfour:queue", async ({ playerId, bet }) => {

  // ✅ force number
  bet = Number(bet)

  // ✅ validate allowed bets
  const allowedBets = [10, 50, 100]
  if(!allowedBets.includes(bet)){
    socket.emit("error", "Invalid bet amount")
    return
  }

  const queueKey = `queue:connectfour:${bet}`


  socket.queueKey = queueKey
  socket.playerId = playerId

  const opponent = await redis.rpop(queueKey)

  if(!opponent){
    await redis.lpush(queueKey, JSON.stringify({
      playerId,
      socketId: socket.id
    }))
    socket.emit("connectfour:waiting")
    return
  }

  const opponentData = JSON.parse(opponent)

  const roomId = `cf_${Date.now()}`
  const room = {
    roomId,
    players: [
      { id: opponentData.playerId, value: 1, color: "red" },
      { id: playerId, value: 2, color: "yellow" }
    ],
    bet_amount: bet,
    turn: opponentData.playerId,
    board: createBoard(),
    winner: null,
    status: "playing"
  }

  await redis.set(`room:connectfour:${roomId}`, JSON.stringify(room))

  io.to(opponentData.socketId).emit("connectfour:matched",{ roomId })
  io.to(socket.id).emit("connectfour:matched",{ roomId })
})

  socket.on("connectfour:join", async ({ roomId }) => {
  const room = await redis.get(`room:connectfour:${roomId}`)
 
  if(!room){
    socket.emit("connectfour:not_found")
    return
  }
  socket.join(roomId)

  // ✅ track room on socket
  socket.roomId = roomId

  socket.emit("connectfour:start", JSON.parse(room))
})

socket.on("connectfour:move", async ({ roomId, playerId, column }) => {

  const key = `room:connectfour:${roomId}`

  let room = await redis.get(key)
  if(typeof room === "string") room = JSON.parse(room)

  if(!room || room.winner) return

  const player = room.players.find(p => p.id === playerId)
  if(!player) return

  if(room.turn !== playerId) return

  // bounds
  if(column < 0 || column > 6) return

  // column full
  if(room.board[0][column] !== 0) return

  // ✅ gravity drop
  for(let r = 5; r >= 0; r--){
    if(room.board[r][column] === 0){
      room.board[r][column] = player.value
      break
    }
  }

  const win = checkWinner(room.board)

  if(win){
    room.winner = playerId
    room.status = "finished"
  } else {
    const next = room.players.find(p => p.id !== playerId)
    if(!next) return
    room.turn = next.id
  }

  await redis.set(key, JSON.stringify(room))

  io.to(roomId).emit("connectfour:update", room)
})
 socket.on("disconnect", async () => {

  // ✅ remove from queue (existing logic)
  if(socket.queueKey && socket.playerId){
    const list = await redis.lrange(socket.queueKey, 0, -1)

    for(const item of list){
      const parsed = JSON.parse(item)
      if(parsed.playerId === socket.playerId){
        await redis.lrem(socket.queueKey, 1, item)
        break
      }
    }
  }

  // ✅ handle active match
  if(socket.roomId){
    const key = `room:connectfour:${socket.roomId}`
    const roomData = await redis.get(key)

    if(!roomData) return

    const room = JSON.parse(roomData)

    // find opponent
    const opponent = room.players.find(p => p.id !== socket.playerId)

    if(opponent){
      const opponentSocketId = await redis.get(`player:${opponent.id}`)

      // notify opponent
      if(opponentSocketId){
        io.to(opponentSocketId).emit("connectfour:opponent_left")
      }
    }

    // delete room
    await redis.del(key)
  }
})

}