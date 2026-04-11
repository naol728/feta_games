import { Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
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

export default function TopBar() {
  const [amount, setAmount] = useState("")
  const navigate = useNavigate()
  const numericAmount = useMemo(() => {
    const val = Number(amount)
    return Number.isFinite(val) ? val : 0
  }, [amount])

  const { mutate, isPending } = useMutation({
    mutationFn: paymentMethod,
    mutationKey: ["paymentMethod"],
    onError: (error) => {
      toast.error(error.message)
    },
    onSuccess: (data) => {
      navigate(`/deposit/${data.transaction_id}`)
    }
  })

  const isValid = numericAmount > 10

  return (
    <div className="sticky top-0 z-50 backdrop-blur-xl bg-background/70 border-b border-border/40">
      <div className="flex items-center justify-between px-3 py-2">

        {/* App Name */}
        <h1 className="text-sm font-semibold tracking-tight text-primary">
          Feta Games
        </h1>

        {/* Actions */}
        <div className="flex items-center gap-2">

          {/* Balance */}
          <Badge
            variant="secondary"
            className="text-[11px] px-2 py-1 rounded-md font-medium"
          >
            100 ETB
          </Badge>

          {/* Deposit Drawer */}
          <Drawer>
            <DrawerTrigger asChild>
              <Button
                size="sm"
                className="h-8 px-3 flex items-center gap-1"
              >
                <Wallet className="w-4 h-4" />
                <span className="text-xs">Deposit</span>
              </Button>
            </DrawerTrigger>

            <DrawerContent className="px-4 pb-4">
              <DrawerHeader className="text-left">
                <DrawerTitle className="text-base">
                  Add Funds
                </DrawerTitle>
                <DrawerDescription className="text-xs">
                  Enter an amount to top up your balance
                </DrawerDescription>
              </DrawerHeader>

              <div className="px-4 py-2">
                <Input
                  type="number"
                  placeholder="Enter amount (ETB)"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-11 text-base"
                />
                <p className="text-xs text-muted-foreground mt-2">
                  Minimum deposit 10 ETB
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Maximum deposit 1000 ETB
                </p>
              </div>

              <DrawerFooter className="flex flex-col gap-2">
                <Button
                  disabled={!isValid || isPending}
                  className="w-full h-11 text-sm"
                  onClick={() => mutate({ amount })}
                >
                  Start Deposit {isValid ? `(${numericAmount} ETB)` : ""}
                </Button>

                <DrawerClose asChild>
                  <Button variant="outline" className="w-full h-10">
                    Cancel
                  </Button>
                </DrawerClose>
              </DrawerFooter>
            </DrawerContent>
          </Drawer>

        </div>
      </div>
    </div>
  )
}