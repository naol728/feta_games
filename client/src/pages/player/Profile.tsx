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

interface Transaction {
    id: number;
    type: "deposit" | "withdrawal" | "bet" | "win";
    amount: number;
    status: "completed" | "pending" | "failed";
    date: string;
    description: string;
}

export default function Profile() {
    const user = useAppSelector((state) => state.auth.user);
    const dispatch = useAppDispatch();
    const navigate = useNavigate();

    const [amount, setAmount] = useState("");
    const [withdrawamount, setWithdrawAmount] = useState("");
    const [accountNumber, setAccountNumber] = useState("");
    const [bankName, setBankName] = useState("CBE");
    const [accountName, setAccountName] = useState("");

    // ================= TRANSACTIONS =================
    const { data, isLoading } = useQuery({
        queryFn: gettransactionhistory,
        queryKey: ["gettransactionhistory"],
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
                    locked_balance: data.withdrawalId.locked_balance,
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

        if (!amount || amount < 10) {
            toast.error("Minimum withdrawal is 10 ETB");
            return;
        }

        if (!user?.wallets?.balance || user.wallets.balance < amount) {
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

    const handlenavigatetodeposit = (id: number, status: string) => { if (status === "completed") return; navigate(`/deposit/${id}`) }
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
                <Card className="rounded-2xl shadow-sm border border-border/60">
                    <CardContent className="p-5 space-y-4">

                        {/* USER */}
                        <div className="flex items-center gap-4">
                            <Avatar className="h-14 w-14">
                                <AvatarFallback className="text-lg font-bold">
                                    {user.Fname?.charAt(0)}
                                    {user.Lname?.charAt(0)}
                                </AvatarFallback>
                            </Avatar>

                            <div className="flex-1">
                                <h2 className="font-semibold text-base leading-tight">
                                    {user.Fname} {user.Lname}
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    @{user.username}
                                </p>
                            </div>
                        </div>

                        {/* BALANCE CARD */}
                        <div className="rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 p-4 border border-primary/20">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                                    <Wallet className="h-4 w-4" />
                                    Balance
                                </div>

                                <span className="text-[11px] text-muted-foreground">
                                    Locked: {user.wallets.locked_balance} ETB
                                </span>
                            </div>

                            <p className="text-xl font-bold mt-1">
                                {user.wallets.balance} ETB
                            </p>
                        </div>

                        {/* ACTIONS */}
                        <div className="grid grid-cols-2 gap-3">

                            {/* DEPOSIT (UNCHANGED LOGIC) */}
                            <Drawer>
                                <DrawerTrigger asChild>
                                    <Button className="w-full h-10 text-sm">
                                        <ArrowDownCircle className="mr-2 h-4 w-4" />
                                        Deposit
                                    </Button>
                                </DrawerTrigger>

                                {/* KEEP YOUR ORIGINAL DRAWER CONTENT */}
                                <DrawerContent className="pb-6">
                                    <DrawerHeader className="text-left">
                                        <DrawerTitle>Add Funds</DrawerTitle>
                                        <DrawerDescription>
                                            Enter amount (10 - 5000 ETB)
                                        </DrawerDescription>
                                    </DrawerHeader>

                                    <div className="px-4 space-y-3">
                                        <Input
                                            type="number"
                                            placeholder="Amount (ETB)"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="h-12 text-base"
                                        />

                                        <Button
                                            disabled={!isValid || isPending}
                                            className="w-full h-12"
                                            onClick={() => mutate({ amount })}
                                        >
                                            {isPending
                                                ? "Processing..."
                                                : `Start Deposit ${isValid ? `${numericAmount} ETB` : ""}`}
                                        </Button>
                                    </div>

                                    <DrawerFooter>
                                        <DrawerClose asChild>
                                            <Button variant="ghost">Cancel</Button>
                                        </DrawerClose>
                                    </DrawerFooter>
                                </DrawerContent>
                            </Drawer>

                            {/* WITHDRAW */}
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button variant="destructive" className="w-full h-10 text-sm">
                                        <ArrowUpCircle className="mr-2 h-4 w-4" />
                                        Withdraw
                                    </Button>
                                </DialogTrigger>

                                <DialogContent className="rounded-2xl">
                                    <DialogHeader>
                                        <DialogTitle>Withdraw Funds</DialogTitle>
                                        <DialogDescription>
                                            Enter correct details. Wrong info may delay payout.
                                        </DialogDescription>
                                    </DialogHeader>

                                    <div className="space-y-3">
                                        <Input
                                            placeholder="Amount"
                                            type="number"
                                            min={10}
                                            value={withdrawamount}
                                            onChange={(e) => setWithdrawAmount(e.target.value)}
                                        />

                                        <Input
                                            placeholder="Account Number (13 digits)"
                                            maxLength={13}
                                            value={accountNumber}
                                            onChange={(e) =>
                                                setAccountNumber(e.target.value.replace(/\D/g, ""))
                                            }
                                        />

                                        <Input
                                            placeholder="Bank Name"
                                            value={bankName}
                                            onChange={(e) => setBankName(e.target.value)}
                                        />

                                        <Input
                                            placeholder="Account Holder Name"
                                            value={accountName}
                                            onChange={(e) => setAccountName(e.target.value)}
                                        />
                                    </div>

                                    <Button
                                        className="w-full mt-4 h-10"
                                        disabled={
                                            withdrawalreqpending ||
                                            !withdrawamount ||
                                            Number(withdrawamount) < 10 ||
                                            accountNumber.length !== 13 ||
                                            !accountName
                                        }
                                        onClick={handleWithdraw}
                                    >
                                        {withdrawalreqpending ? "Processing..." : "Confirm Withdraw"}
                                    </Button>

                                    <p className="text-xs text-center text-muted-foreground">
                                        Transfers are processed within 1 hour
                                    </p>
                                </DialogContent>
                            </Dialog>

                        </div>
                    </CardContent>
                </Card>

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
                        ) : (
                            mappedTransactions.map((t) => (
                                <Card
                                    key={t.id}
                                    onClick={() => handlenavigatetodeposit(t.id, t.status)}
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
                                            <Badge variant="outline" className="text-[10px]">
                                                {t.status}
                                            </Badge>
                                        </div>

                                    </CardContent>
                                </Card>
                            ))
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