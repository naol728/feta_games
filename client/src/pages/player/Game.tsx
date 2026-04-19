import { Link } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Banner from "@/components/Banner"
import QuickActions from "./QuickActions"

const games = [
  { name: "Card Draw", path: "/carddraw", image: "/carddrawduel.jpg", isNew: true, uderdevelopmnet: false },
  { name: "JetX Pick", path: "/jetxpick", image: "/jetx.jpeg", isNew: false, uderdevelopmnet: true },
  { name: "Memory Flip", path: "/memoryflip", image: "/memoryflip.jpeg", isNew: false, uderdevelopmnet: true },
  { name: "Mines Duel", path: "/minesduel", image: "/mineduel.jpeg", isNew: false, uderdevelopmnet: true },
]

export default function Game() {
  return (
    <div className="min-h-screen bg-background text-foreground p-4">
      {/* Banner */}
      <Banner />

      {/* Quick Actions */}
      <QuickActions />

      {/* SECTION TITLE */}
      <div className="mt-6 mb-3 ml-1">
        <h2 className="text-sm font-bold text-muted-foreground tracking-wide">
          የተመረጡ ጨዋታዎች
        </h2>
      </div>

      {/* Game List */}
      <div className="space-y-2">
        {games.map((game, i) => (
          <Card
            key={i}
            className="bg-card border border-border rounded-xl py-3 relative overflow-hidden"
          >
            <CardContent className="flex items-center justify-between px-2">

              {/* LEFT SIDE */}
              <div className="flex items-center gap-3">

                <div className="relative w-10 h-10 rounded-xl overflow-hidden">
                  <div className="absolute inset-0 rounded-xl blur-md bg-primary opacity-60 animate-pulse" />

                  <img
                    src={game.image}
                    alt={game.name}
                    className="relative w-full h-full object-cover rounded-xl border border-primary"
                  />
                </div>

                <div className="flex flex-col">
                  <p className="text-xs font-semibold">{game.name}</p>

                  {game.uderdevelopmnet ? (
                    <span className="text-[10px] text-destructive font-bold">
                      coming soon
                    </span>
                  ) : game.isNew ? (
                    <span className="text-[10px] text-green-500 font-bold">
                      NEW
                    </span>
                  ) : null}
                </div>
              </div>

              {/* RIGHT SIDE */}
              <Link to={game.path}>
                <Button size="sm" className="relative pl-6">
                  {/* blinking dot */}
                  <span className="absolute left-2 top-1/2 -translate-y-1/2 flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600" />
                  </span>

                  Play
                </Button>
              </Link>

            </CardContent>
          </Card>
        ))}
      </div>

      {/* SUPPORT CARD */}
      <Card className="bg-card border border-border rounded-xl py-3 mt-3">
        <CardContent className="flex items-center justify-between px-2">

          <div className="flex items-center gap-3">

            {/* icon */}
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-primary/10">
              <span className="text-xl">🧑‍💻</span>
            </div>

            {/* text */}
            <div className="flex flex-col">
              <p className="text-xs font-semibold">Contact Support</p>
              <span className="text-[10px] text-muted-foreground">
                24/7 help & assistance
              </span>
            </div>
          </div>

          {/* action */}
          <a
            href="https://t.me/gebetagamesadmin"
            target="_blank"
            rel="noreferrer"
          >
            <Button size="sm">
              Open
            </Button>
          </a>

        </CardContent>
      </Card>
    </div>
  )
}