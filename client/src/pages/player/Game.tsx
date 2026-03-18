import React from "react"
import { Link } from "react-router-dom"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"

const games = [
  { name: "Connect Four", path: "/connectfour", image: "/connectfour.jpeg" },
  { name: "Dots and Boxes", path: "/dots", image: "/connectfour.jpeg" },
  { name: "Territory Capture", path: "/territory", image: "/connectfour.jpeg" }
]

export default function Game() {
  return (
    <div className="min-h-screen bg-background text-foreground p-4">

      {/* Top Bar */}
      <div className="flex items-center justify-between mb-4">
        <button className="text-sm text-muted-foreground">← Back</button>
        <div className="flex gap-2">
          <span className="px-3 py-1 text-xs rounded-full bg-muted text-muted-foreground">
            Practice Mode
          </span>
          <span className="px-3 py-1 text-xs rounded-full bg-primary text-primary-foreground font-semibold">
            Notice
          </span>
        </div>
      </div>

      {/* Banner */}
      <div className="relative rounded-2xl overflow-hidden mb-6 bg-primary/90 p-10 shadow-lg">
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
