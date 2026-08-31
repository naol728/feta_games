
import {
  ArrowDownCircle,
  ArrowLeft,
  Check,
  Eye,
  EyeOff,
  RefreshCw,
} from "lucide-react"
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
  showBack?: boolean
  showDeposit?: boolean
}

const QUICK_AMOUNTS = [50, 100, 500, 1000]

export default function TopBar({
  showBack = false,
  showDeposit = true,
}: Props) {
  const user = useAppSelector((state) => state.auth.user)

  const [amount, setAmount] = useState("")
  const [showBalance, setShowBalance] = useState(true)

  const navigate = useNavigate()

  const numericAmount = useMemo(() => {
    const value = Number(amount)

    return Number.isFinite(value) ? value : 0
  }, [amount])

  const isValid =
    numericAmount >= 10 &&
    numericAmount <= 5000

  const { mutate, isPending } = useMutation({
    mutationFn: paymentMethod,
    mutationKey: ["paymentMethod"],

    onError: (error: Error) => {
      toast.error(error.message)
    },

    onSuccess: (data) => {
      navigate(`/deposit/${data.transaction_id}`)
    },
  })

  const handleReload = () => {
    // Add your balance refetch here
  }

  const handleAmountChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const value = e.target.value

    if (value === "") {
      setAmount("")
      return
    }

    const number = Number(value)

    if (number >= 0 && number <= 5000) {
      setAmount(value)
    }
  }

  const handleDeposit = () => {
    if (!isValid || isPending) return

    mutate({
      amount,
    })
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/90 backdrop-blur-xl">

      <div className="h-14 px-2.5 sm:px-4 flex items-center justify-between gap-2">

        {/* ================= LEFT ================= */}
        <div className="flex items-center gap-1.5 min-w-0">

          {showBack && (
            <button
              type="button"
              onClick={() => navigate("/")}
              className="
                flex h-8 w-8 shrink-0 items-center justify-center
                rounded-xl
                text-muted-foreground
                hover:bg-muted
                hover:text-foreground
                active:scale-95
                transition-all
              "
              aria-label="Go back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          )}

          <img
            src="/logo.jpg"
            alt="Feta logo"
            className="h-8 w-auto max-w-[120px] object-contain"
          />
        </div>

        {/* ================= RIGHT ================= */}
        <div className="flex items-center gap-1.5 shrink-0">

          {/* Balance */}
          <div
            className="
              flex items-center
              h-8
              rounded-xl
              border border-border/50
              bg-muted/90
              px-1
              shadow-lg
            "
          >

            {/* Refresh */}
            <button
              type="button"
              onClick={handleReload}
              className="
                flex h-6 w-6 items-center justify-center
                rounded-lg
                text-muted-foreground
                hover:bg-background
                hover:text-foreground
                active:scale-90
                transition-all
              "
              aria-label="Refresh balance"
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>

            {/* Amount */}
            <span
              className="
                px-1
                text-[11px]
                sm:text-xs
                font-bold
                tabular-nums
                whitespace-nowrap
              "
            >
              {showBalance
                ? `${user?.wallets?.balance ?? 0} ETB`
                : "••••••"}
            </span>

            {/* Visibility */}
            <button
              type="button"
              onClick={() =>
                setShowBalance((prev) => !prev)
              }
              className="
                flex h-6 w-6 items-center justify-center
                rounded-lg
                text-muted-foreground
                hover:bg-background
                hover:text-foreground
                active:scale-90
                transition-all
              "
              aria-label={
                showBalance
                  ? "Hide balance"
                  : "Show balance"
              }
            >
              {showBalance ? (
                <EyeOff className="h-3.5 w-3.5" />
              ) : (
                <Eye className="h-3.5 w-3.5" />
              )}
            </button>
          </div>

          {/* ================= DEPOSIT ================= */}
          {showDeposit && (
            <Drawer>

              <DrawerTrigger asChild>
                <Button
                  size="sm"
                  className="
                    h-8
                    px-2.5
                    sm:px-3
                    rounded-xl
                    gap-1.5
                    text-[11px]
                    sm:text-xs
                    font-bold
                    shadow-sm
                    active:scale-95
                    transition-transform
                  "
                >
                  <ArrowDownCircle className="h-3.5 w-3.5" />
                  <span>Deposit</span>
                </Button>
              </DrawerTrigger>

              <DrawerContent
                className="
                  rounded-t-[28px]
                  border-border/50
                  pb-3
                "
              >

                {/* Handle */}
                <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-muted-foreground/20" />

                <DrawerHeader className="px-5 pt-4 pb-3">

                  <div className="flex items-center gap-3">

                    <div
                      className="
                        flex h-10 w-10
                        items-center justify-center
                        rounded-2xl
                        bg-primary/10
                        text-primary
                      "
                    >
                      <ArrowDownCircle className="h-5 w-5" />
                    </div>

                    <div>
                      <DrawerTitle className="text-base font-bold">
                        Add Funds
                      </DrawerTitle>

                      <DrawerDescription className="mt-0.5 text-xs">
                        Deposit between 10 and 5,000 ETB
                      </DrawerDescription>
                    </div>

                  </div>

                </DrawerHeader>

                <div className="px-5 space-y-4">

                  {/* Amount Input */}
                  <div className="relative">

                    <Input
                      type="number"
                      inputMode="decimal"
                      min={10}
                      max={5000}
                      placeholder="0.00"
                      value={amount}
                      onChange={handleAmountChange}
                      className="
                        h-14
                        rounded-2xl
                        border-border/60
                        bg-muted/30
                        px-4
                        pr-14
                        text-lg
                        font-bold
                        tabular-nums
                        outline-none
                        focus-visible:ring-2
                      "
                    />

                    <span
                      className="
                        pointer-events-none
                        absolute
                        right-4
                        top-1/2
                        -translate-y-1/2
                        text-xs
                        font-semibold
                        text-muted-foreground
                      "
                    >
                      ETB
                    </span>

                  </div>

                  {/* Quick Amounts */}
                  <div className="grid grid-cols-4 gap-2">

                    {QUICK_AMOUNTS.map((value) => {
                      const selected =
                        numericAmount === value

                      return (
                        <button
                          key={value}
                          type="button"
                          onClick={() =>
                            setAmount(String(value))
                          }
                          className={`
relative
h - 9
rounded - xl
border
text - [11px]
font - semibold
transition - all
active: scale - 95

                            ${selected
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border/60 bg-muted/30 text-muted-foreground hover:bg-muted"
                            }
`}
                        >
                          {selected && (
                            <Check className="absolute right-1 top-1 h-2.5 w-2.5" />
                          )}

                          {value}
                        </button>
                      )
                    })}

                  </div>

                  {/* Validation */}
                  {amount && !isValid && (
                    <p className="text-center text-[11px] font-medium text-destructive">
                      Amount must be between 10 and 5,000 ETB
                    </p>
                  )}

                  {/* Deposit Button */}
                  <Button
                    disabled={!isValid || isPending}
                    onClick={handleDeposit}
                    className="
                      h-12
                      w-full
                      rounded-2xl
                      text-sm
                      font-bold
                      shadow-sm
                      active:scale-[0.98]
                      transition-all
                    "
                  >
                    {isPending
                      ? "Processing..."
                      : isValid
                        ? `Continue with ${numericAmount} ETB`
                        : "Enter Amount"}
                  </Button>

                  <p className="text-center text-[10px] text-muted-foreground">
                    You will be redirected to complete your payment.
                  </p>

                </div>

                <DrawerFooter className="px-5 pt-2">

                  <DrawerClose asChild>
                    <Button
                      variant="ghost"
                      className="
                        h-10
                        w-full
                        rounded-xl
                        text-xs
                        font-semibold
                      "
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
    </header>
  )
}

