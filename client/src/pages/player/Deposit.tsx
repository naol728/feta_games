import {
    gettransaction,
    varifytransaction,
} from "@/api/wallet";

import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import { useParams } from "react-router-dom";

import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

import { toast } from "react-toastify";

import { useState } from "react";

import {
    Copy,
    Info,
    TicketPercent,
    ChevronDown,
    ChevronUp,
} from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

import { useAppDispatch } from "@/store/hook";
import { initAuth } from "@/store/slice/auth";

export default function Deposit() {
    const { trxno } = useParams();

    const dispatch = useAppDispatch();

    const queryClient = useQueryClient();

    // ========================================================
    // STATE
    // ========================================================

    const [
        transactionId,
        setTransactionId,
    ] = useState("");

    const [
        couponCode,
        setCouponCode,
    ] = useState("");

    const [
        showCoupon,
        setShowCoupon,
    ] = useState(false);

    const [
        copied,
        setCopied,
    ] = useState(false);

    // ========================================================
    // GET TRANSACTION
    // ========================================================

    const {
        data,
        isLoading,
        error,
    } = useQuery({
        queryFn: () =>
            gettransaction({
                trxno,
            }),
        queryKey: [
            "gettransaction",
            trxno,
        ],
        enabled: !!trxno,
    });

    // ========================================================
    // VERIFY DEPOSIT
    // ========================================================

    const {
        mutate,
        isPending,
    } = useMutation({
        mutationFn: varifytransaction,

        mutationKey: [
            "varifytransaction",
        ],

        onSuccess: (data) => {
            toast.success(
                data?.message ||
                "Deposit successful",
            );

            // Refresh auth/wallet
            dispatch(initAuth());

            // Refresh transaction
            queryClient.invalidateQueries({
                queryKey: [
                    "gettransaction",
                    trxno,
                ],
            });

            // Clear form
            setTransactionId("");
            setCouponCode("");
        },

        onError: (error) => {
            const message = error?.message ||
                "Failed to verify deposit";

            toast.error(message);
        },
    });

    // ========================================================
    // TRANSACTION DATA
    // ========================================================

    const tx = data?.transaction;

    const accountNumber =
        tx?.payment_method?.account_number ||
        "";

    const accountName =
        tx?.payment_method?.account_name ||
        "";

    // ========================================================
    // COPY ACCOUNT NUMBER
    // ========================================================

    const handleCopy = async () => {
        if (!accountNumber) return;

        try {
            await navigator.clipboard.writeText(
                accountNumber,
            );

            setCopied(true);

            setTimeout(() => {
                setCopied(false);
            }, 1500);
        } catch {
            toast.error(
                "Unable to copy account number",
            );
        }
    };

    // ========================================================
    // VERIFY
    // ========================================================

    const handleVerify = () => {
        const cleanTransactionId =
            transactionId.trim();

        const cleanCouponCode =
            couponCode.trim().toUpperCase();

        if (!cleanTransactionId) {
            toast.error(
                "Please enter the transaction ID",
            );

            return;
        }

        if (cleanTransactionId.length < 5) {
            toast.error(
                "Please enter a valid transaction ID",
            );

            return;
        }

        mutate({
            trxno,
            transactioID: cleanTransactionId,
            couponCode:
                showCoupon && cleanCouponCode
                    ? cleanCouponCode
                    : undefined,
        });
    };

    // ========================================================
    // RENDER
    // ========================================================

    return (
        <div className="space-y-3 p-3">
            {/* ================================================== */}
            {/* HEADER */}
            {/* ================================================== */}

            <div className="flex items-center justify-between gap-2">
                <h1 className="text-sm font-semibold">
                    Deposit
                </h1>

                {tx && (
                    <Dialog>
                        <DialogTrigger asChild>
                            <Button
                                variant="outline"
                                size="sm"
                                className="h-8 gap-1.5 text-xs"
                            >
                                <Info className="h-3.5 w-3.5" />
                                How to deposit
                            </Button>
                        </DialogTrigger>

                        <DialogContent className="w-[calc(100%-2rem)] max-w-sm">
                            <DialogHeader>
                                <DialogTitle>
                                    How to deposit
                                </DialogTitle>
                            </DialogHeader>

                            <div className="space-y-5 text-sm">
                                {/* ACCOUNT */}
                                <div className="space-y-3">
                                    <p className="text-muted-foreground">
                                        Deposit money to the
                                        following{" "}
                                        {tx?.payment_method?.type ||
                                            "payment"}{" "}
                                        account:
                                    </p>

                                    <div className="rounded-lg bg-muted px-4 py-3">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={handleCopy}
                                            className="w-full"
                                        >
                                            <span className="truncate">
                                                {copied
                                                    ? "Copied!"
                                                    : accountNumber}
                                            </span>

                                            <Copy className="ml-2 h-4 w-4 shrink-0" />
                                        </Button>
                                    </div>

                                    {accountName && (
                                        <p className="text-center text-xs text-muted-foreground">
                                            Account holder:{" "}
                                            <span className="font-medium text-foreground">
                                                {accountName}
                                            </span>
                                        </p>
                                    )}
                                </div>

                                {/* INSTRUCTIONS */}
                                <div className="border-t pt-4">
                                    <p className="text-muted-foreground">
                                        Send the deposit and then
                                        enter the transaction
                                        reference from your receipt
                                        below.
                                    </p>

                                    <p className="mt-3 text-xs text-muted-foreground">
                                        Example Transaction ID:{" "}
                                        <strong className="font-semibold text-foreground">
                                            CE535PPHGP
                                        </strong>
                                    </p>
                                </div>
                            </div>
                        </DialogContent>
                    </Dialog>
                )}
            </div>

            {/* ================================================== */}
            {/* LOADING */}
            {/* ================================================== */}

            {isLoading && (
                <Card>
                    <CardContent className="space-y-2 p-3">
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-4 w-1/3" />
                    </CardContent>
                </Card>
            )}

            {/* ================================================== */}
            {/* ERROR */}
            {/* ================================================== */}

            {error && (
                <Card className="border-red-500/40">
                    <CardContent className="p-3 text-sm text-red-500">
                        Failed to load transaction
                    </CardContent>
                </Card>
            )}

            {/* ================================================== */}
            {/* TRANSACTION */}
            {/* ================================================== */}

            {tx && (
                <Card className="rounded-2xl">
                    {/* HEADER */}
                    <CardHeader className="pb-2">
                        <CardTitle className="flex items-center justify-between text-sm">
                            <span>
                                Deposit Status
                            </span>

                            <Badge
                                className={
                                    tx.status === "pending"
                                        ? "bg-yellow-500/20 text-yellow-600"
                                        : tx.status === "completed"
                                            ? "bg-green-500/20 text-green-600"
                                            : "bg-red-500/20 text-red-600"
                                }
                            >
                                {tx.status}
                            </Badge>
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-3 text-xs">
                        {/* AMOUNT */}
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">
                                Amount
                            </span>

                            <span className="font-medium">
                                {tx.amount} ETB
                            </span>
                        </div>

                        {/* TYPE */}
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">
                                Type
                            </span>

                            <span className="capitalize">
                                {tx.type}
                            </span>
                        </div>

                        {/* DATE */}
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">
                                Date
                            </span>

                            <span className="text-right">
                                {new Date(
                                    tx.created_at,
                                ).toLocaleString()}
                            </span>
                        </div>

                        {/* ACCOUNT */}
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">
                                Account
                            </span>

                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={handleCopy}
                                className="h-8 max-w-[180px] px-2"
                            >
                                <span className="truncate">
                                    {copied
                                        ? "Copied!"
                                        : accountNumber}
                                </span>

                                <Copy className="ml-2 h-3.5 w-3.5 shrink-0" />
                            </Button>
                        </div>

                        {/* ACCOUNT HOLDER */}
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">
                                Account Holder
                            </span>

                            <span className="max-w-[170px] truncate text-right">
                                {accountName}
                            </span>
                        </div>

                        {/* PAYMENT METHOD */}
                        <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">
                                Method
                            </span>

                            <span className="max-w-[140px] truncate text-right capitalize">
                                {tx.payment_method?.type}
                            </span>
                        </div>

                        {/* ================================================== */}
                        {/* TRANSACTION ID */}
                        {/* ================================================== */}

                        <div className="space-y-2 pt-2">
                            <p className="text-muted-foreground">
                                Enter the transaction reference
                                from your receipt.
                            </p>

                            <Input
                                placeholder="Example: CE535PPHGP"
                                className="h-10 text-sm uppercase"
                                value={transactionId}
                                disabled={
                                    isPending ||
                                    tx.status === "completed"
                                }
                                onChange={(e) =>
                                    setTransactionId(
                                        e.target.value,
                                    )
                                }
                            />
                        </div>

                        {/* ================================================== */}
                        {/* COUPON TOGGLE */}
                        {/* ================================================== */}

                        <div className="pt-1">
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-8 w-full justify-between px-2 text-xs"
                                disabled={
                                    isPending ||
                                    tx.status === "completed"
                                }
                                onClick={() =>
                                    setShowCoupon(
                                        (prev) => !prev,
                                    )
                                }
                            >
                                <span className="flex items-center gap-2">
                                    <TicketPercent className="h-4 w-4" />

                                    Have a promo code?
                                </span>

                                {showCoupon ? (
                                    <ChevronUp className="h-4 w-4" />
                                ) : (
                                    <ChevronDown className="h-4 w-4" />
                                )}
                            </Button>

                            {/* COUPON INPUT */}
                            {showCoupon && (
                                <div className="mt-2 space-y-1.5">
                                    <Input
                                        placeholder="Enter promo code"
                                        className="h-10 text-sm uppercase"
                                        value={couponCode}
                                        disabled={
                                            isPending ||
                                            tx.status ===
                                            "completed"
                                        }
                                        onChange={(e) =>
                                            setCouponCode(
                                                e.target.value.toUpperCase(),
                                            )
                                        }
                                    />

                                    <p className="px-1 text-[11px] text-muted-foreground">
                                        Enter your promo code to
                                        receive a bonus if your
                                        deposit qualifies.
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* ================================================== */}
                        {/* VERIFY BUTTON */}
                        {/* ================================================== */}

                        <Button
                            disabled={
                                isPending ||
                                tx.status === "completed" ||
                                transactionId.trim().length < 5
                            }
                            onClick={handleVerify}
                            className="h-10 w-full text-sm"
                        >
                            {isPending
                                ? "Verifying..."
                                : tx.status ===
                                    "completed"
                                    ? "Deposit Completed"
                                    : "Verify Deposit"}
                        </Button>
                    </CardContent>
                </Card>
            )}
        </div>
    );
}
