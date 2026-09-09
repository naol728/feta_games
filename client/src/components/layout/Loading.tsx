import { motion } from "framer-motion";

export default function Loading() {
    return (
        <div className="h-screen w-full bg-[#101318] flex flex-col overflow-hidden">

            {/* Top bar */}
            <div className="h-[9px] bg-[#17212b] shrink-0" />

            {/* Main loading area */}
            <div className="flex-1 flex flex-col items-center justify-center">

                {/* Logo */}
                <motion.img
                    src="/logo.jpg"
                    alt="Win Games"
                    className="w-[135px] h-[135px] object-contain"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{
                        opacity: 1,
                        scale: [1, 1.03, 1],
                    }}
                    transition={{
                        opacity: {
                            duration: 0.5,
                        },
                        scale: {
                            duration: 2,
                            repeat: Infinity,
                            ease: "easeInOut",
                        },
                    }}
                />

                {/* Loading dots */}
                <div className="flex items-center gap-[17px] mt-[28px]">

                    {[0, 1, 2, 3].map((dot) => (
                        <motion.div
                            key={dot}
                            className="w-[15px] h-[15px] rounded-full bg-[#4c4e52]"
                            animate={{
                                opacity: [0.35, 1, 0.35],
                                scale: [0.9, 1.08, 0.9],
                            }}
                            transition={{
                                duration: 1.2,
                                repeat: Infinity,
                                ease: "easeInOut",
                                delay: dot * 0.15,
                            }}
                        />
                    ))}

                </div>
            </div>



        </div>
    );
}