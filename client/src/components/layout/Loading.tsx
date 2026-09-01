import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useMemo, useState } from "react";

type Particle = {
    id: number;
    x: number;
    y: number;
    delay: number;
    duration: number;
};

type StatusStep = "CONNECTING" | "PLEASE WAIT" | "SYNCING SERVER";

const createParticles = (count: number): Particle[] =>
    Array.from({ length: count }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 2,
        duration: 2.5 + Math.random() * 2,
    }));

export default function Loading() {
    const [stepIndex, setStepIndex] = useState(0);

    const steps: StatusStep[] = useMemo(
        () => ["CONNECTING", "PLEASE WAIT", "SYNCING SERVER"],
        []
    );

    const particles = useMemo(() => createParticles(28), []);

    useEffect(() => {
        const interval = setInterval(() => {
            setStepIndex((prev) => (prev + 1) % steps.length);
        }, 1800);

        return () => clearInterval(interval);
    }, [steps.length]);

    return (
        <div className="h-screen flex items-center justify-center bg-background relative overflow-hidden">

            {/* Soft game glow background */}
            <div className="absolute inset-0 bg-gradient-to-b from-primary/10 via-background to-background" />

            {/* Grid overlay (Gebeta board vibe) */}
            <div className="absolute inset-0 opacity-[0.04] bg-[linear-gradient(to_right,hsl(var(--primary))_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--primary))_1px,transparent_1px)] bg-[size:40px_40px]" />

            {/* Floating network particles */}
            <div className="absolute inset-0 pointer-events-none">
                {particles.map((p) => (
                    <motion.div
                        key={p.id}
                        className="absolute w-1.5 h-1.5 rounded-full bg-primary/40"
                        style={{
                            left: `${p.x}%`,
                            top: `${p.y}%`,
                        }}
                        animate={{
                            y: [0, -30, 0],
                            opacity: [0.2, 1, 0.2],
                        }}
                        transition={{
                            duration: p.duration,
                            repeat: Infinity,
                            delay: p.delay,
                        }}
                    />
                ))}
            </div>

            {/* Main card */}
            <Card className="w-[320px] bg-background/70 backdrop-blur-xl border border-primary/15 shadow-[0_0_40px_hsl(var(--primary)/0.15)]">
                <CardContent className="flex flex-col items-center justify-center py-10 gap-8">

                    {/* Logo with Pulsing Animation */}
                    <motion.div
                        className="relative w-24 h-24 flex items-center justify-center"
                        animate={{
                            scale: [1, 1.15, 1],
                        }}
                        transition={{
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                        }}
                    >
                        {/* Outer glow effect */}
                        <motion.div
                            className="absolute inset-0 rounded-full bg-primary/20 blur-xl"
                            animate={{
                                scale: [1, 1.2, 1],
                                opacity: [0.5, 0.2, 0.5],
                            }}
                            transition={{
                                duration: 2,
                                repeat: Infinity,
                                ease: "easeInOut",
                            }}
                        />

                        {/* Logo Container - Replace with your logo */}
                        <div className="relative z-10 w-full h-full rounded-full border-2 border-primary/40 bg-primary/10 shadow-[0_0_30px_hsl(var(--primary)/0.3)] flex items-center justify-center">
                            {/* You can replace this with an image: */}
                            <img src="/logo.jpg" alt="Logo" className="w-16 h-16" />

                            {/* Or use an icon/text as placeholder: */}
                            {/* <span className="text-3xl font-bold text-primary">G</span> */}
                        </div>
                    </motion.div>

                    {/* Status text */}
                    <motion.div
                        key={stepIndex}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4 }}
                        className="text-center"
                    >
                        <p className="text-sm font-semibold tracking-[0.25em] text-primary">
                            {steps[stepIndex]}
                        </p>
                        <p className="text-xs text-muted-foreground mt-2">
                            ቤጉማ Games
                        </p>
                    </motion.div>

                    {/* Sync bar */}
                    {/* <div className="w-full h-1 rounded-full bg-primary/10 overflow-hidden">
                        <motion.div
                            className="h-full bg-primary"
                            animate={{
                                x: ["-100%", "100%"],
                            }}
                            transition={{
                                duration: 1.2,
                                repeat: Infinity,
                                ease: "linear",
                            }}
                        />
                    </div> */}
                </CardContent>
            </Card>
        </div>
    );
}