import express from "express";
import http from "http";
import { Server, Socket } from "socket.io";
import cors from "cors";
import dotenv from "dotenv";
import {
  User,
  Game,
  Player,
  Move,
  GameUpdateData,
  InviteData,
  LeaderboardEntry,
  PlayerInfo,
} from "./types";

dotenv.config();

const app = express();
const server = http.createServer(app);

// CORS configuration for direct client access
const corsOptions = {
  origin: process.env.CLIENT_URL || "http://localhost:5173",
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight requests - EXPRESS 5 FIX
app.options("*", (req, res) => {
  const origin = req.headers.origin;
  const allowedOrigin = process.env.CLIENT_URL || "http://localhost:5173";

  if (origin === allowedOrigin) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET, POST, PUT, DELETE, OPTIONS",
  );
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.status(204).end(); // 204 No Content for preflight
});

app.use(express.json());

// Socket.io setup with CORS
const io = new Server(server, {
  cors: corsOptions,
  transports: ["websocket", "polling"],
  connectionStateRecovery: {},
});

// Game state management
const games = new Map<string, Game>();
const users = new Map<string, User>();
const waitingPlayers: string[] = [];

// Game logic
const GameLogic = {
  createBoard: (): (string | null)[] => Array(9).fill(null),

  checkWinner: (board: (string | null)[]): string | null => {
    const winPatterns = [
      [0, 1, 2],
      [3, 4, 5],
      [6, 7, 8], // rows
      [0, 3, 6],
      [1, 4, 7],
      [2, 5, 8], // columns
      [0, 4, 8],
      [2, 4, 6], // diagonals
    ];

    for (const pattern of winPatterns) {
      const [a, b, c] = pattern;
      if (board[a] && board[a] === board[b] && board[a] === board[c]) {
        return board[a];
      }
    }

    return board.includes(null) ? null : "draw";
  },
};

// Socket.io connection handling
io.on("connection", (socket: Socket) => {
  console.log("New client connected:", socket.id);

  socket.on("register", (username: string) => {
    users.set(socket.id, {
      id: socket.id,
      username,
      score: 0,
      socket: socket,
    });
    socket.emit("registered", { userId: socket.id, username });
    console.log(`User registered: ${username} (${socket.id})`);
  });

  socket.on("find_game", () => {
    if (waitingPlayers.length > 0) {
      const opponentId = waitingPlayers.shift()!;
      createGame(socket.id, opponentId);
    } else {
      waitingPlayers.push(socket.id);
      socket.emit("waiting", { message: "Waiting for opponent..." });
    }
  });

  socket.on("invite_player", (opponentId: string) => {
    const opponent = users.get(opponentId);
    if (opponent) {
      socket.to(opponentId).emit("game_invite", {
        from: socket.id,
        fromUsername: users.get(socket.id)?.username || "Player",
      } as InviteData);
    }
  });

  socket.on("accept_invite", (fromId: string) => {
    createGame(socket.id, fromId);
  });

  socket.on(
    "make_move",
    ({ gameId, cellIndex }: { gameId: string; cellIndex: number }) => {
      const game = games.get(gameId);
      if (!game || game.winner) return;

      const player = game.players.find((p) => p.id === socket.id);
      if (!player || game.currentPlayer !== player.symbol) return;

      if (game.board[cellIndex] === null) {
        game.board[cellIndex] = player.symbol;
        game.moves.push({
          player: socket.id,
          cellIndex,
          symbol: player.symbol,
        });

        const winner = GameLogic.checkWinner(game.board);

        if (winner) {
          game.winner = winner;
          game.status = "finished";

          // Update scores
          if (winner !== "draw") {
            const winningPlayer = game.players.find((p) => p.symbol === winner);
            if (winningPlayer) {
              const user = users.get(winningPlayer.id);
              if (user) user.score += 10;
            }
          }
        } else {
          game.currentPlayer = game.currentPlayer === "X" ? "O" : "X";
        }

        // Prepare player info for broadcast
        const playerInfos: PlayerInfo[] = game.players.map((p) => ({
          id: p.id,
          username: users.get(p.id)?.username,
          symbol: p.symbol,
          score: users.get(p.id)?.score || 0,
        }));

        // Broadcast game update
        io.to(gameId).emit("game_update", {
          gameId,
          board: game.board,
          currentPlayer: game.currentPlayer,
          winner: game.winner,
          players: playerInfos,
        } as GameUpdateData);
      }
    },
  );

  socket.on("rematch", (gameId: string) => {
    const game = games.get(gameId);
    if (game && game.players.some((p) => p.id === socket.id)) {
      game.rematchRequests = game.rematchRequests || [];
      if (!game.rematchRequests.includes(socket.id)) {
        game.rematchRequests.push(socket.id);

        if (game.rematchRequests.length === 2) {
          // Both players want rematch
          resetGame(gameId);
        } else {
          // Notify other player
          socket.to(gameId).emit("rematch_requested", {
            from: socket.id,
            fromUsername: users.get(socket.id)?.username || "Player",
          });
        }
      }
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);

    // Remove from waiting list
    const waitingIndex = waitingPlayers.indexOf(socket.id);
    if (waitingIndex > -1) {
      waitingPlayers.splice(waitingIndex, 1);
    }

    // Handle active games
    users.delete(socket.id);

    // Notify opponents in active games
    for (const [gameId, game] of games.entries()) {
      if (game.players.some((p) => p.id === socket.id)) {
        socket.to(gameId).emit("opponent_disconnected", {
          playerId: socket.id,
          username: users.get(socket.id)?.username,
        });
        games.delete(gameId);
      }
    }
  });
});

