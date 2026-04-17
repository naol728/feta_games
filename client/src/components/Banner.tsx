import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type GameBanner = {
    title: string;
    desc: string;
    image: string;
};

const banners: GameBanner[] = [
    {
        title: "ገበታ ካርድ ዱኤል ⚔️",
        desc: "በ1v1 ተወዳድር፣ ተጋጣሚህን አሸንፍ እና ሽልማት ውሰድ 💰",
        image: "/banner/cardduel.jpeg",
    },
    {
        title: "ጄት ፍልም ትንበያ 🚀",
        desc: "በትክክለኛ ጊዜ አቁም፣ ትርፍህን ውሰድ እና ያሸንፉ 💸",
        image: "/banner/mineduel.jpeg",
    },
    {
        title: "የማስታወሻ ፍሊፕ ፈተና 🧠",
        desc: "ትውስታህን ፈትን፣ በ1v1 ተወዳድር እና አሸንፍ 🏆",
        image: "/banner/cashes.jpeg",
    },
    {
        title: "ማይንስ ዱኤል አሬና 💣",
        desc: "አደጋን ተቋቋም፣ ብርህን አባዛ እና ድሉን ውሰድ 💰⚔️",
        image: "/banner/cardduel.jpeg",
    },
];

export default function GameHeroCarousel() {
    const [index, setIndex] = useState<number>(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % banners.length);
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    const current = banners[index];

    return (
        <div className="relative w-full h-[200px] md:h-[220px] overflow-hidden rounded-2xl mb-5">

            {/* IMAGE LAYER */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={current.image}
                    className="absolute inset-0"
                    initial={{ opacity: 0, scale: 1.1 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.05 }}
                    transition={{ duration: 0.8 }}
                >
                    <img
                        src={current.image}
                        alt={current.title}
                        className="w-full h-full object-cover"
                    />
                </motion.div>
            </AnimatePresence>

            {/* DARK OVERLAY (important for text readability) */}
            <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/40 to-transparent" />
            <div className="absolute inset-0 bg-black/20" />

            {/* TEXT CONTENT */}
            <div className="relative z-10 h-full flex flex-col justify-end p-6 md:p-10">

                <AnimatePresence mode="wait">
                    <motion.div
                        key={index}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        transition={{ duration: 0.5 }}
                        className="max-w-md"
                    >
                        <p className="text-xs tracking-[0.3em] text-primary mb-2">
                            GEBETA GAMES
                        </p>

                        <h1 className="text-xl md:text-2xl font-bold text-foreground">
                            {current.title}
                        </h1>

                        <p className="text-sm text-muted-foreground mt-2">
                            {current.desc}
                        </p>
                    </motion.div>
                </AnimatePresence>

                {/* INDICATORS */}
                <div className="flex gap-2 mt-4">
                    {banners.map((_, i) => (
                        <div
                            key={i}
                            className={`h-1 rounded-full transition-all duration-300 ${i === index
                                ? "w-8 bg-primary"
                                : "w-3 bg-primary/30"
                                }`}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}