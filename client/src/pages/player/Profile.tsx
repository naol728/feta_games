/* eslint-disable */

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
    ArrowUpCircle,
    ArrowDownCircle,
    Clock,
    CheckCircle,
    Wallet,
    DollarSign,
    TrendingUp,
    CreditCard,
    History,
    Trophy,
    Star,
    Target,
    ChevronRight,
    CircleDollarSign,
} from "lucide-react";

import { useAppDispatch, useAppSelector } from "@/store/hook";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";

import { Input } from "@/components/ui/input";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { Badge } from "@/components/ui/badge";

import { useMemo, useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
    getwithDrawRequest,
    paymentMethod,
    withDrawRequest,
    gettransactionhistory,
} from "@/api/wallet";

import { toast } from "react-toastify";
import { useNavigate } from "react-router-dom";

import { setUserWallet } from "@/store/slice/auth";

import DailyStreak from "./DailyStreak";

// Types
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
    const queryclient = useQueryClient();

    // ========== User Progress ==========
    const progress = user?.progress

    const currentLevel = Number(progress?.current_level ?? 1);
    const totalPoints = Number(progress?.total_points ?? 0);
    const totalDeposit = Number(progress?.total_deposit ?? 0);
    const nextLevel = progress?.next_level ? Number(progress.next_level) : null;
    const pointsRemaining = Number(progress?.points_remaining ?? 0);
    const depositRemaining = Number(progress?.deposit_remaining ?? 0);
    const pointsProgress = Math.min(Number(progress?.points_progress_percent ?? 0), 100);
    const depositProgress = Math.min(Number(progress?.deposit_progress_percent ?? 0), 100);
    const isMaxLevel = Boolean(progress?.is_max_level);

    // ========== Wallet balances ==========
    const wallet = user?.wallets;
    const totalBalance = Number(wallet?.available_balance ?? 0);
    const withdrawable = Number(wallet?.withdrawable_balance ?? 0);
    const locked = Number(wallet?.locked_balance ?? 0);
    const available = Number(wallet?.balance ?? 0);

    // ========== Transactions ==========
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

    // ========== Withdrawals ==========
    const { data: withdrawrequests, isLoading: withdrawLoading } = useQuery({
        queryFn: getwithDrawRequest,
        queryKey: ["getwithDrawRequest"],
    });
    const withdrawals = withdrawrequests?.data ?? [];

    // ========== Deposit mutation ==========
    const { mutate, isPending } = useMutation({
        mutationFn: paymentMethod,
        onError: (error: any) => toast.error(error.message),
        onSuccess: (data) => navigate(`/deposit/${data.transaction_id}`),
    });

    // ========== Withdraw mutation ==========
    const { mutate: withdrawrequestmutate, isPending: withdrawalreqpending } = useMutation({
        mutationFn: withDrawRequest,
        onError: (error: any) => toast.error(error.message),
        onSuccess: (data) => {
            toast.success(data.message);
            queryclient.invalidateQueries({ queryKey: ["getwithDrawRequest"] });
            dispatch(
                setUserWallet({
                    balance: data.withdrawalId.balance,
                    withdrawable_balance: data.withdrawalId.withdrawable_balance,
                    locked_balance: data.withdrawalId.locked_balance,
                    available_balance: data.withdrawalId.available_balance,
                })
            );
            setWithdrawAmount("");
            setAccountNumber("");
            setAccountName("");
        },
    });

    // ========== Helpers ==========
    const getStatusIcon = (processed: boolean) =>
        processed ? (
            <CheckCircle className="h-4 w-4 text-green-500" />
        ) : (
            <Clock className="h-4 w-4 text-amber-500" />
        );

    const getStatusBadge = (processed: boolean) =>
        processed ? (
            <Badge className="bg-green-50 text-green-700 border-green-200">Completed</Badge>
        ) : (
            <Badge className="bg-amber-50 text-amber-700 border-amber-200">Pending</Badge>
        );

    const getTransactionIcon = (type: string) => {
        switch (type) {
            case "deposit":
                return <ArrowDownCircle className="h-5 w-5 text-green-500" />;
            case "withdraw":
            case "withdrawal":
                return <ArrowUpCircle className="h-5 w-5 text-red-500" />;
            case "bet":
                return <DollarSign className="h-5 w-5 text-blue-500" />;
            case "win":
                return <TrendingUp className="h-5 w-5 text-purple-500" />;
            default:
                return <Wallet className="h-5 w-5 text-muted-foreground" />;
        }
    };

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

    const handlenavigatetodeposit = (id: string | number, status: string) => {
        if (status === "completed") return;
        navigate(`/deposit/${id}`);
    };

    // ========== Withdraw handler ==========
    const handleWithdraw = () => {
        const withdrawValue = Number(withdrawamount);
        if (!withdrawValue || withdrawValue < 50) {
            toast.error("Minimum withdrawal is 50 ETB");
            return;
        }
        if (available < withdrawValue) {
            toast.error("Insufficient available balance");
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
            amount: withdrawValue,
            destination_account: accountNumber,
            bank_name: bankName,
            account_holder_name: accountName,
        });
    };

    const numericAmount = useMemo(() => {
        const value = Number(amount);
        return Number.isFinite(value) ? value : 0;
    }, [amount]);
    const isValid = numericAmount > 9;

    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full" />
            </div>
        );
    }

    // ========== Main UI ==========
    return (
        <div className="min-h-screen bg-background pb-16 px-2">
            <div className="max-w-sm mx-auto space-y-3">

                {/* --- Profile Card --- */}
                <Card className="rounded-2xl border-border/60 shadow-sm overflow-hidden">
                    <CardContent className="p-3 space-y-3">

                        {/* User row */}
                        <div className="flex items-center gap-2">
                            <Avatar className="h-9 w-9 border border-primary/20">
                                <AvatarFallback className="bg-primary/10 text-xs font-bold text-primary">
                                    {user?.Fname?.charAt(0)?.toUpperCase()}
                                    {user?.Lname?.charAt(0)?.toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                    <h2 className="truncate text-sm font-semibold">
                                        {user?.Fname} {user?.Lname}
                                    </h2>
                                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[8px] font-medium text-primary">
                                        Lv.{currentLevel}
                                    </span>
                                </div>
                                <p className="text-[10px] text-muted-foreground truncate">
                                    @{user?.username || "user"}
                                </p>
                            </div>
                        </div>

                        {/* --- Balance Summary (clear) --- */}
                        <div className="rounded-xl border border-primary/10 bg-gradient-to-br from-primary/5 to-transparent p-3">
                            <div className="flex items-center justify-between mb-1.5">
                                <span className="text-xs font-medium">Total Balance</span>
                                <span className="text-lg font-bold">{totalBalance.toFixed(2)} ETB</span>
                            </div>
                            {/* --- Withdrawable Balance (only) --- */}
                            <div className="rounded-xl border border-primary/10 bg-gradient-to-br from-primary/5 to-transparent p-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium text-muted-foreground">Withdrawable</span>
                                    <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">
                                        {withdrawable.toFixed(2)} ETB
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* --- Level Progress with clear remaining --- */}
                        <div className="bg-muted/20 rounded-xl p-2.5 border border-border/40">
                            <div className="flex items-center justify-between mb-1.5">
                                <div className="flex items-center gap-1.5">
                                    <Trophy className="h-4 w-4 text-primary" />
                                    <span className="text-xs font-medium">Level {currentLevel}</span>
                                    {!isMaxLevel && (
                                        <>
                                            <ChevronRight className="h-3 w-3 text-muted-foreground" />
                                            <span className="text-xs text-muted-foreground">{nextLevel}</span>
                                        </>
                                    )}
                                </div>
                                <span className="text-[10px] text-muted-foreground">
                                    {isMaxLevel ? "MAX" : "Progress"}
                                </span>
                            </div>

                            {/* Points progress */}
                            <div className="mb-1.5">
                                <div className="flex items-center justify-between text-[10px]">
                                    <span className="flex items-center gap-1">
                                        <Star className="h-3 w-3" /> Points
                                    </span>
                                    <span>{totalPoints.toLocaleString()} / {progress?.next_level_required_points?.toLocaleString() ?? "—"}</span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary transition-all duration-300" style={{ width: `${pointsProgress}%` }} />
                                </div>
                                <div className="text-[9px] text-muted-foreground mt-0.5">
                                    {pointsRemaining > 0 ? `${pointsRemaining.toLocaleString()} points remaining` : "✔️ Points goal met"}
                                </div>
                            </div>

                            {/* Deposit progress */}
                            <div>
                                <div className="flex items-center justify-between text-[10px]">
                                    <span className="flex items-center gap-1">
                                        <CircleDollarSign className="h-3 w-3" /> Deposit
                                    </span>
                                    <span>{totalDeposit.toFixed(0)} ETB / {progress?.next_level_minimum_deposit?.toFixed(0) ?? "—"} ETB</span>
                                </div>
                                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div className="h-full bg-primary/70 transition-all duration-300" style={{ width: `${depositProgress}%` }} />
                                </div>
                                <div className="text-[9px] text-muted-foreground mt-0.5">
                                    {depositRemaining > 0 ? `${depositRemaining.toFixed(0)} ETB remaining` : "✔️ Deposit goal met"}
                                </div>
                            </div>

                            {isMaxLevel && (
                                <div className="mt-2 text-center text-[10px] text-primary font-medium">
                                    🏆 Maximum level reached!
                                </div>
                            )}
                        </div>

                        {/* Action buttons */}
                        <div className="grid grid-cols-2 gap-2">
                            {/* Deposit Dialog */}
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button className="h-9 w-full rounded-xl text-xs font-semibold shadow-sm">
                                        <ArrowDownCircle className="mr-1.5 h-3.5 w-3.5" />
                                        Deposit
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="rounded-2xl max-w-[320px]">
                                    <DialogHeader>
                                        <DialogTitle className="text-base">Add Funds</DialogTitle>
                                        <DialogDescription className="text-xs">
                                            Enter amount (10–5,000 ETB)
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-2">
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                placeholder="Amount"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                className="h-10 rounded-xl pr-14 text-sm"
                                            />
                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                                                ETB
                                            </span>
                                        </div>
                                        <Button
                                            disabled={!isValid || isPending}
                                            className="h-10 w-full rounded-xl"
                                            onClick={() => mutate({ amount })}
                                        >
                                            {isPending ? "Processing..." : `Deposit ${numericAmount} ETB`}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>

                            {/* Withdraw Dialog */}
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="h-9 w-full rounded-xl border-destructive/30 text-xs font-semibold text-destructive hover:bg-destructive/5"
                                    >
                                        <ArrowUpCircle className="mr-1.5 h-3.5 w-3.5" />
                                        Withdraw
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="rounded-2xl max-w-[320px]">
                                    <DialogHeader>
                                        <DialogTitle className="text-base">Withdraw Funds</DialogTitle>
                                        <DialogDescription className="text-xs">
                                            Enter bank details (min 50 ETB)
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-2">
                                        <Input
                                            placeholder="Amount"
                                            type="number"
                                            min={50}
                                            value={withdrawamount}
                                            onChange={(e) => setWithdrawAmount(e.target.value)}
                                            className="h-10 rounded-xl"
                                        />
                                        <Input
                                            placeholder="Account number (13 digits)"
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={13}
                                            value={accountNumber}
                                            onChange={(e) =>
                                                setAccountNumber(e.target.value.replace(/\D/g, ""))
                                            }
                                            className="h-10 rounded-xl"
                                        />
                                        <Input
                                            placeholder="Bank name"
                                            value={bankName}
                                            onChange={(e) => setBankName(e.target.value)}
                                            className="h-10 rounded-xl"
                                        />
                                        <Input
                                            placeholder="Account holder name"
                                            value={accountName}
                                            onChange={(e) => setAccountName(e.target.value)}
                                            className="h-10 rounded-xl"
                                        />
                                        <Button
                                            className="h-10 w-full rounded-xl"
                                            disabled={
                                                withdrawalreqpending ||
                                                !withdrawamount ||
                                                Number(withdrawamount) < 50 ||
                                                accountNumber.length !== 13 ||
                                                !accountName
                                            }
                                            onClick={handleWithdraw}
                                        >
                                            {withdrawalreqpending ? "Processing..." : "Confirm"}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>
                        </div>
                    </CardContent>
                </Card>

                {/* Daily Streak */}
                <DailyStreak />

                {/* Tabs */}
                <Tabs defaultValue="transactions" className="space-y-2">
                    <TabsList className="w-full h-9 rounded-xl bg-muted p-0.5">
                        <TabsTrigger value="transactions" className="text-xs flex-1 py-1">
                            <History className="w-3.5 h-3.5 mr-1" />
                            History
                        </TabsTrigger>
                        <TabsTrigger value="withdrawals" className="text-xs flex-1 py-1">
                            <CreditCard className="w-3.5 h-3.5 mr-1" />
                            Withdrawals
                        </TabsTrigger>
                    </TabsList>

                    {/* Transactions */}
                    <TabsContent value="transactions" className="space-y-1.5">
                        {isLoading ? (
                            <div className="flex justify-center py-4">
                                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : mappedTransactions.length === 0 ? (
                            <p className="text-center text-sm text-muted-foreground py-4">
                                No transactions yet
                            </p>
                        ) : (
                            <>
                                <div className="space-y-1.5">
                                    {mappedTransactions.map((t) => (
                                        <Card
                                            key={t.id}
                                            onClick={() => handlenavigatetodeposit(t.id, t.status)}
                                            className="rounded-xl border-border/60 hover:bg-muted/30 transition cursor-pointer"
                                        >
                                            <CardContent className="flex justify-between items-center p-2.5">
                                                <div className="flex items-center gap-2">
                                                    {getTransactionIcon(t.type)}
                                                    <div>
                                                        <p className="text-sm font-medium capitalize">{t.type}</p>
                                                        <p className="text-[10px] text-muted-foreground">
                                                            {t.description}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-semibold">{t.amount} ETB</p>
                                                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                                                        {t.status}
                                                    </Badge>
                                                </div>
                                            </CardContent>
                                        </Card>
                                    ))}
                                </div>

                                {/* Pagination */}
                                {data?.pagination && data.pagination.totalPages > 1 && (
                                    <div className="flex items-center justify-between pt-2">
                                        <button
                                            disabled={!data.pagination.hasPreviousPage || isFetching}
                                            onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                                            className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40"
                                        >
                                            Prev
                                        </button>
                                        <span className="text-xs text-muted-foreground">
                                            {data.pagination.page} / {data.pagination.totalPages}
                                        </span>
                                        <button
                                            disabled={!data.pagination.hasNextPage || isFetching}
                                            onClick={() => setPage((prev) => prev + 1)}
                                            className="rounded-lg border px-3 py-1 text-xs font-medium hover:bg-muted disabled:opacity-40"
                                        >
                                            Next
                                        </button>
                                    </div>
                                )}
                                {isFetching && !isLoading && (
                                    <div className="flex justify-center pt-1">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                                    </div>
                                )}
                            </>
                        )}
                    </TabsContent>

                    {/* Withdrawals */}
                    <TabsContent value="withdrawals" className="space-y-1.5">
                        {withdrawLoading ? (
                            <div className="flex justify-center py-4">
                                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : withdrawals.length === 0 ? (
                            <p className="text-center text-sm text-muted-foreground py-4">
                                No withdrawal requests
                            </p>
                        ) : (
                            withdrawals.map((w: any) => (
                                <Card key={w.id} className="rounded-xl border-border/60">
                                    <CardContent className="flex justify-between items-center p-3">
                                        <div className="flex items-center gap-2">
                                            {getStatusIcon(w.processed)}
                                            <div>
                                                <p className="text-sm font-medium">{w.account_holder_name}</p>
                                                <p className="text-[10px] text-muted-foreground">
                                                    {w.bank_name} • {w.destination_account}
                                                </p>
                                                <p className="text-[9px] text-muted-foreground">
                                                    {formatDate(w.created_at)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-sm font-semibold text-red-500">- {w.amount} ETB</p>
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
    );
}