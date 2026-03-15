import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:5000", {
  transports: ["websocket"],
  withCredentials: true,
});

export default function ConnectFour() {
  const searchParams = new URLSearchParams(window.location.search);
  const roomIdParam = searchParams.get("roomId") || "room1";

  const [room, setRoom] = useState<any>(null);
  const [playerId] = useState(() => "player_" + Math.floor(Math.random() * 100000));
  const [roomId] = useState(roomIdParam);

  useEffect(() => {
    socket.on("connect", () => {
      console.log("Socket connected:", socket.id);
      socket.emit("joinRoom", { roomId, playerId });
    });

    socket.on("updateRoom", (updatedRoom: any) => {
      console.log("updateRoom received:", updatedRoom);
      setRoom(updatedRoom);
    });

    socket.on("roomFull", (data) => {
      alert(data.message);
    });

    return () => {
      socket.disconnect();
    };
  }, [roomId, playerId]);

  const handleClick = (col: number) => {
    if (!room || room.winner) return;
    socket.emit("makeMove", { roomId, column: col, playerId });
  };

  if (!room) return <div>Loading...</div>;

  return (
    <div>
      <h1>Connect Four</h1>
      <h3>
        {room.winner
          ? `Player ${room.winner} wins!`
          : `Turn: Player ${room.turn} (${room.players[room.turn - 1]})`}
      </h3>
      <div style={{ display: "inline-block", border: "2px solid #000" }}>
        {room.board.map((row: number[], rIdx: number) => (
          <div key={rIdx} style={{ display: "flex" }}>
            {row.map((cell: number, cIdx: number) => (
              <div
                key={cIdx}
                onClick={() => handleClick(cIdx)}
                style={{
                  width: 50,
                  height: 50,
                  border: "1px solid #000",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor:
                    cell === 1 ? "red" : cell === 2 ? "yellow" : "white",
                  cursor: "pointer",
                }}
              ></div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}