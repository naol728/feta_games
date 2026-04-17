/* eslint-disable */
import { Wallet, ArrowLeft, ArrowDownCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { useMemo, useState } from "react"
import { useMutation } from "@tanstack/react-query"
import { paymentMethod } from "@/api/wallet"
import { toast } from "react-toastify"
import { useNavigate } from "react-router-dom"
import { useAppSelector } from "@/store/hook"

type Props = {
  title?: string
  showBack?: boolean
  showDeposit?: boolean
}

export default function TopBar({
  title = "ገበታ 1v1",
  showBack = false,
  showDeposit = true,
}: Props) {
  const user = useAppSelector((state) => state.auth.user)
  const [amount, setAmount] = useState("")
  const navigate = useNavigate()

  const numericAmount = useMemo(() => {
    const val = Number(amount)
    return Number.isFinite(val) ? val : 0
  }, [amount])

  const { mutate, isPending } = useMutation({
    mutationFn: paymentMethod,
    mutationKey: ["paymentMethod"],
    onError: (error: Error) => toast.error(error.message),
    onSuccess: (data) => {
      navigate(`/deposit/${data.transaction_id}`)
    },
  })

  const isValid = numericAmount >= 10 && numericAmount <= 5000

  return (
    <div className="sticky top-0 z-50 backdrop-blur-xl bg-background/85 border-b border-border/40 px-4 h-14 flex items-center justify-between shadow-sm">

      {/* LEFT */}
      <div className="flex items-center gap-3 min-w-0">
        {showBack && (
          <button
            onClick={() => navigate("/")}
            className="p-1 rounded-md hover:bg-muted transition"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}

        <h1 className="text-sm sm:text-base font-bold tracking-wide text-primary truncate">
          {title}
        </h1>
      </div>

      {/* RIGHT */}
      <div className="flex items-center gap-2">

        {/* Balance */}
        <div className="flex items-center gap-2 bg-muted/70 px-3 py-1.5 rounded-xl border border-border/50 shadow-sm">
          <Wallet className="w-4 h-4 text-primary" />
          <span className="text-xs sm:text-sm font-bold whitespace-nowrap">
            {user?.wallets?.balance ?? 0} ETB
          </span>
        </div>

        {/* Deposit */}
        {showDeposit && (
          <Drawer>
            <DrawerTrigger asChild>
              <Button
                size="sm"
                className="h-9 px-3 rounded-xl text-xs font-semibold gap-1 shadow-sm"
              >
                <ArrowDownCircle className="h-4 w-4" />
                Deposit
              </Button>
            </DrawerTrigger>

            <DrawerContent className="pb-6 rounded-t-3xl">
              <DrawerHeader className="text-left">
                <DrawerTitle className="text-lg font-bold">
                  Add Funds
                </DrawerTitle>
                <DrawerDescription className="text-sm">
                  Enter amount between 10 and 5000 ETB
                </DrawerDescription>
              </DrawerHeader>

              <div className="px-4 space-y-4">
                <Input
                  type="number"
                  placeholder="Enter amount (ETB)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-12 text-base rounded-xl"
                />

                <Button
                  disabled={!isValid || isPending}
                  className="w-full h-12 rounded-xl text-sm font-semibold"
                  onClick={() => mutate({ amount })}
                >
                  {isPending
                    ? "Processing..."
                    : `Deposit ${isValid ? `${numericAmount} ETB` : ""
                    }`}
                </Button>

                {!isValid && amount && (
                  <p className="text-xs text-red-500 text-center">
                    Amount must be between 10 and 5000 ETB
                  </p>
                )}
              </div>

              <DrawerFooter>
                <DrawerClose asChild>
                  <Button
                    variant="ghost"
                    className="rounded-xl"
                  >
                    Cancel
                  </Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>
        )}
      </div>
    </div>
  )
}