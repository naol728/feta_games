import type { Match } from "./CardDraw";
import CardItem from "./CardItem";
type CardContainerProp = { deck: [], roomId: string | undefined, playerId: string, match: Match }
export default function CardContainer({ deck, roomId, playerId, match }: CardContainerProp) {
    const isMyTurn = match.turn === playerId;
    const pickedMap = getPickedMap(match);

    return (
        <div className="grid grid-cols-4 sm:grid-cols-5 gap-2.5 bg-muted/20 mt-5 mx-auto p-2 rounded-xl">
            {deck.map((card: { value: number | string, revealed: boolean }, i: number) => (
                <CardItem
                    key={i}
                    card={card}
                    index={i}
                    roomId={roomId}
                    playerId={playerId}
                    pickedBy={pickedMap[i]}
                    disabled={
                        !isMyTurn || card.revealed || match.status === "finished"
                    }
                />
            ))}
        </div>
    );
}

function getPickedMap(match: Match) {
    const map: Record<number, string> = {};

    match.players.forEach((p) => {
        p.picks?.forEach((card) => {
            const index = match.deck.findIndex(
                (d) => d === card
            );
            if (index !== -1) map[index] = p.id;
        });
    });

    return map;
}