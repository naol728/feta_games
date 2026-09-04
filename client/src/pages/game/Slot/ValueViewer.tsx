import { FaCoins } from "react-icons/fa"
import { BiWallet } from "react-icons/bi"
import { TbPigMoney } from "react-icons/tb"
import { useAppSelector } from "@/store/hook"

interface ValueViewerProps {
    type: "balance" | "bet" | "wins"
    betAmount: number
    totalWins: number
}

const ValueViewer: React.FC<ValueViewerProps> = ({
    type,
    betAmount,
    totalWins,
}) => {
    const user = useAppSelector((state) => state.auth.user)

    const config = {
        balance: {
            label: "Balance",
            icon: BiWallet,
        },
        bet: {
            label: "Bet",
            icon: FaCoins,
        },
        wins: {
            label: "Win",
            icon: TbPigMoney,
        },
    }

    const { label, icon: Icon } = config[type]

    const value =
        type === "balance"
            ? user?.wallets?.available_balance ?? 0
            : type === "bet"
                ? betAmount
                : totalWins

    return (
        <div
            className="
        flex
        h-9
        min-w-0
        flex-1
        items-center
        gap-1.5
        rounded-lg
        border
        border-border/50
        bg-card/90
        px-1.5
        shadow-sm
        backdrop-blur-md
      "
        >
            {/* ICON */}
            <div
                className="
          flex
          h-6
          w-6
          shrink-0
          items-center
          justify-center
          rounded-md
          bg-primary/10
          text-primary
        "
            >
                <Icon className="h-3 w-3" />
            </div>

            {/* CONTENT */}
            <div className="min-w-0 flex-1 overflow-hidden">

                {/* LABEL */}
                <div
                    className="
            truncate
            text-[7px]
            font-medium
            leading-none
            text-muted-foreground
          "
                >
                    {label}
                </div>

                {/* MONEY */}
                <div
                    className="
            mt-0.5
            flex
            min-w-0
            items-baseline
            gap-0.5
            overflow-hidden
            whitespace-nowrap
            text-[9px]
            font-bold
            leading-none
            tabular-nums
            text-foreground
          "
                >
                    <span className="min-w-0 truncate">
                        {value}
                    </span>

                    <span
                        className="
              shrink-0
              text-[7px]
              font-semibold
              text-muted-foreground
            "
                    >
                        ETB
                    </span>
                </div>

            </div>
        </div>
    )
}

export default ValueViewer