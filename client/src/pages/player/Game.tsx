import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import Banner from "@/components/Banner";
// import QuickActions from "./QuickActions";
import { Star } from "lucide-react";

const games = [
  {
    name: "Chicken Coin",
    path: "/slot",
    image: "/images/slot/chicken/chickencoin.png",
    isNew: true,
    underdevelopment: false,
  },
  {
    name: "Aviator",
    path: "/aviator",
    image: "/images/slot/chicken/aviator.png",
    isNew: false,
    underdevelopment: false,
  },
  {
    name: "Fast Keno",
    path: "/keno",
    image: "https://vfair.games/games/keno.webp",
    isNew: false,
    underdevelopment: false,
  },
  {
    name: "Mines",
    path: "/wheel",
    image: "https://vfair.games/games/mines.webp",
    isNew: false,
    underdevelopment: false,
  },
  {
    name: "Plinko",
    path: "/plinko",
    image: "https://vfair.games/games/plinko.webp",
    isNew: true,
    underdevelopment: false,
  },
  {
    name: "Chicken Road 2",
    path: "/chicken-road",
    image: "/chicken-road.jpg",
    isNew: true,
    underdevelopment: false,
  },
  {
    name: "Dice",
    path: "/joker-x",
    image: "https://vfair.games/games/dice.webp",
    isNew: false,
    underdevelopment: true,
  },
];

export default function Game() {
  return (
    <div
      className="
        min-h-screen
        w-full
        overflow-x-hidden
        bg-background
        text-foreground
        px-2
        pb-24
        sm:px-3
      "
    >
      {/* Banner */}
      <Banner />

      {/* Quick Actions */}
      {/* <div className="mt-3">
        <QuickActions />
      </div> */}

      {/* Section Header */}
      <div className="mt-5 mb-2 flex items-center justify-between px-1">
        <h2 className="text-sm font-bold tracking-wide text-foreground">
          የተመረጡ ጨዋታዎች
        </h2>

        <button
          type="button"
          className="
            text-[11px]
            font-semibold
            text-primary
            active:opacity-70
          "
        >
          See All →
        </button>
      </div>

      {/* ========================= */}
      {/* GAME GRID */}
      {/* ========================= */}

      <div
        className="
          grid
          grid-cols-3
          gap-1.5
          sm:gap-2
        "
      >
        {games.map((game, i) => (
          <Link
            key={i}
            to={game.path}
            className="block min-w-0"
          >
            <Card
              className="
                group
                relative
                aspect-[0.82/1]
                w-full
                overflow-hidden
                rounded-lg
                border
                border-border/80
                bg-card
                p-0
                shadow-sm
                transition-all
                duration-200
                active:scale-[0.97]
              "
            >
              {/* GAME IMAGE */}
              <img
                src={game.image}
                alt={game.name}
                loading="lazy"
                className="
                  absolute
                  inset-0
                  h-full
                  w-full
                  object-cover
                  transition-transform
                  duration-300
                  group-hover:scale-105
                "
              />

              {/* DARK GRADIENT */}
              <div
                className="
                  absolute
                  inset-0
                  bg-gradient-to-t
                  from-black/80
                  via-black/10
                  to-transparent
                "
              />


              <div
                className="
                  absolute
                  left-1.5
                  top-1.5
                  z-10
                  flex
                  h-7
                  w-7
                  items-center
                  justify-center
                  rounded-full
                  bg-blue-500
                  shadow-md
                  ring-2
                  ring-black/30
                "
              >
                <Star
                  size={15}
                  strokeWidth={2.5}
                  fill="white"
                  className="text-white"
                />
              </div>

              {/* NEW BADGE */}

              {game.isNew && (
                <span
                  className="
                    absolute
                    right-1
                    top-1
                    z-10
                    rounded-md
                    bg-green-500
                    px-1.5
                    py-0.5
                    text-[8px]
                    font-black
                    uppercase
                    text-white
                    shadow
                  "
                >
                  NEW
                </span>
              )}

              {/* COMING SOON */}

              {game.underdevelopment && (
                <div
                  className="
                    absolute
                    inset-0
                    z-20
                    flex
                    items-center
                    justify-center
                    bg-black/45
                  "
                >
                  <span
                    className="
                      rounded-full
                      bg-black/70
                      px-2
                      py-1
                      text-[8px]
                      font-bold
                      text-white
                    "
                  >
                    COMING SOON
                  </span>
                </div>
              )}

              {/* ================= */}
              {/* GAME NAME */}
              {/* ================= */}

              <div
                className="
                  absolute
                  bottom-0
                  left-0
                  right-0
                  z-10
                  px-1.5
                  pb-1.5
                  pt-6
                "
              >
                <p
                  className="
                    truncate
                    text-[10px]
                    font-bold
                    leading-tight
                    text-white
                    drop-shadow-md
                    sm:text-xs
                  "
                >
                  {game.name}
                </p>

                {!game.underdevelopment && (
                  <div
                    className="
                      mt-0.5
                      flex
                      items-center
                      gap-1
                    "
                  >
                    <span
                      className="
                        h-1.5
                        w-1.5
                        rounded-full
                        bg-green-400
                      "
                    />

                    <span
                      className="
                        text-[8px]
                        font-medium
                        text-white/80
                      "
                    >
                      Play now
                    </span>
                  </div>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </div>

      {/* ========================= */}
      {/* SUPPORT */}
      {/* ========================= */}

      <Card
        className="
          mt-3
          rounded-xl
          border
          border-border
          bg-card
          p-3
        "
      >
        <div className="flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-2.5">
            <div
              className="
                flex
                h-9
                w-9
                shrink-0
                items-center
                justify-center
                rounded-xl
                bg-primary/10
              "
            >
              <span className="text-lg">
                🧑‍💻
              </span>
            </div>

            <div className="min-w-0">
              <p className="text-xs font-semibold">
                Contact Support
              </p>

              <span className="text-[9px] text-muted-foreground">
                24/7 help & assistance
              </span>
            </div>
          </div>

          <a
            href="https://t.me/gebetagamesadmin"
            target="_blank"
            rel="noreferrer"
          >
            <button
              className="
                rounded-lg
                bg-primary
                px-3
                py-1.5
                text-[10px]
                font-bold
                text-primary-foreground
                active:scale-95
              "
            >
              Open
            </button>
          </a>
        </div>
      </Card>
    </div>
  );
}