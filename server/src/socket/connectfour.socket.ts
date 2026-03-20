import { redis } from "../config/radis"
import { Server, Socket } from "socket.io"

type Player = {
  id: string
  value: number
  color: "red" | "yellow"
}

type Room = {
  roomId: string
  players: Player[]
  bet_amount: number
  turn: string
  board: number[][]
  winner: string | null
  status: "playing" | "finished"
}

type QueueEntry = {
  playerId: string
  socketId: string
}

type QueueGroup = {
  bet: number
  playersCount: number
  players: QueueEntry[]
}

interface CustomSocket extends Socket {
  playerId?: string
  queueKey?: string | null
  queueEntry?: string | null
  roomId?: string
}

const QUEUE_KEY = (bet: number) => `queue:connectfour:${bet}`

function createBoard(): number[][] {
  return Array(6).fill(null).map(() => Array(7).fill(0))
}

function checkWinner(board: number[][]): number | null {
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

export default function connectFourSocket(io: Server, socket: CustomSocket){

  socket.on("player:register", async ({ playerId }: { playerId: string })=>{
    socket.playerId = playerId
    await redis.set(`player:${playerId}`, socket.id)
  })

  socket.on("connectfour:queue", async ({ playerId, bet }: { playerId: string, bet: number }) => {

    bet = Number(bet)
    const allowedBets = [10, 50, 100]

    if(!allowedBets.includes(bet)){
      socket.emit("error", "Invalid bet amount")
      return
    }

    const queueKey = QUEUE_KEY(bet)

    // remove old entry
    if(socket.queueKey && socket.queueEntry){
      await redis.lrem(socket.queueKey, 1, socket.queueEntry)
    }

    const entry: string = JSON.stringify({
      playerId,
      socketId: socket.id
    })

    socket.queueKey = queueKey
    socket.queueEntry = entry

    // safe matchmaking
    let opponentData: QueueEntry | null = null

    while(true){
      const opponent = await redis.rpop(queueKey)
      if(!opponent) break

      const parsed: QueueEntry = JSON.parse(opponent)
      const isAlive = io.sockets.sockets.get(parsed.socketId)

      if(isAlive){
        opponentData = parsed
        break
      }
    }

    if(!opponentData){
      await redis.lpush(queueKey, entry)
      socket.emit("connectfour:waiting")
      io.emit("connectfour:queue:update")
      return
    }

    socket.queueKey = null
    socket.queueEntry = null

    const roomId = `cf_${Date.now()}`

    const room: Room = {
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

    io.emit("connectfour:queue:update")

    io.to(opponentData.socketId).emit("connectfour:matched",{ roomId })
    io.to(socket.id).emit("connectfour:matched",{ roomId })
  })

  socket.on("connectfour:join", async ({ roomId }: { roomId: string }) => {

    const roomRaw = await redis.get(`room:connectfour:${roomId}`)

    if(!roomRaw){
      socket.emit("connectfour:not_found")
      return
    }

    const room: Room = JSON.parse(roomRaw)

    socket.join(roomId)
    socket.roomId = roomId

    socket.emit("connectfour:start", room)
  })

  socket.on("connectfour:move", async ({ roomId, playerId, column }: {
    roomId: string
    playerId: string
    column: number
  }) => {

    const key = `room:connectfour:${roomId}`
    const roomRaw = await redis.get(key)

    if(!roomRaw) return

    const room: Room = JSON.parse(roomRaw)

    if(room.winner) return

    const player = room.players.find(p => p.id === playerId)
    if(!player || room.turn !== playerId) return

    if(column < 0 || column > 6) return
    if(room.board[0][column] !== 0) return

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
      if(next) room.turn = next.id
    }

    await redis.set(key, JSON.stringify(room))
    io.to(roomId).emit("connectfour:update", room)
  })

  socket.on("connectfour:cancel", async () => {
    if(socket.queueKey && socket.queueEntry){
      await redis.lrem(socket.queueKey, 1, socket.queueEntry)
    }

    socket.queueKey = null
    socket.queueEntry = null

    socket.emit("connectfour:cancelled")
    io.emit("connectfour:queue:update")
  })

  socket.on("connectfour:queue:list", async () => {
    const bets = [10, 50, 100]
    const result: QueueGroup[] = []

    for (const bet of bets) {
      const key = QUEUE_KEY(bet)
      const list = await redis.lrange(key, 0, -1)

      const players: QueueEntry[] = list.map(item => JSON.parse(item))

      result.push({
        bet,
        playersCount: players.length,
        players
      })
    }

    socket.emit("connectfour:queue:list", result)
  })

  socket.on("connectfour:queue:join_player", async ({
    targetPlayerId,
    bet,
    playerId
  }: {
    targetPlayerId: string
    bet: number
    playerId: string
  }) => {

    if(targetPlayerId === playerId) return

    const key = QUEUE_KEY(bet)
    const list = await redis.lrange(key, 0, -1)

    let targetEntry: string | null = null

    for(const item of list){
      const parsed: QueueEntry = JSON.parse(item)
      if(parsed.playerId === targetPlayerId){
        targetEntry = item
        break
      }
    }

    if(!targetEntry){
      socket.emit("error", "Player not available")
      return
    }

    const opponentData: QueueEntry = JSON.parse(targetEntry)

    const isAlive = io.sockets.sockets.get(opponentData.socketId)
    if(!isAlive){
      await redis.lrem(key, 1, targetEntry)
      socket.emit("error", "Player offline")
      io.emit("connectfour:queue:update")
      return
    }

    await redis.lrem(key, 1, targetEntry)
    io.emit("connectfour:queue:update")

    const roomId = `cf_${Date.now()}`

    const room: Room = {
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

  socket.on("disconnect", async () => {

    if(socket.queueKey && socket.queueEntry){
      await redis.lrem(socket.queueKey, 1, socket.queueEntry)
      io.emit("connectfour:queue:update")
    }

    if(socket.roomId){
      const key = `room:connectfour:${socket.roomId}`
      const roomRaw = await redis.get(key)

      if(!roomRaw) return

      const room: Room = JSON.parse(roomRaw)

      const opponent = room.players.find(p => p.id !== socket.playerId)

      if(opponent){
        const opponentSocketId = await redis.get(`player:${opponent.id}`)
        if(opponentSocketId){
          io.to(opponentSocketId).emit("connectfour:opponent_left")
        }
      }

      await redis.del(key)
    }
  })
}