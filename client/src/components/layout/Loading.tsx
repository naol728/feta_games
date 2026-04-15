import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
    return (
        <div className="h-screen flex items-center justify-center bg-background">
            <Card className="w-[260px] bg-baground border border-primary/10">
                <CardContent className="flex flex-col items-center justify-center py-12 gap-6">
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