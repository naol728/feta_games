import React, { useState } from "react"
import { toast } from "react-toastify"
import { motion, AnimatePresence } from "framer-motion"

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const items = [
    { label: "Rocket", icon: "🚀" },
    { label: "Contest", icon: "🏆" },
    { label: "Spin", icon: "🎡" },
    { label: "Coupon", icon: "🎁" },
]

export default function QuickActions() {
    const [openCoupon, setOpenCoupon] = useState(false)
    const [coupon, setCoupon] = useState("")

    const handleClick = (label: string) => {
        if (label === "Coupon") {
            setOpenCoupon(true)
            return
        }

        toast.info("🚧 Under development")
    }

    const handleRedeem = () => {
        if (!coupon) {
            toast.error("Please enter coupon code")
            return
        }

        toast.error("❌ Invalid coupon code")
        setOpenCoupon(false)
    }

    return (
        <>
            {/* GRID */}
            <motion.div
                className="grid grid-cols-4 gap-3 mb-6"
                initial="hidden"
                animate="show"
                variants={{
                    hidden: {},
                    show: {
                        transition: {
                            staggerChildren: 0.08,
                        },
                    },
                }}
            >
                {items.map((item, i) => (
                    <motion.div
                        key={i}
                        onClick={() => handleClick(item.label)}
                        className="bg-card text-card-foreground rounded-xl p-3 flex flex-col items-center gap-2 shadow cursor-pointer active:scale-95"
                        variants={{
                            hidden: { opacity: 0, y: 20, scale: 0.9 },
                            show: { opacity: 1, y: 0, scale: 1 },
                        }}
                        transition={{ type: "spring", stiffness: 260, damping: 18 }}
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <span className="text-xl">{item.icon}</span>
                        <span className="text-xs">{item.label}</span>
                    </motion.div>
                ))}
            </motion.div>

            {/* COUPON DIALOG (ANIMATED) */}
            <AnimatePresence>
                {openCoupon && (
                    <Dialog open={openCoupon} onOpenChange={setOpenCoupon}>
                        <DialogContent>
                            <motion.div
                                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                                transition={{ duration: 0.2 }}
                            >
                                <DialogHeader>
                                    <DialogTitle>🎁 Coupon</DialogTitle>
                                    <DialogDescription>
                                        Enter your coupon code to claim reward.
                                    </DialogDescription>
                                </DialogHeader>

                                <Input
                                    placeholder="Enter coupon code"
                                    className="mb-3"
                                    value={coupon}
                                    onChange={(e) => setCoupon(e.target.value)}
                                />

                                <DialogFooter className="flex gap-4">
                                    <Button variant="outline" onClick={() => setOpenCoupon(false)}>
                                        Cancel
                                    </Button>
                                    <Button onClick={handleRedeem} >
                                        Redeem
                                    </Button>
                                </DialogFooter>
                            </motion.div>
                        </DialogContent>
                    </Dialog>
                )}
            </AnimatePresence>
        </>
    )
}