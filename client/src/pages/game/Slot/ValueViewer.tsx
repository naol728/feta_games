import React from "react"
import { motion } from "framer-motion"
import { FaCoins } from "react-icons/fa"
import { BiWallet } from "react-icons/bi"
import { TbPigMoney } from "react-icons/tb"
import { useAppSelector } from "@/store/hook"

interface ValueViewerProps {
    type: "balance" | "bet" | "wins"
    betAmount: number
    totalWins: number
}

// Hoisted outside the component: static per-type metadata, not
// something that needs to be reallocated on every render.
const VALUE_CONFIG = {
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
} as const

const numberFormatter = new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
})

const ValueViewer: React.FC<ValueViewerProps> = ({
    type,
    betAmount,
    totalWins,
}) => {
    const balance = useAppSelector(
        (state) => state.auth.user?.wallets?.available_balance ?? 0,
    )

    const { label, icon: Icon } = VALUE_CONFIG[type]

    const value =
        type === "balance"
            ? balance
            : type === "bet"
                ? betAmount
                : totalWins

    const displayValue = numberFormatter.format(value)

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

                {/* MONEY -- animated so a balance/win update reads as a
                    smooth beat rather than an instant snap. Keyed on the
                    formatted value so it only replays when the number
                    actually changes, not on unrelated re-renders. */}
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
                    <motion.span
                        key={displayValue}
                        initial={{ opacity: 0.4, y: -2 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.18, ease: "easeOut" }}
                        className="min-w-0 truncate"
                    >
                        {displayValue}
                    </motion.span>

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

export default React.memo(ValueViewer)