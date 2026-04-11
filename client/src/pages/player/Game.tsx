import { Link } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useEffect, useState } from "react"
import TopBar from "@/layout/TopBar"

function useCountdown(targetDate: Date) {
  const [timeLeft, setTimeLeft] = useState("")

  useEffect(() => {
    const interval = setInterval(() => {
      const now = new Date().getTime()
      const distance = targetDate.getTime() - now

      if (distance <= 0) {
        setTimeLeft("Ended")
        clearInterval(interval)
        return
      }

      const hours = Math.floor((distance / (1000 * 60 * 60)) % 24)
      const minutes = Math.floor((distance / (1000 * 60)) % 60)

      setTimeLeft(`${hours}h ${minutes}m`)
    }, 1000)

    return () => clearInterval(interval)
  }, [targetDate])

  return timeLeft
}
const games = [
  { name: "Card Draw", path: "/carddraw", image: "/carddrawduel.jpg" },
  { name: "JetX Pick", path: "/jetxpick", image: "/jetx.jpeg" },
  { name: "Memory Flip", path: "/memoryflip", image: "/memoryflip.jpeg" },
  { name: "Connect Four", path: "/connectfour", image: "/connectfour.jpeg" },
  { name: "Mines Duel", path: "/minesduel", image: "/mineduel.jpeg" }
]
export default function Game() {
  const timeLeft = useCountdown(new Date(Date.now() + 1000 * 60 * 60 * 5))

  return (
    <div className="min-h-screen bg-background text-foreground p-4">

      {/* Top Bar */}
      <TopBar

      />

      {/* Banner */}
      <div className="relative rounded-2xl overflow-hidden mb-4 bg-primary/90 p-10 shadow-lg">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle,_#fff_1px,_transparent_1px)] bg-[size:20px_20px]" />

        <div className="relative z-10 ">
          <h2 className="text-lg font-bold text-primary-foreground mb-1">
            Play & Win Rewards
          </h2>
          <p className="text-sm text-bold text-primary-foreground/80">
            Join games and earn prizes
          </p>
        </div>

        <img
          src="/casino.png"
          className="absolute right-0 bottom-0 w-full opacity-90"
        />
      </div>


      {/* Quick Actions */}
      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          { label: "Rocket", icon: "🚀" },
          { label: "Contest", icon: "🏆" },
          { label: "Spin", icon: "🎡" },
          { label: "Coupon", icon: "🎁" }
        ].map((item, i) => (
          <div
            key={i}
            className="bg-card text-card-foreground rounded-xl p-3 flex flex-col items-center gap-2 shadow"
          >
            <span className="text-xl">{item.icon}</span>
            <span className="text-xs">{item.label}</span>
          </div>
        ))}
      </div>


      <Card className="bg-accent/20 backdrop-blur-xl border border-border shadow-md my-2">
        <CardContent className="px-5  flex items-center justify-between">

          {/* Time Left */}
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              Time Left
            </span>
            <span className="text-sm font-semibold">
              {timeLeft}
            </span>
          </div>

          {/* Divider */}
          <div className="h-8 w-px bg-border" />

          {/* Total Pool */}
          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">
              Total Pool
            </span>
            <span className="text-sm font-semibold text-primary">
              12,500 birr
            </span>
          </div>

          {/* Divider */}
          <div className="h-8 w-px bg-border" />

          {/* Rewards */}
          <div className="flex flex-col text-right">
            <span className="text-xs text-muted-foreground">
              Rewards
            </span>
            <span className="text-sm font-semibold">
              Top 10
            </span>
          </div>

        </CardContent>
      </Card>
      {/* Game List */}
      <div className="space-y-2">
        {games.map((game, i) => (
          <Card
            key={i}
            className="bg-card border border-border rounded-xl py-3"
          >
            <CardContent className="flex items-center justify-between px-2  ">

              <div className="flex items-center gap-3">

                {/* GOLD GLOW IMAGE */}
                <div className="relative w-10 h-10 rounded-xl overflow-hidden">
                  <div className="absolute inset-0 rounded-xl blur-md bg-primary opacity-60 animate-pulse" />

                  <img
                    src={game.image}
                    alt={game.name}
                    className="relative w-full h-full object-cover rounded-xl border border-primary"
                  />
                </div>

                <p className="text-xs font-semibold">{game.name}</p>
              </div>

              <Link to={game.path}>
                <Button size={"sm"}>
                  Play
                </Button>
              </Link>

            </CardContent>
          </Card>
        ))}
      </div>

    </div>
  )
}
