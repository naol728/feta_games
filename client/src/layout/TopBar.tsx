import { Wallet } from "lucide-react"
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
export default function TopBar() {
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
    onError: (error) => toast.error(error.message),
    onSuccess: (data) => {
      navigate(`/deposit/${data.transaction_id}`)
    }
  })

  const isValid = numericAmount > 10

  return (
    <div className="backdrop-blur-xl bg-background/80 border-b border-border/40 px-3 py-3 flex items-center justify-between">

      {/* App Name */}
      <h1 className="text-sm font-semibold text-primary">
        Feta Games
      </h1>

      {/* Right Side */}
      <div className="flex items-center gap-2">

        {/* Balance */}
        <div className="flex items-center gap-1 bg-muted px-2 py-1 rounded-lg">
          <Wallet className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs font-medium">
            {user?.wallets?.balance} ETB
          </span>
        </div>

        {/* Deposit */}
        <Drawer>
          <DrawerTrigger asChild>
            <Button size="sm" className="h-8 px-3 text-xs">
              Deposit
            </Button>
          </DrawerTrigger>

          <DrawerContent className="pb-6">

            <DrawerHeader className="text-left">
              <DrawerTitle>Add Funds</DrawerTitle>
              <DrawerDescription>
                Enter amount (10 - 5000 ETB)
              </DrawerDescription>
            </DrawerHeader>

            <div className="px-4 space-y-3">
              <Input
                type="number"
                placeholder="Amount (ETB)"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="h-12 text-base"
              />

              <Button
                disabled={!isValid || isPending}
                className="w-full h-12"
                onClick={() => mutate({ amount })}
              >
                {isPending
                  ? "Processing..."
                  : `Start Deposit ${isValid ? `${numericAmount} ETB` : ""}`}
              </Button>
            </div>

            <DrawerFooter>
              <DrawerClose asChild>
                <Button variant="ghost">Cancel</Button>
              </DrawerClose>
            </DrawerFooter>

          </DrawerContent>
        </Drawer>

      </div>
    </div>
  )
}