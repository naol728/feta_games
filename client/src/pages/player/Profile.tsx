/*eslint-disable*/
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
    ArrowUpCircle,
    ArrowDownCircle,
    Clock,
    CheckCircle,
    XCircle,
    Wallet,
    DollarSign,
    TrendingUp,
    Globe,
    CreditCard,
    History,
} from "lucide-react";

import { useAppDispatch, useAppSelector } from "@/store/hook";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer";

import { Input } from "@/components/ui/input";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
    getwithDrawRequest,
    paymentMethod,
    withDrawRequest,
    gettransactionhistory
} from "@/api/wallet";

import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

import { setUserWallet } from "@/store/slice/auth";
import DailyStreak from "./DailyStreak";

interface Transaction {
    id: string;
    type: "deposit" | "withdrawal" | "bet" | "win";
    amount: number;
    status: "completed" | "pending" | "failed";
    date: string;
    description: string;
}

export default function Profile() {
    const user = useAppSelector((state) => state.auth?.user);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const [amount, setAmount] = useState("");
    const [withdrawamount, setWithdrawAmount] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [bankName, setBankName] = useState("CBE");
    const [accountName, setAccountName] = useState("");
    const [page, setPage] = useState(1);
    const limit = 5;

    const { data, isLoading, isFetching } = useQuery({
        queryKey: ["gettransactionhistory", page, limit],
        queryFn: () => gettransactionhistory(page, limit),
        placeholderData: (previousData) => previousData,
    });
    const mappedTransactions: Transaction[] = useMemo(() => {
        if (!data?.data) return [];

        return data.data.map((t: any) => ({
            id: t.id,
            type: t.type,
            amount: t.amount,
            status: t.status,
            date: t.created_at,
            description: t.payment_method?.type || t.type || "Transaction",
        }));
    }, [data]);

    // ================= WITHDRAWALS =================
    const {
        data: withdrawrequests,
        isLoading: withdrawLoading,
    } = useQuery({
        queryFn: getwithDrawRequest,
        queryKey: ["getwithDrawRequest"],
    });
    const withdrawals = withdrawrequests?.data ?? [];
    // ================= PAYMENT =================
    const { mutate, isPending } = useMutation({
        mutationFn: paymentMethod,
        onError: (error: any) => toast.error(error.message),
        onSuccess: (data) => {
            navigate(`/deposit/${data.transaction_id}`);
        },
    });
    const queryclient = useQueryClient()
    // ================= WITHDRAW MUTATION =================
    const {
        mutate: withdrawrequestmutate,
        isPending: withdrawalreqpending,
    } = useMutation({
        mutationFn: withDrawRequest,
        onError: (error: any) => toast.error(error.message),
        onSuccess: (data) => {
            toast.success(data.message);
            queryclient.invalidateQueries({ queryKey: ["getwithDrawRequest"] })
            dispatch(
                setUserWallet({
                    balance: data.withdrawalId.balance,
                    withdrawable_balance: data.withdrawalId.withdrawable_balance,
                    locked_balance: data.withdrawalId.locked_balance,
                    available_balance: data.witdrawalId.available_balance
                })
            );

            setWithdrawAmount("");
            setAccountNumber("");
            setAccountName("");
        },
    });

    // ================= STATUS UI =================
    const getStatusIcon = (processed: boolean) => {
        return processed ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
            <Clock className="h-4 w-4 text-amber-500" />
        );
    };

    const getStatusBadge = (processed: boolean) => {
        return processed ? (
            <Badge className="bg-green-50 text-green-700 border-green-200">
                Completed
            </Badge>
        ) : (
            <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                Pending
            </Badge>
        );
    };

    const getTransactionIcon = (type: string) => {
        switch (type) {
            case "deposit":
                return <ArrowDownCircle className="h-5 w-5 text-green-500" />;
            case "withdraw":
                return <ArrowUpCircle className="h-5 w-5 text-red-500" />;
            case "bet":
                return <DollarSign className="h-5 w-5 text-blue-500" />;
            case "win":
                return <TrendingUp className="h-5 w-5 text-purple-500" />;
            default:
                return <Wallet className="h-5 w-5 text-muted-foreground" />;
        }
    };

    // ================= WITHDRAW HANDLER =================
    const handleWithdraw = () => {
        const amount = Number(withdrawamount);

        if (!amount || amount < 50) {
            toast.error("Minimum withdrawal is 50 ETB");
            return;
        }

        if ((user?.wallets?.available_balance ?? 0) < amount) {
            toast.error("Insufficient balance");
            return;
        }

        if (accountNumber.length !== 13) {
            toast.error("Account number must be 13 digits");
            return;
        }

        if (!accountName.trim()) {
            toast.error("Account holder name required");
            return;
        }

        withdrawrequestmutate({
            amount,
            destination_account: accountNumber,
            bank_name: bankName,
            account_holder_name: accountName,
        });
    };
    const numericAmount = useMemo(() => {
        const val = Number(amount)
        return Number.isFinite(val) ? val : 0
    }, [amount])
    const formatDate = (dateString: string) => {
        const date = new Date(dateString);

        return date.toLocaleString("en-US", {
            year: "numeric",
            month: "short",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
        });
    };


    const isValid = numericAmount > 9

    const handlenavigatetodeposit = (id: string | number, status: string) => { if (status === "completed") return; navigate(`/deposit/${id}`) }
    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin h-10 w-10 border-b-2 border-primary rounded-full" />
            </div>
        );
    }


    return (
        <div className="min-h-screen bg-background pb-20 px-3">
            <div className="max-w-xl mx-auto space-y-5">
                {/* ================= PROFILE CARD ================= */}
                <Card className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
                    <CardContent className="p-4 sm:p-5 space-y-4">

                        {/* USER PROFILE */}
                        <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12 border border-primary/20 shadow-sm">
                                <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                                    {user?.Fname?.charAt(0)?.toUpperCase()}
                                    {user?.Lname?.charAt(0)?.toUpperCase()}
                                </AvatarFallback>
                            </Avatar>

                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <h2 className="truncate text-sm font-semibold">
                                        {user?.Fname} {user?.Lname}
                                    </h2>

                                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-medium text-primary">
                                        Account
                                    </span>
                                </div>

                                <p className="mt-0.5 truncate text-xs text-muted-foreground">
                                    @{user?.username || "user"}
                                </p>
                            </div>
                        </div>

                        {/* BALANCE */}
                        <div className="rounded-xl border border-primary/15 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                                        <Wallet className="h-3.5 w-3.5 text-primary" />
                                    </div>

                                    <div>
                                        <p className="text-xs font-medium">Total Balance</p>
                                        <p className="text-[9px] text-muted-foreground">
                                            Available account funds
                                        </p>
                                    </div>
                                </div>

                                <span className="rounded-md bg-background/70 px-2 py-1 text-[9px] font-medium text-muted-foreground">
                                    ETB
                                </span>
                            </div>

                            <div className="mt-3">
                                <p className="text-2xl font-bold tracking-tight">
                                    {user?.wallets?.balance?.toFixed(2) ?? "0.00"}
                                    <span className="ml-1.5 text-xs font-medium text-muted-foreground">
                                        ETB
                                    </span>
                                </p>
                            </div>

                            {/* BALANCE BREAKDOWN */}
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                {/* Withdrawable */}
                                <div className="rounded-lg border border-emerald-500/10 bg-background/60 px-3 py-2.5">
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />

                                        <span className="text-[10px] font-medium text-muted-foreground">
                                            Withdrawable
                                        </span>
                                    </div>

                                    <p className="mt-1 text-sm font-semibold">
                                        {user?.wallets?.withdrawable_balance?.toFixed(2) ?? "0.00"}
                                        <span className="ml-1 text-[9px] font-normal text-muted-foreground">
                                            ETB
                                        </span>
                                    </p>
                                </div>

                                {/* Locked */}
                                <div className="rounded-lg border border-amber-500/10 bg-background/60 px-3 py-2.5">
                                    <div className="flex items-center gap-1.5">
                                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />

                                        <span className="text-[10px] font-medium text-muted-foreground">
                                            Locked
                                        </span>
                                    </div>

                                    <p className="mt-1 text-sm font-semibold">
                                        {user?.wallets?.locked_balance?.toFixed(2) ?? "0.00"}
                                        <span className="ml-1 text-[9px] font-normal text-muted-foreground">
                                            ETB
                                        </span>
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ACTIONS */}
                        <div className="grid grid-cols-2 gap-2.5">

                            {/* DEPOSIT */}
                            <Drawer>
                                <DrawerTrigger asChild>
                                    <Button className="h-11 w-full rounded-xl text-xs font-semibold shadow-sm">
                                        <ArrowDownCircle className="mr-2 h-4 w-4" />
                                        Deposit
                                    </Button>
                                </DrawerTrigger>

                                <DrawerContent className="rounded-t-2xl pb-6">
                                    <DrawerHeader className="text-left">
                                        <DrawerTitle className="text-lg">
                                            Add Funds
                                        </DrawerTitle>

                                        <DrawerDescription className="text-xs">
                                            Enter an amount between 10 and 5,000 ETB.
                                        </DrawerDescription>
                                    </DrawerHeader>

                                    <div className="space-y-3 px-4">
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                placeholder="Amount"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                className="h-12 rounded-xl pr-14 text-base"
                                            />

                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                                                ETB
                                            </span>
                                        </div>

                                        <Button
                                            disabled={!isValid || isPending}
                                            className="h-12 w-full rounded-xl"
                                            onClick={() => mutate({ amount })}
                                        >
                                            {isPending
                                                ? "Processing..."
                                                : `Start Deposit ${isValid ? `${numericAmount} ETB` : ""
                                                }`}
                                        </Button>
                                    </div>

                                    <DrawerFooter>
                                        <DrawerClose asChild>
                                            <Button variant="ghost" className="rounded-xl">
                                                Cancel
                                            </Button>
                                        </DrawerClose>
                                    </DrawerFooter>
                                </DrawerContent>
                            </Drawer>

                            {/* WITHDRAW */}
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="h-11 w-full rounded-xl border-destructive/30 text-xs font-semibold text-destructive hover:bg-destructive/5 hover:text-destructive"
                                    >
                                        <ArrowUpCircle className="mr-2 h-4 w-4" />
                                        Withdraw
                                    </Button>
                                </DialogTrigger>

                                <DialogContent className="rounded-2xl sm:max-w-md">
                                    <DialogHeader>
                                        <DialogTitle className="text-lg">
                                            Withdraw Funds
                                        </DialogTitle>

                                        <DialogDescription className="text-xs leading-relaxed">
                                            Enter your bank details carefully. Incorrect information may
                                            delay your payout.
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="space-y-3">
                                        {/* Amount */}
                                        <div className="relative">
                                            <Input
                                                placeholder="Withdrawal amount"
                                                type="number"
                                                min={50}
                                                value={withdrawamount}
                                                onChange={(e) => setWithdrawAmount(e.target.value)}
                                                className="h-11 rounded-xl pr-14"
                                            />

                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-muted-foreground">
                                                ETB
                                            </span>
                                        </div>

                                        <p className="-mt-1 px-1 text-[10px] text-muted-foreground">
                                            Minimum withdrawal: 50 ETB
                                        </p>

                                        {/* Account Number */}
                                        <Input
                                            placeholder="Account number"
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={13}
                                            value={accountNumber}
                                            onChange={(e) =>
                                                setAccountNumber(e.target.value.replace(/\D/g, ""))
                                            }
                                            className="h-11 rounded-xl"
                                        />

                                        {/* Bank */}
                                        <Input
                                            placeholder="Bank name"
                                            value={bankName}
                                            onChange={(e) => setBankName(e.target.value)}
                                            className="h-11 rounded-xl"
                                        />

                                        {/* Account Name */}
                                        <Input
                                            placeholder="Account holder name"
                                            value={accountName}
                                            onChange={(e) => setAccountName(e.target.value)}
                                            className="h-11 rounded-xl"
                                        />
                                    </div>

                                    <Button
                                        className="mt-2 h-11 w-full rounded-xl"
                                        disabled={
                                            withdrawalreqpending ||
                                            !withdrawamount ||
                                            Number(withdrawamount) < 50 ||
                                            accountNumber.length !== 13 ||
                                            !accountName
                                        }
                                        onClick={handleWithdraw}
                                    >
                                        {withdrawalreqpending
                                            ? "Processing..."
                                            : "Confirm Withdrawal"}
                                    </Button>

                                    <p className="text-center text-[10px] text-muted-foreground">
                                        Withdrawals are normally processed within 1 hour.
                                    </p>
                                </DialogContent>
                            </Dialog>
                        </div>

                    </CardContent>
                </Card>
                <DailyStreak />
                {/* ================= TABS ================= */}
                <Tabs defaultValue="transactions" className="space-y-3">

                    <TabsList className="flex w-fit mx-auto h-10 rounded-xl bg-muted p-1">
                        <TabsTrigger value="transactions" className="text-xs px-4">
                            <History className="w-4 h-4 mr-1" />
                            Transactions
                        </TabsTrigger>

                        <TabsTrigger value="withdrawals" className="text-xs px-4">
                            <CreditCard className="w-4 h-4 mr-1" />
                            Withdrawals
                        </TabsTrigger>
                    </TabsList>

                    {/* TRANSACTIONS */}
                    <TabsContent value="transactions" className="space-y-2">
                        {isLoading ? (
                            <div className="flex justify-center py-6">
                                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : mappedTransactions.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-center">
                                <p className="text-sm font-medium">
                                    No transactions yet
                                </p>

                                <p className="text-xs text-muted-foreground mt-1">
                                    Your transaction history will appear here.
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    {mappedTransactions.map((t) => (
                                        <Card
                                            key={t.id}
                                            onClick={() =>
                                                handlenavigatetodeposit(
                                                    t.id,
                                                    t.status
                                                )
                                            }
                                            className="rounded-xl border border-border/60 hover:bg-muted/30 transition cursor-pointer"
                                        >
                                            <CardContent className="flex justify-between items-center p-3">
                                                <div className="flex items-center gap-3">
                                                    {getTransactionIcon(t.type)}

                                                    <div>
                                                        <p className="text-sm font-medium capitalize">
                                                            {t.type}
                                                        </p>

                                                        <p className="text-[11px] text-muted-foreground">
                                                            {t.description}
                                                        </p>
                                                    </div>
                                                </div>

                                                <div className="text-right">
                                                    <p className="text-sm font-semibold">
                                                        {t.amount} ETB
                                                    </p>

                                                    <Badge
                                                        variant="outline"
                                                        className="text-[10px]"
                                                    >
                                                        {t.status}
                                                    </Badge>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>

                                {/* Pagination */}
                                {data?.pagination && data.pagination.totalPages > 1 && (
                                    <div className="flex items-center justify-between pt-3">
                                        <button
                                            type="button"
                                            disabled={
                                                !data.pagination.hasPreviousPage ||
                                                isFetching
                                            }
                                            onClick={() =>
                                                setPage((prev) => Math.max(prev - 1, 1))
                                            }
                                            className="rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                                        >
                                            Previous
                                        </button>

                                        <span className="text-xs text-muted-foreground">
                                            Page {data.pagination.page} of{" "}
                                            {data.pagination.totalPages}
                                        </span>

                                        <button
                                            type="button"
                                            disabled={
                                                !data.pagination.hasNextPage ||
                                                isFetching
                                            }
                                            onClick={() =>
                                                setPage((prev) => prev + 1)
                                            }
                                            className="rounded-lg border px-3 py-1.5 text-xs font-medium transition hover:bg-muted disabled:pointer-events-none disabled:opacity-40"
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}

                                {/* Small loading indicator when changing pages */}
                                {isFetching && !isLoading && (
                                    <div className="flex justify-center pt-2">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                    </div>
                                )}
                            </>
                        )}
                    </TabsContent>

                    {/* WITHDRAWALS */}
                    <TabsContent value="withdrawals" className="space-y-2">
                        {withdrawLoading ? (
                            <div className="flex justify-center py-6">
                                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : withdrawals.length === 0 ? (
                            <p className="text-center text-sm text-muted-foreground">
                                No withdrawal requests
                            </p>
                        ) : (
                            withdrawals.map((w: any) => (
                                <Card key={w.id} className="rounded-xl border border-border/60">
                                    <CardContent className="flex justify-between items-center p-4">

                                        <div className="flex items-center gap-3">
                                            {getStatusIcon(w.processed)}

                                            <div>
                                                <p className="text-sm font-medium">
                                                    {w.account_holder_name}
                                                </p>

                                                <p className="text-[11px] text-muted-foreground">
                                                    {w.bank_name} • {w.destination_account}
                                                </p>

                                                <p className="text-[10px] text-muted-foreground">
                                                    {formatDate(w.created_at)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-red-500">
                                                - {w.amount} ETB
                                            </p>

                                            {getStatusBadge(w.processed)}
                                        </div>

                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </TabsContent>

                </Tabs>

            </div>
        </div>
    )
}