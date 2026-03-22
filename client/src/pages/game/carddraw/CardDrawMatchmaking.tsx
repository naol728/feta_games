import { Button } from "@/components/ui/button";
import { socket } from "@/lib/socket";
import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function CardDrawMatchmaking() {
  const navigate = useNavigate();

  const [playerId] = useState(() => {
    let id = localStorage.getItem("playerId");
    if (!id) {
      id = "player_" + Math.floor(Math.random() * 100000);
      localStorage.setItem("playerId", id);
    }
    return id;
  });

  const [status, setStatus] = useState<string>("");

  useEffect(() => {
    socket.emit("player:register", { playerId });

    socket.on("carddraw:waiting", () => {
      console.log("searching for opponet"); setStatus("Waiting for an opponent...");
    });

    socket.on("carddraw:matched", (data: { roomId: string }) => {
      navigate(`/carddraw/${data.roomId}`)
    })
    return () => {
      socket.off("carddraw:waiting");
      socket.off("carddraw:matched")

    };
  });

  function joincarddraw() {
    socket.emit("carddraw:queue", { playerId, bet: 10 });
  }

  return <div>
    <Button onClick={joincarddraw}>Join</Button>


    {status}</div>;
}