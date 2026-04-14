import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
    return (
        <div className="h-screen flex items-center justify-center bg-background">
            <Card className="w-[260px] bg-black border border-primary/30 shadow-2xl">
                <CardContent className="flex flex-col items-center justify-center py-12 gap-6">

                    {/* Neon Spinner */}
                    <motion.div
                        className="relative w-14 h-14"
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1.2, ease: "linear" }}
                    >
                        <div className="absolute inset-0 rounded-full border-4 border-primary/30" />
                        <div className="absolute inset-0 rounded-full border-4 border-t-primary border-r-primary blur-[1px]" />
                    </motion.div>

                    {/* Pulsing Dots */}
                    <div className="flex gap-2">
                        {[0, 1, 2].map((i) => (
                            <motion.div
                                key={i}
                                className="w-2.5 h-2.5 bg-primary rounded-full"
                                animate={{
                                    y: [0, -6, 0],
                                    opacity: [0.4, 1, 0.4],
                                }}
                                transition={{
                                    repeat: Infinity,
                                    duration: 0.8,
                                    delay: i * 0.2,
                                }}
                            />
                        ))}
                    </div>

                    {/* Glowing Text */}
                    <motion.p
                        className="text-sm font-medium text-primary tracking-wide"
                        animate={{
                            opacity: [0.5, 1, 0.5],
                            textShadow: [
                                "0 0 4px rgba(0,255,255,0.4)",
                                "0 0 12px rgba(0,255,255,0.9)",
                                "0 0 4px rgba(0,255,255,0.4)",
                            ],
                        }}
                        transition={{
                            repeat: Infinity,
                            duration: 1.5,
                        }}
                    >
                        CONNECTING
                    </motion.p>

                    {/* Sub text */}
                    <p className="text-xs text-muted-foreground">
                        Syncing with server...
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}