function createGame(player1Id: string, player2Id: string): void {
  const gameId = `game_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const game: Game = {
    id: gameId,
    players: [
      { id: player1Id, symbol: "X" },
      { id: player2Id, symbol: "O" },
    ],
    board: GameLogic.createBoard(),
    currentPlayer: "X",
    winner: null,
    status: "active",
    moves: [],
    createdAt: new Date(),
  };

  games.set(gameId, game);

  // Add both players to game room
  io.sockets.sockets.get(player1Id)?.join(gameId);
  io.sockets.sockets.get(player2Id)?.join(gameId);

  // Prepare player info for notification
  const playerInfos: PlayerInfo[] = game.players.map((p) => ({
    id: p.id,
    username: users.get(p.id)?.username,
    symbol: p.symbol,
    score: users.get(p.id)?.score || 0,
  }));

  // Notify both players
  io.to(gameId).emit("game_started", {
    gameId,
    players: playerInfos,
    currentPlayer: game.currentPlayer,
  });

  console.log(`Game created: ${gameId} between ${player1Id} and ${player2Id}`);
}

function resetGame(gameId: string): void {
  const game = games.get(gameId);
  if (game) {
    game.board = GameLogic.createBoard();
    game.currentPlayer = "X";
    game.winner = null;
    game.status = "active";
    game.moves = [];
    game.rematchRequests = [];

    const playerInfos: PlayerInfo[] = game.players.map((p) => ({
      id: p.id,
      username: users.get(p.id)?.username,
      symbol: p.symbol,
      score: users.get(p.id)?.score || 0,
    }));

    io.to(gameId).emit("game_reset", {
      gameId,
      board: game.board,
      currentPlayer: game.currentPlayer,
      players: playerInfos,
    });
  }
}

// REST API endpoints
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    playersOnline: users.size,
    gamesActive: games.size,
    waitingPlayers: waitingPlayers.length,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/leaderboard", (req, res) => {
  const leaderboard: LeaderboardEntry[] = Array.from(users.values())
    .map((user) => ({
      username: user.username,
      score: user.score,
      id: user.id,
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  res.json({
    leaderboard,
    totalPlayers: users.size,
    updatedAt: new Date().toISOString(),
  });
});

app.get("/api/game/:gameId", (req, res) => {
  const game = games.get(req.params.gameId);
  if (game) {
    res.json({
      id: game.id,
      board: game.board,
      currentPlayer: game.currentPlayer,
      winner: game.winner,
      players: game.players.map((p) => ({
        id: p.id,
        username: users.get(p.id)?.username,
        symbol: p.symbol,
      })),
      createdAt: game.createdAt,
    });
  } else {
    res.status(404).json({ error: "Game not found" });
  }
});

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "XO Game Server API",
    version: "1.0.0",
    endpoints: {
      health: "/api/health",
      leaderboard: "/api/leaderboard",
      game: "/api/game/:id",
    },
    socket: {
      events: [
        "register",
        "find_game",
        "make_move",
        "rematch",
        "invite_player",
        "accept_invite",
      ],
    },
  });
});

// Error handling middleware
app.use(
  (
    err: any,
    req: express.Request,
    res: express.Response,
    next: express.NextFunction,
  ) => {
    console.error("Server error:", err);
    res.status(500).json({
      error: "Internal server error",
      message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  },
);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(
    `🌐 CORS enabled for: ${process.env.CLIENT_URL || "http://localhost:5173"}`,
  );
  console.log(`📡 WebSocket server ready at ws://localhost:${PORT}`);
});
