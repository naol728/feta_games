import { Link } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Banner from "@/components/Banner"



const games = [
  { name: "Card Draw", path: "/carddraw", image: "/carddrawduel.jpg" },
  { name: "JetX Pick", path: "/jetxpick", image: "/jetx.jpeg" },
  { name: "Memory Flip", path: "/memoryflip", image: "/memoryflip.jpeg" },
  { name: "Mines Duel", path: "/minesduel", image: "/mineduel.jpeg" }
]
export default function Game() {
  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      {/* Banner */}
      <Banner />

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


      {/* <Card className="bg-accent/20 backdrop-blur-xl border border-border shadow-md my-2">
        <CardContent className="px-5  flex items-center justify-between">

          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              Time Left
            </span>
            <span className="text-sm font-semibold">
              {timeLeft}
            </span>
          </div>

          <div className="h-8 w-px bg-border" />

          <div className="flex flex-col">
            <span className="text-sm text-muted-foreground">
              Total Pool
            </span>
            <span className="text-sm font-semibold text-primary">
              12,500 birr
            </span>
          </div>

          <div className="h-8 w-px bg-border" />

          <div className="flex flex-col text-right">
            <span className="text-xs text-muted-foreground">
              Rewards
            </span>
            <span className="text-sm font-semibold">
              Top 10
            </span>
          </div>

        </CardContent>
      </Card> */}
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
