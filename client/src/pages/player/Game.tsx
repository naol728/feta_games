import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import Banner from "@/components/Banner";
import { Star, ChevronRight } from "lucide-react";

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
    <main className="min-h-screen w-full overflow-x-hidden bg-background text-foreground px-2.5 pb-24">
      {/* ================================
          HERO BANNER
      ================================= */}
      <section className="pt-2">
        <Banner />
      </section>

      {/* ================================
          SECTION HEADER
      ================================= */}
      <section className="mt-5 mb-3 flex items-center justify-between px-0.5">
        <div>
          <h2 className="text-[15px] font-bold tracking-tight text-foreground">
            የተመረጡ ጨዋታዎች
          </h2>

          <p className="mt-0.5 text-[10px] text-muted-foreground">
            Choose your game and start playing
          </p>
        </div>

        <button
          type="button"
          className="
            flex items-center gap-0.5
            rounded-md
            px-1.5 py-1
            text-[11px]
            font-semibold
            text-primary
            transition-opacity
            active:opacity-60
          "
        >
          See all
          <ChevronRight size={13} strokeWidth={2.5} />
        </button>
      </section>

      {/* ================================
          GAME GRID
      ================================= */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
        {games.map((game) => (
          <Link
            key={game.path}
            to={game.path}
            className="
              block
              min-w-0
              outline-none
              focus-visible:ring-2
              focus-visible:ring-primary
              focus-visible:ring-offset-2
              focus-visible:ring-offset-background
              rounded-xl
            "
          >
            <Card
              className="
                group
                relative
                aspect-[0.88/1]
                w-full
                overflow-hidden
                rounded-xl
                border
                border-border/70
                bg-card
                p-0
                shadow-md
                transition-all
                duration-200
                hover:border-primary/40
                hover:shadow-lg
                active:scale-[0.97]
              "
            >
              {/* ================================
                  GAME IMAGE
              ================================= */}
              <img
                src={game.image}
                alt={game.name}
                loading="lazy"
                draggable={false}
                className="
                  absolute
                  inset-0
                  h-full
                  w-full
                  object-cover
                  transition-transform
                  duration-500
                  ease-out
                  group-hover:scale-[1.05]
                "
              />

              {/* ================================
                  IMAGE OVERLAY
              ================================= */}
              <div
                className="
                  absolute
                  inset-0
                  bg-gradient-to-t
                  from-black/90
                  via-black/15
                  to-transparent
                "
              />

              {/* ================================
                  TOP GLOW
              ================================= */}
              <div
                className="
                  pointer-events-none
                  absolute
                  inset-x-0
                  top-0
                  h-16
                  bg-gradient-to-b
                  from-black/30
                  to-transparent
                "
              />

              {/* ================================
                  FAVORITE / STAR
              ================================= */}
              <div
                className="
                  absolute
                  left-2
                  top-2
                  z-10
                  flex
                  h-7
                  w-7
                  items-center
                  justify-center
                  rounded-full
                  border
                  border-white/15
                  bg-black/55
                  shadow-lg
                  backdrop-blur-md
                "
              >
                <Star
                  size={14}
                  strokeWidth={2.3}
                  fill="currentColor"
                  className="text-yellow-400"
                />
              </div>

              {/* ================================
                  NEW BADGE
              ================================= */}
              {game.isNew && (
                <span
                  className="
                    absolute
                    right-2
                    top-2
                    z-10
                    rounded-full
                    border
                    border-primary/30
                    bg-primary
                    px-2
                    py-0.5
                    text-[8px]
                    font-extrabold
                    uppercase
                    tracking-wide
                    text-white
                    shadow-lg
                  "
                >
                  New
                </span>
              )}

              {/* ================================
                  COMING SOON
              ================================= */}
              {game.underdevelopment && (
                <div
                  className="
                    absolute
                    inset-0
                    z-20
                    flex
                    items-center
                    justify-center
                    bg-black/60
                    backdrop-blur-[2px]
                  "
                >
                  <span
                    className="
                      rounded-full
                      border
                      border-white/10
                      bg-black/75
                      px-3
                      py-1.5
                      text-[9px]
                      font-bold
                      uppercase
                      tracking-wider
                      text-white
                    "
                  >
                    Coming Soon
                  </span>
                </div>
              )}

              {/* ================================
                  GAME INFORMATION
              ================================= */}
              <div
                className="
                  absolute
                  bottom-0
                  left-0
                  right-0
                  z-10
                  p-2.5
                  pt-10
                "
              >
                <p
                  className="
                    truncate
                    text-[12px]
                    font-bold
                    leading-tight
                    text-white
                    drop-shadow-lg
                  "
                >
                  {game.name}
                </p>

                {!game.underdevelopment && (
                  <div className="mt-1 flex items-center gap-1.5">
                    <span
                      className="
                        h-1.5
                        w-1.5
                        rounded-full
                        bg-emerald-400
                        shadow-[0_0_6px_rgba(52,211,153,0.7)]
                      "
                    />

                    <span className="text-[9px] font-medium text-white/75">
                      Play now
                    </span>
                  </div>
                )}
              </div>
            </Card>
          </Link>
        ))}
      </section>
    </main>
  );
}
