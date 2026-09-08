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
    ChevronRight,
    CircleDollarSign,
    Gift,
    Sparkles,
    Shield,
    Zap,
} from "lucide-react";

import { useAppDispatch, useAppSelector } from "@/store/hook";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
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

// ========== Types ==========
interface Transaction {
    id: string;
    type: "deposit" | "withdrawal" | "bet" | "win";
    amount: number;
    status: "completed" | "pending" | "failed";
    date: string;
    description: string;
}

interface Benefit {
    type: string;
    unit: string;
    label: string;
    value: number | boolean;
    description: string;
}

interface UserProgress {
    user_id: string;
    current_level: number;
    total_points: number;
    total_deposit: number;
    current_level_required_points: number;
    current_level_minimum_deposit: number;
    current_level_description?: string;
    current_level_benefits?: Benefit[];
    next_level: number | null;
    next_level_required_points: number;
    next_level_minimum_deposit: number;
    next_level_description?: string;
    next_level_benefits?: Benefit[];
    points_remaining: number;
    deposit_remaining: number;
    points_progress_percent: number;
    deposit_progress_percent: number;
    is_max_level: boolean;
}

// ========== Helper to get benefit icon ==========
const getBenefitIcon = (type: string) => {
    switch (type) {
        case "daily_cashback":
            return <TrendingUp className="h-4 w-4 text-green-500" />;
        case "daily_bonus":
            return <Gift className="h-4 w-4 text-amber-500" />;
        case "deposit_bonus":
            return <CircleDollarSign className="h-4 w-4 text-blue-500" />;
        case "priority_support":
            return <Shield className="h-4 w-4 text-purple-500" />;
        default:
            return <Sparkles className="h-4 w-4 text-muted-foreground" />;
    }
};

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
    const [benefitsOpen, setBenefitsOpen] = useState(false);

    const limit = 5;
    const queryclient = useQueryClient();

    // ========== User Progress ==========
    const progress = user?.progress as UserProgress | undefined;

    const currentLevel = Number(progress?.current_level ?? 1);
    const totalPoints = Number(progress?.total_points ?? 0);
    const totalDeposit = Number(progress?.total_deposit ?? 0);
    const nextLevel = progress?.next_level ? Number(progress.next_level) : null;
    const pointsRemaining = Number(progress?.points_remaining ?? 0);
    const depositRemaining = Number(progress?.deposit_remaining ?? 0);
    const pointsProgress = Math.min(
        Number(progress?.points_progress_percent ?? 0),
        100
    );
    const depositProgress = Math.min(
        Number(progress?.deposit_progress_percent ?? 0),
        100
    );
    const isMaxLevel = Boolean(progress?.is_max_level);

    // Level description and benefits
    const currentLevelDescription = progress?.current_level_description || "";
    const currentBenefits = progress?.current_level_benefits || [];
    const nextLevelDescription = progress?.next_level_description || "";
    const nextBenefits = progress?.next_level_benefits || [];

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
    const { mutate: withdrawrequestmutate, isPending: withdrawalreqpending } =
        useMutation({
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
            <Badge className="bg-green-50 text-green-700 border-green-200">
                Completed
            </Badge>
        ) : (
            <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                Pending
            </Badge>
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
        <div className="min-h-screen bg-background pb-16 px-3">
            <div className="max-w-sm mx-auto space-y-4">

                {/* --- Profile Card --- */}
                <Card className="rounded-3xl border-border/60 shadow-md overflow-hidden">
                    <CardContent className="p-4 space-y-4">

                        {/* User row with larger avatar */}
                        <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12 border-2 border-primary/20">
                                <AvatarFallback className="bg-primary/10 text-sm font-bold text-primary">
                                    {user?.Fname?.charAt(0)?.toUpperCase()}
                                    {user?.Lname?.charAt(0)?.toUpperCase()}
                                </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                    <h2 className="truncate text-base font-semibold">
                                        {user?.Fname} {user?.Lname}
                                    </h2>
                                    <Badge className="bg-primary/10 text-primary text-[9px] px-2 py-0.5 border-0">
                                        Lv.{currentLevel}
                                    </Badge>
                                </div>
                                <p className="text-[11px] text-muted-foreground truncate">
                                    @{user?.username || "user"}
                                </p>
                            </div>
                        </div>

                        {/* --- Balance Summary (Enhanced) --- */}
                        <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-4 border border-primary/10">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-muted-foreground">Total Balance</span>
                                <span className="text-2xl font-bold tracking-tight">
                                    {totalBalance.toFixed(2)} <span className="text-sm font-normal text-muted-foreground">ETB</span>
                                </span>
                            </div>
                            <div className="mt-3 grid grid-cols-2 gap-2">
                                <div className="bg-background/60 rounded-xl p-2.5 text-center">
                                    <span className="text-[10px] text-muted-foreground">Withdrawable</span>
                                    <p className="text-base font-bold text-emerald-600 dark:text-emerald-400">
                                        {withdrawable.toFixed(2)}
                                    </p>
                                </div>
                                <div className="bg-background/60 rounded-xl p-2.5 text-center">
                                    <span className="text-[10px] text-muted-foreground">Locked</span>
                                    <p className="text-base font-bold text-amber-600 dark:text-amber-400">
                                        {locked.toFixed(2)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* --- Level Progress (Enhanced) --- */}
                        <div className="bg-muted/20 rounded-2xl p-3 border border-border/40">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <Trophy className="h-5 w-5 text-primary" />
                                    <span className="text-sm font-semibold">Level {currentLevel}</span>
                                    {!isMaxLevel && (
                                        <>
                                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                            <span className="text-sm text-muted-foreground">{nextLevel}</span>
                                        </>
                                    )}
                                </div>
                                <button
                                    onClick={() => setBenefitsOpen(true)}
                                    className="flex items-center gap-1 text-[10px] font-medium text-primary hover:underline"
                                >
                                    <Sparkles className="h-3 w-3" />
                                    Benefits
                                </button>
                            </div>

                            {/* Level description */}
                            {currentLevelDescription && (
                                <p className="text-[11px] text-muted-foreground mb-3 leading-relaxed">
                                    {currentLevelDescription}
                                </p>
                            )}

                            {/* Points progress */}
                            <div className="mb-3">
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1">
                                        <Star className="h-3.5 w-3.5 text-primary" /> Points
                                    </span>
                                    <span className="font-medium">
                                        {totalPoints.toLocaleString()} / {progress?.next_level_required_points?.toLocaleString() ?? "—"}
                                    </span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden mt-1">
                                    <div
                                        className="h-full bg-gradient-to-r from-primary/70 to-primary transition-all duration-500"
                                        style={{ width: `${pointsProgress}%` }}
                                    />
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                    {pointsRemaining > 0 ? `${pointsRemaining.toLocaleString()} points remaining` : "✅ Points goal met"}
                                </div>
                            </div>

                            {/* Deposit progress */}
                            <div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex items-center gap-1">
                                        <CircleDollarSign className="h-3.5 w-3.5 text-primary" /> Deposit
                                    </span>
                                    <span className="font-medium">
                                        {totalDeposit.toFixed(0)} ETB / {progress?.next_level_minimum_deposit?.toFixed(0) ?? "—"} ETB
                                    </span>
                                </div>
                                <div className="h-2 bg-muted rounded-full overflow-hidden mt-1">
                                    <div
                                        className="h-full bg-gradient-to-r from-primary/50 to-primary/80 transition-all duration-500"
                                        style={{ width: `${depositProgress}%` }}
                                    />
                                </div>
                                <div className="text-[10px] text-muted-foreground mt-0.5">
                                    {depositRemaining > 0 ? `${depositRemaining.toFixed(0)} ETB remaining` : "✅ Deposit goal met"}
                                </div>
                            </div>

                            {isMaxLevel && (
                                <div className="mt-3 text-center text-xs font-medium text-primary">
                                    🏆 Maximum level reached!
                                </div>
                            )}
                        </div>

                        {/* Action buttons - larger, more prominent */}
                        <div className="grid grid-cols-2 gap-3">
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button className="h-11 w-full rounded-2xl text-sm font-semibold shadow-sm">
                                        <ArrowDownCircle className="mr-2 h-4 w-4" />
                                        Deposit
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="rounded-3xl max-w-[340px] p-6">
                                    <DialogHeader>
                                        <DialogTitle className="text-xl">Add Funds</DialogTitle>
                                        <DialogDescription className="text-sm">
                                            Enter amount (10–5,000 ETB)
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-3">
                                        <div className="relative">
                                            <Input
                                                type="number"
                                                placeholder="Amount"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                className="h-12 rounded-2xl pr-14 text-base"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                                                ETB
                                            </span>
                                        </div>
                                        <Button
                                            disabled={!isValid || isPending}
                                            className="h-12 w-full rounded-2xl text-base"
                                            onClick={() => mutate({ amount })}
                                        >
                                            {isPending ? "Processing..." : `Deposit ${numericAmount} ETB`}
                                        </Button>
                                    </div>
                                </DialogContent>
                            </Dialog>

                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button
                                        variant="outline"
                                        className="h-11 w-full rounded-2xl border-destructive/30 text-sm font-semibold text-destructive hover:bg-destructive/5"
                                    >
                                        <ArrowUpCircle className="mr-2 h-4 w-4" />
                                        Withdraw
                                    </Button>
                                </DialogTrigger>
                                <DialogContent className="rounded-3xl max-w-[340px] p-6">
                                    <DialogHeader>
                                        <DialogTitle className="text-xl">Withdraw Funds</DialogTitle>
                                        <DialogDescription className="text-sm">
                                            Enter bank details (min 50 ETB)
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="space-y-3">
                                        <Input
                                            placeholder="Amount"
                                            type="number"
                                            min={50}
                                            value={withdrawamount}
                                            onChange={(e) => setWithdrawAmount(e.target.value)}
                                            className="h-12 rounded-2xl"
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
                                            className="h-12 rounded-2xl"
                                        />
                                        <Input
                                            placeholder="Bank name"
                                            value={bankName}
                                            onChange={(e) => setBankName(e.target.value)}
                                            className="h-12 rounded-2xl"
                                        />
                                        <Input
                                            placeholder="Account holder name"
                                            value={accountName}
                                            onChange={(e) => setAccountName(e.target.value)}
                                            className="h-12 rounded-2xl"
                                        />
                                        <Button
                                            className="h-12 w-full rounded-2xl text-base"
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

                {/* Tabs - Enhanced */}
                <Tabs defaultValue="transactions" className="space-y-3">
                    <TabsList className="w-full h-11 rounded-2xl bg-muted p-1">
                        <TabsTrigger value="transactions" className="text-xs flex-1 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <History className="w-4 h-4 mr-1.5" />
                            History
                        </TabsTrigger>
                        <TabsTrigger value="withdrawals" className="text-xs flex-1 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm">
                            <CreditCard className="w-4 h-4 mr-1.5" />
                            Withdrawals
                        </TabsTrigger>
                    </TabsList>

                    {/* Transactions */}
                    <TabsContent value="transactions" className="space-y-2">
                        {isLoading ? (
                            <div className="flex justify-center py-6">
                                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : mappedTransactions.length === 0 ? (
                            <p className="text-center text-sm text-muted-foreground py-6">
                                No transactions yet
                            </p>
                        ) : (
                            <>
                                <div className="space-y-2">
                                    {mappedTransactions.map((t) => (
                                        <Card
                                            key={t.id}
                                            onClick={() => handlenavigatetodeposit(t.id, t.status)}
                                            className="rounded-2xl border-border/60 hover:bg-muted/30 transition cursor-pointer"
                                        >
                                            <CardContent className="flex justify-between items-center p-3">
                                                <div className="flex items-center gap-3">
                                                    {getTransactionIcon(t.type)}
                                                    <div>
                                                        <p className="text-sm font-medium capitalize">{t.type}</p>
                                                        <p className="text-[11px] text-muted-foreground">
                                                            {t.description}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-sm font-semibold">{t.amount} ETB</p>
                                                    <Badge variant="outline" className="text-[10px] px-2 py-0">
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
                                            className="rounded-xl border px-4 py-2 text-xs font-medium hover:bg-muted disabled:opacity-40"
                                        >
                                            Prev
                                        </button>
                                        <span className="text-xs text-muted-foreground">
                                            {data.pagination.page} / {data.pagination.totalPages}
                                        </span>
                                        <button
                                            disabled={!data.pagination.hasNextPage || isFetching}
                                            onClick={() => setPage((prev) => prev + 1)}
                                            className="rounded-xl border px-4 py-2 text-xs font-medium hover:bg-muted disabled:opacity-40"
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
                    <TabsContent value="withdrawals" className="space-y-2">
                        {withdrawLoading ? (
                            <div className="flex justify-center py-6">
                                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            </div>
                        ) : withdrawals.length === 0 ? (
                            <p className="text-center text-sm text-muted-foreground py-6">
                                No withdrawal requests
                            </p>
                        ) : (
                            withdrawals.map((w: any) => (
                                <Card key={w.id} className="rounded-2xl border-border/60">
                                    <CardContent className="flex justify-between items-center p-3">
                                        <div className="flex items-center gap-3">
                                            {getStatusIcon(w.processed)}
                                            <div>
                                                <p className="text-sm font-medium">{w.account_holder_name}</p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {w.bank_name} • {w.destination_account}
                                                </p>
                                                <p className="text-[10px] text-muted-foreground">
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

                {/* ========== Benefits Dialog (Enhanced) ========== */}
                <Dialog open={benefitsOpen} onOpenChange={setBenefitsOpen}>
                    <DialogContent className="rounded-3xl max-w-md max-h-[80vh] overflow-y-auto p-6">
                        <DialogHeader>
                            <DialogTitle className="text-xl flex items-center gap-2">
                                <Trophy className="h-5 w-5 text-primary" />
                                Level Benefits
                            </DialogTitle>
                            <DialogDescription className="text-sm">
                                Perks you unlock at your current level and the next.
                            </DialogDescription>
                        </DialogHeader>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            {/* Current Level */}
                            <div className="bg-muted/20 rounded-2xl p-4 border border-border/40">
                                <h4 className="text-sm font-semibold flex items-center gap-2">
                                    <Trophy className="h-4 w-4 text-primary" />
                                    Level {currentLevel}
                                </h4>
                                {currentLevelDescription && (
                                    <p className="text-[11px] text-muted-foreground mt-1">
                                        {currentLevelDescription}
                                    </p>
                                )}
                                <div className="mt-3 space-y-2">
                                    {currentBenefits.length > 0 ? (
                                        currentBenefits.map((benefit, idx) => (
                                            <div
                                                key={idx}
                                                className="bg-background/60 rounded-xl p-2.5 flex items-start gap-2"
                                            >
                                                <div className="mt-0.5">{getBenefitIcon(benefit.type)}</div>
                                                <div>
                                                    <p className="text-xs font-medium">{benefit.label}</p>
                                                    <p className="text-[10px] text-muted-foreground">
                                                        {benefit.description}
                                                    </p>
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p className="text-[11px] text-muted-foreground">No benefits yet.</p>
                                    )}
                                </div>
                            </div>

                            {/* Next Level (if not max) */}
                            {!isMaxLevel && nextLevel && (
                                <div className="bg-muted/20 rounded-2xl p-4 border border-border/40">
                                    <h4 className="text-sm font-semibold flex items-center gap-2">
                                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                                        Level {nextLevel}
                                    </h4>
                                    {nextLevelDescription && (
                                        <p className="text-[11px] text-muted-foreground mt-1">
                                            {nextLevelDescription}
                                        </p>
                                    )}
                                    <div className="mt-3 space-y-2">
                                        {nextBenefits.length > 0 ? (
                                            nextBenefits.map((benefit, idx) => (
                                                <div
                                                    key={idx}
                                                    className="bg-background/60 rounded-xl p-2.5 flex items-start gap-2"
                                                >
                                                    <div className="mt-0.5">{getBenefitIcon(benefit.type)}</div>
                                                    <div>
                                                        <p className="text-xs font-medium">{benefit.label}</p>
                                                        <p className="text-[10px] text-muted-foreground">
                                                            {benefit.description}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <p className="text-[11px] text-muted-foreground">No benefits listed yet.</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>

                        <DialogFooter className="mt-4">
                            <Button variant="outline" onClick={() => setBenefitsOpen(false)} className="rounded-2xl">
                                Close
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>
        </div>
    );
}