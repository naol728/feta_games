import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { socket } from "@/lib/socket";

/* --- card images mapping --- */
const cardMap: Record<string, string> = {
  "1": "/cards/AS.png",
  "2": "/cards/2S.png",
  "3": "/cards/3S.png",
  "4": "/cards/4S.png",
  "5": "/cards/5S.png",
  "6": "/cards/6S.png",
  "7": "/cards/7S.png",
  "8": "/cards/8S.png",
  "9": "/cards/9S.png",
  "10": "/cards/10S.png",
  J: "/cards/JS.png",
  Q: "/cards/QS.png",
  K: "/cards/KS.png",
};

/* --- single card --- */
function Card({ card }: any) {
  return (
    <div className="w-14 select-none bg-white">
      <img
        src={card.revealed ? cardMap[card.value] : "/cards/back.png"}
        draggable={false}
      />
    </div>
  );
}

/* --- fan hand layout --- */
function CardHand({ deck }: any) {
  return (
    <div className="grid grid-cols-4  gap-1 p-10 ">
      {deck.map((card: any, i: number) => {
        return (
          <div
            key={i}
          >
            <Card card={card} />
          </div>
        );
      })}
    </div >
  );
}

/* --- main component --- */
export default function CardDraw() {
  const { roomId } = useParams();

  const [playerId] = useState(() => {
    let id = localStorage.getItem("playerId");
    if (!id) {
      id = "player_" + Math.floor(Math.random() * 100000);
      localStorage.setItem("playerId", id);
    }
    return id;
  });

  const [match, setMatch] = useState<any>(null);

  useEffect(() => {
    if (!roomId) return;

    socket.emit("player:register", { playerId });
    socket.emit("carddraw:join", { roomId });

    socket.on("carddraw:start", (data) => {
      setMatch(data);
    });

    return () => {
      socket.off("carddraw:start");
    };
  }, [roomId, playerId]);

  if (!match) {
    return <div className="p-4 text-white">Waiting for match...</div>;
  }

  return (
    <div className="flex justify-center items-center h-screen">
      <CardHand deck={match.deck} />
    </div>
  );
}