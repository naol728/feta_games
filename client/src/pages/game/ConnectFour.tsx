import { socket } from "@/lib/socket";
import { useEffect, useState } from "react";



export default function ConnectFour() {

  useEffect(() => {

    socket.on("connection", () => {
      console.log("connected", socket.id)
    })
   socket.on("connectfour:waiting", (data) => {
      console.log("server response:", data)
    })
  });

 
const joinGame = () => {

    socket.emit("connectfour:join", {
      playerId: "player1223"
    })

  }
  

  return (
    <div>
      <h1>Connect Four</h1>
      <h3>
         <button onClick={joinGame}>
           Join Game
          </button>
      </h3>
     {/* <div style={{ display: "inline-block", border: "2px solid #000" }}>
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
      </div> */}
    </div>
  );
}