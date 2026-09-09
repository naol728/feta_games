import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type GameBanner = {
    image: string;
};

const banners: GameBanner[] = [
    {
        image: "/banner/banner3.png",
    },
    {
        image: "/banner/banner1.png",
    },
    {
        image: "/banner/banner2.png",
    },
];

export default function GameHeroCarousel() {
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % banners.length);
        }, 5000);

        return () => clearInterval(interval);
    }, []);

    const current = banners[index];

    return (
        <div className="relative w-full h-[200px] md:h-[220px] overflow-hidden rounded-2xl mb-5 bg-background">
            <AnimatePresence mode="wait">
                <motion.div
                    key={current.image}
                    className="absolute inset-0 flex items-center justify-center"
                    initial={{ opacity: 0, scale: 1.03 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 1.03 }}
                    transition={{
                        duration: 0.8,
                        ease: "easeInOut",
                    }}
                >
                    <img
                        src={current.image}
                        alt="Game banner"
                        className="w-full h-full object-contain"
                    />
                </motion.div>
            </AnimatePresence>
        </div>
    );
}

