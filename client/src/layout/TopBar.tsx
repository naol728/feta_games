import { Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"

type TopBarProps = {
  title?: string
  balance?: number
  onDeposit?: () => void
}

export default function TopBar({
  title = "Feta Games",
  balance = 0,
  onDeposit,
}: TopBarProps) {
  return (
    <div className="mb-2 z-50 backdrop-blur-xl bg-background/80">
      <div className="flex items-center justify-between px-1 py-2">

        {/* App Name */}
        <h1 className="text-sm font-semibold text-primary truncate">
          {title}
        </h1>

        {/* Right Actions */}
        <div className="flex items-center gap-2">

          {/* Balance */}
          <Badge
            variant="secondary"
            className="text-xs px-2 py-1 rounded-md"
          >
            {balance.toLocaleString()} ETB
          </Badge>

          {/* Deposit */}
          <Button
            size="sm"
            className="h-7 px-3 flex items-center gap-1"
            onClick={onDeposit}
          >
            <Wallet className="w-4 h-4" />
            <span className="text-xs">Deposit</span>
          </Button>

        </div>
      </div>
    </div>
  )
}