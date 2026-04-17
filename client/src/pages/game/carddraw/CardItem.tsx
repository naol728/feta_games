/*eslint-disable*/
import { getSocket } from "@/lib/socket"

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
}

type CardItemProp = {
    card: { value: number | string; revealed: boolean }
    index: number
    roomId?: string
    playerId?: string
    disabled: boolean
    pickedBy?: string
}

export default function CardItem({
    card,
    index,
    roomId,
    playerId,
    disabled,
    pickedBy,
}: CardItemProp) {
    const socket = getSocket()

    const isMine = pickedBy === playerId
    const isPicked = Boolean(pickedBy)

    const handlePick = () => {
        if (disabled) return

        socket.emit("carddraw:card-pick", {
            roomId,
            cardindex: index,
            playerId,
        })
    }

    return (
        <div
            onClick={handlePick}
            className={`
        relative aspect-[3/4] w-full max-w-[70px]
        mx-auto perspective
        transition-all duration-200
        ${disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer active:scale-95 hover:scale-105"}
      `}
        >
            {/* CARD INNER */}
            <div
                className={`
          relative w-full h-full
          transition-transform duration-500
          [transform-style:preserve-3d]
          ${card.revealed ? "rotate-y-180" : ""}
        `}
            >
                {/* BACK */}
                <img
                    src="https://i.pinimg.com/236x/30/37/56/3037565bfff30ab14386e78ee9140979.jpg"
                    className="
            absolute inset-0 w-full h-full
            rounded-lg
            border border-white/10
            shadow-md
            object-cover
            backface-hidden
          "
                />

                {/* FRONT */}
                <img
                    src={cardMap[String(card.value)]}
                    className="
            absolute inset-0 w-full h-full
            rounded-sm
            bg-white
            border border-white/10
            shadow-md
            object-cover
            rotate-y-180
            backface-hidden
          "
                />
            </div>

            {/* PICK INDICATOR */}
            {isPicked && (
                <div
                    className={`
            absolute inset-0 rounded-sm border-2
            ${isMine ? "border-emerald-400 animate-pulse" : "border-red-500"}
          `}
                />
            )}

            {/* HOVER GLOW */}
            {!disabled && !card.revealed && (
                <div className="absolute inset-0 rounded-lg bg-primary/0 hover:bg-primary/10 transition" />
            )}
        </div>
    )
}