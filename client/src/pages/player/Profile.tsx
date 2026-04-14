/*eslint-disable*/
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
    ArrowUpCircle,
    ArrowDownCircle,
    ArrowLeft,
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

import { useAppSelector } from "@/store/hook";
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer"
import { Input } from "@/components/ui/input"
import { useMemo, useState } from "react"
import { useMutation, useQuery } from "@tanstack/react-query"
import { paymentMethod } from "@/api/wallet"
import { toast } from "react-toastify"
import { useNavigate } from "react-router-dom"
import { gettransactionhistory } from "@/api/wallet"
interface Transaction {
    id: number;
    type: "deposit" | "withdrawal" | "bet" | "win";
    amount: number;
    status: "completed" | "pending" | "failed";
    date: string;
    description: string;
}

interface WithdrawRequest {
    id: number;
    amount: number;
    status: "pending" | "approved";
    requestedAt: string;
    processedAt?: string;
    method: string;
}

export default function Profile() {
    const user = useAppSelector((state) => state.auth.user);
    const { data, error, isLoading } = useQuery({
        queryFn: gettransactionhistory,
        queryKey: ["gettransactionhistory"]
    })
    const mappedTransactions: Transaction[] = useMemo(() => {
        if (!data?.data) return [];

        return data.data.map((t: any) => ({
            id: t.id,
            type: t.type,
            amount: t.amount,
            status: t.status,
            date: t.created_at,
            description:
                t.payment_method?.type ||
                t.type ||
                "Transaction",
        }));
    }, [data]);
    const [amount, setAmount] = useState("")
    const navigate = useNavigate()

    const numericAmount = useMemo(() => {
        const val = Number(amount)
        return Number.isFinite(val) ? val : 0
    }, [amount])

    const { mutate, isPending } = useMutation({
        mutationFn: paymentMethod,
        mutationKey: ["paymentMethod"],
        onError: (error) => toast.error(error.message),
        onSuccess: (data) => {
            navigate(`/deposit/${data.transaction_id}`)
        }
    })

    const isValid = numericAmount > 10


    const withdrawRequests: WithdrawRequest[] = [
        { id: 1, amount: 200, status: "pending", requestedAt: "2024-03-13", method: "Bank Transfer" },
        { id: 2, amount: 150, status: "approved", requestedAt: "2024-03-10", processedAt: "2024-03-11", method: "Telebirr" },
    ];



    const handleWithdraw = () => {
        alert("Withdraw clicked!");
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "completed":
            case "approved":
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case "pending":
                return <Clock className="h-4 w-4 text-amber-500" />;
            case "failed":
            case "rejected":
                return <XCircle className="h-4 w-4 text-destructive" />;
            default:
                return null;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case "completed":
            case "approved":
                return (
                    <Badge className="bg-green-50 text-green-700 border-green-200">
                        Completed
                    </Badge>
                );
            case "pending":
                return (
                    <Badge className="bg-amber-50 text-amber-700 border-amber-200">
                        Pending
                    </Badge>
                );
            case "failed":
            case "rejected":
                return (
                    <Badge className="bg-red-50 text-red-700 border-red-200">
                        Failed
                    </Badge>
                );
            default:
                return null;
        }
    };

    const getTransactionIcon = (type: string) => {
        switch (type) {
            case "deposit":
                return <ArrowDownCircle className="h-5 w-5 text-green-500" />;
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
    const handlenavigatetodeposit = (id: number, status: string) => {
        if (status === "completed") return;
        navigate(`/deposit/${id}`)
    }

    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-4 pb-16">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Profile Card */}
                <Card>
                    <CardContent className="p-4">

                        <div className="flex flex-col items-center text-center space-y-3 mb-6">
                            <Avatar className="h-20 w-20">
                                <AvatarFallback className="bg-primary text-white text-lg">
                                    {user?.Fname?.charAt(0)}
                                    {user?.Lname?.charAt(0)}
                                </AvatarFallback>
                            </Avatar>

                            <div>
                                <h2 className="text-lg font-semibold">
                                    {user?.Fname} {user?.Lname}
                                </h2>
                                <p className="text-muted-foreground">
                                    @{user?.username || "no_username"}
                                </p>
                            </div>
                        </div>

                        {/* Balance */}
                        <div className="border rounded-lg p-3 mb-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Wallet className="h-4 w-4 text-primary" />
                                <span className="text-sm text-muted-foreground">Balance</span>
                            </div>
                            <p className="text-lg font-bold">
                                {user?.wallets?.balance?.toLocaleString() || 0} ETB
                            </p>
                            <p className="text-xs text-muted-foreground">
                                Locked: {user?.wallets?.locked_balance?.toLocaleString() || 0} ETB
                            </p>
                        </div>

                        {/* Language */}
                        <div className="border rounded-lg p-3 mb-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Globe className="h-4 w-4 text-primary" />
                                <span className="text-xs text-muted-foreground">Language</span>
                            </div>
                            <p className="font-medium">
                                EN
                            </p>
                        </div>

                        {/* Buttons */}
                        <div className="grid grid-cols-2 gap-3">
                            <Drawer>
                                <DrawerTrigger asChild>
                                    <Button size="sm" className="h-8 px-3 text-xs ">
                                        <ArrowDownCircle className="mr-2 h-4 w-4" />
                                        Deposit
                                    </Button>
                                </DrawerTrigger>

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

                            <Button variant="destructive" onClick={handleWithdraw}>
                                <ArrowUpCircle className="mr-2 h-4 w-4" />
                                Withdraw
                            </Button>
                        </div>

                    </CardContent>
                </Card>

                {/* Tabs */}
                <Tabs defaultValue="transactions">

                    <TabsList className="grid grid-cols-2">
                        <TabsTrigger value="transactions">
                            <History className="mr-2 h-4 w-4" />
                            Transactions
                        </TabsTrigger>

                        <TabsTrigger value="withdrawals">
                            <CreditCard className="mr-2 h-4 w-4" />
                            Withdrawals
                        </TabsTrigger>
                    </TabsList>

                    {/* Transactions */}
                    <TabsContent value="transactions" className="space-y-3 mt-4">
                        {isLoading ? (
                            <p className="text-center text-sm">Loading...</p>
                        ) : mappedTransactions.length === 0 ? (
                            <p className="text-center text-sm text-muted-foreground">
                                No transactions found
                            </p>
                        ) : (
                            mappedTransactions.map((t) => (
                                <Card key={t.id} onClick={() => handlenavigatetodeposit(t.id, t.status)}>
                                    <CardContent className="p-3 flex justify-between">
                                        <div className="flex gap-3">
                                            {getTransactionIcon(t.type)}
                                            <div>
                                                <p className="font-medium capitalize">{t.type}</p>
                                                <p className="text-xs text-muted-foreground">
                                                    {t.description}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="text-right">
                                            <p className="font-bold">
                                                {t.type === "deposit" || t.type === "win" ? "+" : "-"}
                                                {t.amount} ETB
                                            </p>
                                            {getStatusBadge(t.status)}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </TabsContent>

                    {/* Withdrawals */}
                    <TabsContent value="withdrawals" className="space-y-3 mt-4">
                        {withdrawRequests.map((w) => (
                            <Card key={w.id}>
                                <CardContent className="p-3 flex justify-between">
                                    <div className="flex gap-3">
                                        {getStatusIcon(w.status)}
                                        <div>
                                            <p className="font-medium">Request #{w.id}</p>
                                            <p className="text-xs text-muted-foreground">
                                                {w.method}
                                            </p>
                                        </div>
                                    </div>

                                    <div className="text-right">
                                        <p className="font-bold text-red-500">
                                            -{w.amount} ETB
                                        </p>
                                        {getStatusBadge(w.status)}
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </TabsContent>

                </Tabs>
            </div>
        </div>
    );
}