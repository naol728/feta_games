import React, { useEffect, useState } from "react"
import { Link } from "react-router-dom"

import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { socket } from "@/lib/socket"

const games = [
  {
    name: "Connect Four",
    description: "Connect four pieces before your opponent.",
    path: "/connectfour",
    players: 124,
    entry: "$1",
    image: "/connectfour.jpeg"
  },
  {
    name: "Dots and Boxes",
    description: "Complete more boxes than your opponent.",
    path: "/dots",
    players: 56,
    entry: "$0.5",
    image: "/connectfour.jpeg"
  },
  {
    name: "Territory Capture",
    description: "Capture the largest territory.",
    path: "/territory",
    players: 32,
    entry: "$2",
    image: "/connectfour.jpeg"
  }
]

export default function Game() {
 
  return (
    <div className="min-h-screen bg-background text-foreground p-4">

      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-bold">
          🎮 Feta Games
        </h1>

        <p className="text-sm text-muted-foreground">
          Play 1v1 games and win money from other players
        </p>
      </div>

      {/* Game List */}
      <div className="space-y-4">

        {games.map((game, i) => (
          <Card
            key={i}
            className ="transition-all duration-300 hover:scale-[1.02] py-2 -px-3"
          >
            <CardContent className=" flex items-center justify-between">

              {/* Left */}
              <div className="flex items-center gap-4">

                {/* Game Image */}
                <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted flex-shrink-0">
                  <img
                    src={game.image}
                    alt={game.name}
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Info */}
                <div>
                  <p className="font-semibold text-xs">
                    {game.name}
                  </p>
              
                </div>

              </div>

              {/* Button */}
              <Link to={game.path}>
                <Button>
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