import React, { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { Gift, Ticket, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { redeemCode } from "@/api/coupon";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export default function Coupon() {
    const [coupon, setCoupon] = useState("");
    const [status, setStatus] = useState<{
        message: string;
        type: "success" | "error" | null;
    }>({ message: "", type: null });

    const { mutate, isPending } = useMutation({
        mutationFn: redeemCode,
        mutationKey: ["redeemCode"],

        onSuccess: (data) => {
            if (!data?.success) {
                const msg = data?.message || "Failed to redeem coupon";
                setStatus({ message: msg, type: "error" });
                toast.error(msg);
                return;
            }

            const msg = data?.message || "Coupon redeemed successfully";
            setStatus({ message: msg, type: "success" });
            toast.success(msg);
            setCoupon("");
        },

        onError: (error) => {
            const msg = error?.message || "Failed to redeem coupon";
            setStatus({ message: msg, type: "error" });
            toast.error(msg);
        },
    });

    // Auto-clear status after 4 seconds
    useEffect(() => {
        if (status.message) {
            const timer = setTimeout(() => {
                setStatus({ message: "", type: null });
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [status.message]);

    const handleRedeem = () => {
        const code = coupon.trim();
        if (!code) {
            setStatus({ message: "Enter a coupon code", type: "error" });
            toast.error("Enter a coupon code");
            return;
        }
        setStatus({ message: "", type: null });
        mutate(code);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setCoupon(e.target.value);
        // Clear status when user types
        if (status.message) setStatus({ message: "", type: null });
    };

    return (
        <div className="w-full">
            <Card className="rounded-2xl border-border/60 shadow-sm">
                <CardContent className="p-3">
                    {/* Header */}
                    <div className="flex items-center gap-2.5 mb-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                            <Gift className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-sm font-semibold">Redeem Coupon</h2>
                            <p className="text-[10px] text-muted-foreground">
                                Enter your code to claim bonus
                            </p>
                        </div>
                    </div>

                    {/* Coupon input */}
                    <div className="relative">
                        <Ticket className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                            value={coupon}
                            onChange={handleInputChange}
                            onKeyDown={(e) => {
                                if (e.key === "Enter") handleRedeem();
                            }}
                            placeholder="Enter coupon code"
                            disabled={isPending}
                            className="h-9 rounded-xl pl-8 pr-2.5 text-xs uppercase"
                        />
                    </div>

                    {/* Status message */}
                    {status.message && (
                        <div
                            className={`mt-1.5 flex items-center gap-1.5 text-[10px] ${status.type === "success"
                                ? "text-green-600 dark:text-green-400"
                                : "text-destructive"
                                }`}
                        >
                            {status.type === "success" ? (
                                <CheckCircle2 className="h-3 w-3" />
                            ) : (
                                <AlertCircle className="h-3 w-3" />
                            )}
                            <span>{status.message}</span>
                        </div>
                    )}

                    {/* Redeem button */}
                    <Button
                        type="button"
                        onClick={handleRedeem}
                        disabled={isPending || !coupon.trim()}
                        className="mt-2.5 h-9 w-full rounded-xl text-xs"
                    >
                        {isPending ? (
                            <>
                                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                                Redeeming...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
                                Redeem
                            </>
                        )}
                    </Button>

                    {/* Info */}
                    <p className="mt-2 text-center text-[8px] text-muted-foreground">
                        Bonuses may have wagering requirements.
                    </p>
                </CardContent>
            </Card>
        </div>
    );
}