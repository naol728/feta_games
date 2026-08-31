/* eslint-disable */

import { NavLink } from "react-router-dom"
import {
  BarChart3,
  Gift,
  Headset,
  UserRound,
  Plus,
} from "lucide-react"
import { motion } from "framer-motion"
import { cn } from "@/lib/utils"

const items = [
  {
    to: "/leaderboard",
    label: "Leaderboard",
    icon: BarChart3,
  },
  {
    to: "/promo",
    label: "Promo",
    icon: Gift,
  },
  {
    to: "/support",
    label: "Support",
    icon: Headset,
  },
  {
    to: "/profile",
    label: "Profile",
    icon: UserRound,
  },
]

export default function Nav() {
  return (
    <div
      className="
        fixed
        inset-x-0
        bottom-0
        z-50
        flex
        justify-center
        px-1.5
        pb-[calc(env(safe-area-inset-bottom)+6px)]
        pointer-events-none
      "
    >
      <div
        className="
          flex
          w-full
          max-w-[390px]
          items-center
          justify-center
          gap-1.5
          pointer-events-auto
        "
      >

        {/* =====================================
            MAIN NAVIGATION
        ===================================== */}
        <nav
          className="
            flex
            min-w-0
            flex-1
            h-[68px]
            items-center
            rounded-[22px]
            border
            border-border/60
            bg-card/95
            px-1
            shadow-lg
            backdrop-blur-xl
          "
        >
          {items.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className="h-full min-w-0 flex-1"
            >
              {({ isActive }) => (
                <motion.div
                  whileTap={{ scale: 0.92 }}
                  className="
                    relative
                    flex
                    h-full
                    w-full
                    flex-col
                    items-center
                    justify-center
                    gap-1
                    cursor-pointer
                    select-none
                  "
                >

                  {/* ICON */}
                  <motion.div
                    animate={{
                      y: isActive ? -1 : 0,
                      scale: isActive ? 1.04 : 1,
                    }}
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 22,
                    }}
                    className={cn(
                      "flex items-center justify-center transition-colors",
                      isActive
                        ? "text-foreground"
                        : "text-muted-foreground"
                    )}
                  >
                    <Icon
                      className="h-[20px] w-[20px]"
                      strokeWidth={2.4}
                    />
                  </motion.div>

                  {/* LABEL */}
                  <span
                    className={cn(
                      `
                        max-w-full
                        truncate
                        px-0.5
                        text-[9px]
                        leading-none
                        transition-colors
                      `,
                      isActive
                        ? "font-semibold text-foreground"
                        : "font-medium text-muted-foreground"
                    )}
                  >
                    {label}
                  </span>

                  {/* ACTIVE INDICATOR */}
                  {isActive && (
                    <motion.div
                      layoutId="nav-active"
                      transition={{
                        type: "spring",
                        stiffness: 500,
                        damping: 35,
                      }}
                      className="
                        absolute
                        bottom-1
                        h-0.5
                        w-4
                        rounded-full
                        bg-primary
                      "
                    />
                  )}

                </motion.div>
              )}
            </NavLink>
          ))}
        </nav>

        {/* =====================================
            DEPOSIT
        ===================================== */}
        <NavLink
          to="/deposit"
          className="shrink-0"
        >
          {({ isActive }) => (
            <motion.div
              whileTap={{ scale: 0.91 }}
              whileHover={{ scale: 1.02 }}
              className={cn(
                `
                  flex
                  h-[68px]
                  w-[68px]
                  flex-col
                  items-center
                  justify-center
                  gap-1
                  rounded-full
                  border
                  shadow-lg
                  backdrop-blur-xl
                  cursor-pointer
                  select-none
                  transition-colors
                `,
                isActive
                  ? "border-primary/40 bg-primary text-primary-foreground"
                  : "border-border/60 bg-card text-foreground"
              )}
            >

              <Plus
                className="h-[23px] w-[23px]"
                strokeWidth={2}
              />

              <span
                className="
                  text-[9px]
                  font-semibold
                  leading-none
                "
              >
                Deposit
              </span>

            </motion.div>
          )}
        </NavLink>

      </div>
    </div>
  )
}