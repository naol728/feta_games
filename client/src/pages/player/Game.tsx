import { useState } from "react";
import { Link } from "react-router-dom";
import { Card } from "@/components/ui/card";
import Banner from "@/components/Banner";
import { Star, ChevronRight, Lock, Gamepad2 } from "lucide-react";
import FeaturedMatch from "../game/prediction/FeaturedMatch";

const games = [
  {
    name: " Keno",
    path: "/keno",
    image: "https://vfair.games/games/keno.webp",
    isNew: false,
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
    name: "Chicken Coin",
    path: "/slot",
    image: "/images/slot/chicken/chickencoin.png",
    isNew: true,
    underdevelopment: false,
  },

  {
    name: "Mines",
    path: "/mines",
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
    underdevelopment: true,
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
  // A real (if only locally-persisted-for-now) favorite toggle reads as
  // far more professional than a star that's permanently lit for every
  // card regardless of anything the person actually does.
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const toggleFavorite = (path: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  };

  return (
    <main className="min-h-screen w-full overflow-x-hidden bg-background text-foreground px-2.5 pb-24">
      {/* ================================
          HERO BANNER
      ================================= */}
      <section className="pt-2">
        <Banner />
      </section>
      
      <FeaturedMatch />

      {/* ================================
          SECTION HEADER
      ================================= */}
      <section className="mt-6 mb-3.5 flex items-center justify-between px-0.5">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Gamepad2 size={16} strokeWidth={2.3} />
          </div>
          <div>
            <h2 className="text-[15px] font-bold leading-tight tracking-tight text-foreground">
              የተመረጡ ጨዋታዎች
            </h2>
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Choose your game and start playing
            </p>
          </div>
        </div>

        <button
          type="button"
          className="
            flex shrink-0 items-center gap-0.5
            rounded-full
            border border-border/70
            bg-card
            px-2.5 py-1.5
            text-[10.5px]
            font-semibold
            text-foreground
            shadow-sm
            transition-colors
            hover:border-primary/40
            hover:text-primary
            active:opacity-70
          "
        >
          See all
          <ChevronRight size={12} strokeWidth={2.5} />
        </button>
      </section>

      {/* ================================
          GAME GRID
      ================================= */}
      <section className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 sm:gap-3">
        {games.map((game) => {
          const isFavorited = favorites.has(game.path);

          return (
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
                  border-border/60
                  bg-card
                  p-0
                  shadow-md
                  transition-all
                  duration-300
                  ease-out
                  hover:-translate-y-0.5
                  hover:border-primary/40
                  hover:shadow-xl
                  active:scale-[0.97]
                  active:duration-100
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
                    group-hover:scale-[1.06]
                  "
                />

                {/* ================================
                    IMAGE OVERLAY -- slightly richer gradient than a
                    flat black fade, so the art still reads through
                    near the top instead of just going dark.
                ================================= */}
                <div
                  className="
                    absolute
                    inset-0
                    bg-gradient-to-t
                    from-black/92
                    via-black/25
                    to-black/5
                  "
                />

                {/* Subtle hover shine sweep -- desktop-only affordance,
                    harmless on touch where hover never fires. */}
                <div
                  className="
                    pointer-events-none
                    absolute
                    inset-0
                    z-[5]
                    -translate-x-full
                    bg-gradient-to-r
                    from-transparent
                    via-white/10
                    to-transparent
                    transition-transform
                    duration-700
                    ease-out
                    group-hover:translate-x-full
                  "
                />

                {/* ================================
                    FAVORITE TOGGLE
                ================================= */}
                <button
                  type="button"
                  onClick={(e) => toggleFavorite(game.path, e)}
                  aria-label={
                    isFavorited ? "Remove from favorites" : "Add to favorites"
                  }
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
                    transition-transform
                    active:scale-90
                  "
                >
                  <Star
                    size={13}
                    strokeWidth={2.3}
                    fill={isFavorited ? "currentColor" : "none"}
                    className={
                      isFavorited ? "text-yellow-400" : "text-white/70"
                    }
                  />
                </button>

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
                      bg-gradient-to-r
                      from-primary
                      to-primary/80
                      px-2
                      py-0.5
                      text-[8px]
                      font-extrabold
                      uppercase
                      tracking-wider
                      text-white
                      shadow-[0_2px_8px_rgba(0,0,0,0.35)]
                      ring-1
                      ring-white/10
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
                      flex-col
                      items-center
                      justify-center
                      gap-1.5
                      bg-black/65
                      backdrop-blur-[3px]
                    "
                  >
                    <div
                      className="
                        flex
                        h-8
                        w-8
                        items-center
                        justify-center
                        rounded-full
                        border
                        border-white/15
                        bg-white/10
                      "
                    >
                      <Lock size={14} className="text-white/85" />
                    </div>
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
                          relative
                          flex
                          h-1.5
                          w-1.5
                          items-center
                          justify-center
                        "
                      >
                        <span className="absolute h-full w-full animate-ping rounded-full bg-emerald-400/60" />
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.7)]" />
                      </span>

                      <span className="text-[9px] font-medium text-white/75">
                        Play now
                      </span>
                    </div>
                  )}
                </div>
              </Card>
            </Link>
          );
        })}
      </section>
    </main>
  );
}