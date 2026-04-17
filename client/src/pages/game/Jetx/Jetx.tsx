/* eslint-disable */
import { motion } from "framer-motion"
import { Card, CardContent } from "@/components/ui/card"

export default function Jetx() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground p-4">

      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border border-border shadow-lg  rounded-2xl">
          <CardContent className="p-6 flex flex-col items-center text-center gap-4">

            {/* Animated Icon */}
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              className="text-4xl"
            >
              🚀
            </motion.div>

            {/* Title */}
            <h1 className="text-lg font-bold tracking-wide">
              JetX Pick
            </h1>

            {/* Status */}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Under Development
            </div>

            {/* Description */}
            <p className="text-xs text-muted-foreground leading-relaxed">
              This game is currently being built and will be available soon.
              Stay tuned for an exciting high-reward experience 🚀
            </p>

            {/* Coming Soon Badge */}
            <motion.div
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 1.2, repeat: Infinity }}
              className="text-[11px] font-semibold text-primary"
            >
              Coming Soon...
            </motion.div>

          </CardContent>
        </Card>
      </motion.div>

    </div>
  )
}