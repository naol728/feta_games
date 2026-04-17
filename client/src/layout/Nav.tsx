/* eslint-disable */
import { NavLink } from "react-router-dom"
import { cn } from "@/lib/utils"
import { motion } from "framer-motion"

const items = [
  { to: "/invite", label: "Invite", emoji: "👥" },
  { to: "/", label: "Game", emoji: "🏆" },
  { to: "/profile", label: "Profile", emoji: "⚙️" },
]

export default function Nav() {
  return (
    <div className="fixed bottom-4 left-0 right-0 flex justify-center z-50">
      <div className="flex w-[92%] max-w-md items-center justify-between px-6 py-2.5 rounded-2xl bg-card/80 backdrop-blur-xl border border-border shadow-xl">

        {items.map(({ to, label, emoji }) => (
          <NavLink key={to} to={to} className="flex-1">
            {({ isActive }) => (
              <motion.div
                whileTap={{ scale: 0.9 }}
                animate={{
                  scale: isActive ? 1.1 : 1,
                }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-[10px] cursor-pointer",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                {/* ICON CONTAINER */}
                <motion.div
                  animate={{
                    y: isActive ? -4 : 0,
                  }}
                  transition={{ type: "spring", stiffness: 300 }}
                  className={cn(
                    "flex items-center justify-center rounded-full transition-all",
                    isActive
                      ? "w-12 h-12 bg-primary/20 shadow-[0_0_20px_hsl(var(--primary)),0_0_40px_hsl(var(--primary))]"
                      : "w-9 h-9"
                  )}
                >
                  <motion.span
                    animate={{
                      rotate: isActive ? [0, 10, -10, 0] : 0,
                      scale: isActive ? 1.2 : 1,
                    }}
                    transition={{ duration: 0.4 }}
                    className={cn(
                      "text-xl",
                      isActive &&
                      "drop-shadow-[0_0_8px_hsl(var(--primary))]"
                    )}
                  >
                    {emoji}
                  </motion.span>
                </motion.div>

                {/* LABEL */}
                <motion.span
                  animate={{
                    opacity: isActive ? 1 : 0.7,
                  }}
                  className={cn(
                    "transition-all",
                    isActive && "font-semibold"
                  )}
                >
                  {label}
                </motion.span>

                {/* ACTIVE DOT */}
                {/* {isActive && (
                  <motion.div
                    layoutId="active-dot"
                    className="w-1.5 h-1.5 rounded-full bg-primary mt-1"
                  />
                )} */}
              </motion.div>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  )
}