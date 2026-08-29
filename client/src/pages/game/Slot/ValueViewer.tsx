/*eslint-disable*/
import { FaCoins } from "react-icons/fa";
import { BiWallet } from "react-icons/bi";
import { TbPigMoney } from "react-icons/tb";
import { useAppSelector } from "@/store/hook";
interface IMonetaryProps {
    value: number | undefined;
    showFraction?: boolean;
}

export const Monetary: React.FC<IMonetaryProps> = ({ value, showFraction = false }) => {
    const safeValue = typeof value === "number" && Number.isFinite(value) ? value : 0;

    const formattedValue = new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "ETB",
        maximumFractionDigits: showFraction ? 2 : 0,
    })
        .format(safeValue)
        .replace("DOL", "ETB")

    return (
        <span>
            {formattedValue}
        </span>
    )
};


interface ValueViewerProps {
    type: "balance" | "bet" | "wins";
    betAmount: number;
    totalWins: number;
}


const ValueViewer: React.FC<ValueViewerProps> = ({ type, betAmount, totalWins }) => {
    const { user } = useAppSelector((state) => state.auth);

    return (
        <div className="flex bg-black/30 p-2 rounded w-full md:w-[128px] items-center justify-between gap-4 text-sm">
            <span className='text-unique'>
                {
                    type == "balance" ? <BiWallet /> :
                        type == "bet" ? <FaCoins /> :
                            <TbPigMoney />
                }
            </span>
            <span className='truncate'>
                {
                    type == "balance" ?
                        <Monetary value={user?.wallets.balance} />
                        :
                        type == "bet" ? <Monetary value={betAmount} />
                            :
                            <Monetary value={totalWins} />

                }
            </span>
        </div>
    )
}

export default ValueViewer;