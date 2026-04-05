import type { Match } from "./CardDraw";
import CardItem from "./CardItem";

type CardContainerProp = {
    deck: { value: number | string; revealed: boolean }[];
    roomId: string | undefined;
    playerId: number;
    match: Match;
};

export default function CardContainer({ deck, roomId, playerId, match }: CardContainerProp) {
    const isMyTurn = match.turn === playerId;
    const pickedMap = getPickedMap(match);

    return (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-3 bg-muted/20 p-3 rounded-xl shadow-md mx-auto animate-fadeIn">
            {deck.map((card, i) => (
                <CardItem
                    key={i}
                    card={card}
                    index={i}
                    roomId={roomId}
                    playerId={playerId}
                    pickedBy={pickedMap[i]}
                    disabled={!isMyTurn || card.revealed || match.status === "finished"}
                />
            ))}
        </div>
    );
}

function getPickedMap(match: Match) {
    const map: Record<number, string> = {};
    match.players.forEach((p) => {
        p.picks?.forEach((card) => {
            const index = match.deck.findIndex((d) => d === card);
            if (index !== -1) map[index] = p.id;
        });
    });
    return map;
}