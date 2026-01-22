/*eslint-disable*/
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
    User,
    Globe,
    CreditCard,
    History
} from "lucide-react";

interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
}

interface Transaction {
    id: number;
    type: 'deposit' | 'withdrawal' | 'bet' | 'win';
    amount: number;
    status: 'completed' | 'pending' | 'failed';
    date: string;
    description: string;
}

interface WithdrawRequest {
    id: number;
    amount: number;
    status: 'pending' | 'approved';
    requestedAt: string;
    processedAt?: string;
    method: string;
}

export default function Profile() {
    const [user, setUser] = useState<TelegramUser | null>(null);
    const [balance, setBalance] = useState<number>(0);
    const [transactions, setTransactions] = useState<Transaction[]>([
        { id: 1, type: 'deposit', amount: 500, status: 'completed', date: '2024-03-15', description: ' Deposit' },
        { id: 2, type: 'bet', amount: 100, status: 'completed', date: '2024-03-14', description: ' Bet' },
        { id: 3, type: 'win', amount: 250, status: 'completed', date: '2024-03-14', description: 'Bet Win' },
        { id: 4, type: 'withdrawal', amount: 200, status: 'pending', date: '2024-03-13', description: 'Bank Transfer' },
        { id: 5, type: 'deposit', amount: 300, status: 'completed', date: '2024-03-12', description: 'Telebirr Deposit' },
    ]);

    const [withdrawRequests, setWithdrawRequests] = useState<WithdrawRequest[]>([
        { id: 1, amount: 200, status: 'pending', requestedAt: '2024-03-13', method: 'Bank Transfer' },
        { id: 2, amount: 150, status: 'approved', requestedAt: '2024-03-10', processedAt: '2024-03-11', method: 'Telebirr' },
    ]);

    const fetchBalance = async () => {
        setBalance(1250); // mock balance
    };

    useEffect(() => {
        const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;

        if (tgUser) {
            setUser(tgUser);
        } else {
            setUser({
                id: 123456789,
                first_name: "Naol",
                last_name: "Demo",
                username: "naol_dev",
                language_code: "en",
            });
        }

        fetchBalance();
    }, []);

    const handleDeposit = () => {
        alert("Deposit clicked!");
    };

    const handleWithdraw = () => {
        alert("Withdraw clicked!");
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed':
            case 'approved':
                return <CheckCircle className="h-4 w-4 text-green-500" />;
            case 'pending':
                return <Clock className="h-4 w-4 text-amber-500" />;
            case 'failed':
            case 'rejected':
                return <XCircle className="h-4 w-4 text-destructive" />;
            default:
                return null;
        }
    };

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'completed':
            case 'approved':
                return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Completed</Badge>;
            case 'pending':
                return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Pending</Badge>;
            case 'failed':
            case 'rejected':
                return <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/20">{status.charAt(0).toUpperCase() + status.slice(1)}</Badge>;
            default:
                return null;
        }
    };

    const getTransactionIcon = (type: string) => {
        switch (type) {
            case 'deposit':
                return <ArrowDownCircle className="h-5 w-5 text-green-500" />;
            case 'withdrawal':
                return <ArrowUpCircle className="h-5 w-5 text-destructive" />;
            case 'bet':
                return <DollarSign className="h-5 w-5 text-blue-500" />;
            case 'win':
                return <TrendingUp className="h-5 w-5 text-purple-500" />;
            default:
                return <Wallet className="h-5 w-5 text-muted-foreground" />;
        }
    };

    if (!user) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-background p-4 pb-16">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Profile Header */}
                <div className="flex items-center justify-between">
                    <h1 className="text-lg font-bold text-foreground">My Profile</h1>
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                        Active
                    </Badge>
                </div>

                {/* Profile Card - Mobile First Design */}
                <Card className="border">
                    <CardContent className="p-4">
                        <div className="flex flex-col items-center text-center space-y-4 mb-6">
                            <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
                                <AvatarFallback className="bg-primary text-primary-foreground text-lg">
                                    {user.first_name.charAt(0)}{user.last_name?.charAt(0) || ''}
                                </AvatarFallback>
                            </Avatar>
                            <div>
                                <h2 className="text-lg font-semibold text-foreground">
                                    {user.first_name} {user.last_name || ''}
                                </h2>
                                <p className="text-muted-foreground">@{user.username || 'no_username'}</p>
                            </div>
                        </div>

                        {/* Quick Stats */}
                        <div className=" w-full mb-2">
                            <div className="bg-card border rounded-lg p-2">
                                <div className="flex items-center gap-2 mb-1">
                                    <Wallet className="h-4 w-4 text-primary" />
                                    <span className="text-sm text-muted-foreground">Balance</span>
                                </div>
                                <p className="text-lg font-bold text-foreground">{balance.toLocaleString()} ETB</p>
                            </div>
                        </div>

                        {/* Language Info */}
                        <div className="bg-card border rounded-lg p-3 mb-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Globe className="h-4 w-4 text-primary" />
                                <span className="text-xs text-muted-foreground">Language</span>
                            </div>
                            <p className="text- font-medium text-foreground">{user.language_code?.toUpperCase() || "EN"}</p>
                        </div>

                        {/* Action Buttons */}
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                onClick={handleDeposit}
                                className="bg-primary hover:bg-primary/90 h-10"
                            >
                                <ArrowDownCircle className="mr-2 h-4 w-4" />
                                Deposit
                            </Button>
                            <Button
                                onClick={handleWithdraw}
                                variant="destructive"
                                className="h-10"
                            >
                                <ArrowUpCircle className="mr-2 h-4 w-4" />
                                Withdraw
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Tabs Section - Mobile Optimized */}
                <Tabs defaultValue="transactions" className="w-full">
                    <TabsList className="grid w-full grid-cols-2 mb-4">
                        <TabsTrigger value="transactions" >
                            <History className="mr-2 h-4 w-4" />
                            Transactions
                        </TabsTrigger>
                        <TabsTrigger value="withdrawals" >
                            <CreditCard className="mr-2 h-4 w-4" />
                            Withdrawals
                        </TabsTrigger>
                    </TabsList>

                    {/* Transactions Tab */}
                    <TabsContent value="transactions" className="space-y-4">
                        <div className="space-y-3">
                            {transactions.map((transaction) => (
                                <Card key={transaction.id} className="border">
                                    <CardContent className="p-3">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-3">
                                                <div className="mt-1 p-2 bg-muted rounded-lg">
                                                    {getTransactionIcon(transaction.type)}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="font-medium text-foreground capitalize">
                                                            {transaction.type}
                                                        </p>
                                                        {getStatusBadge(transaction.status)}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">{transaction.description}</p>
                                                    <p className="text-xs text-muted-foreground">{transaction.date}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className={`font-bold ${transaction.type === 'deposit' || transaction.type === 'win'
                                                    ? 'text-green-600 dark:text-green-400'
                                                    : 'text-destructive'
                                                    }`}>
                                                    {transaction.type === 'deposit' || transaction.type === 'win' ? '+' : '-'}
                                                    {transaction.amount.toLocaleString()} ETB
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>

                    {/* Withdraw Requests Tab */}
                    <TabsContent value="withdrawals" className="space-y-4">
                        <div className="space-y-3">
                            {withdrawRequests.map((request) => (
                                <Card key={request.id} className="border">
                                    <CardContent className="p-2">
                                        <div className="flex items-start justify-between">
                                            <div className="flex items-start gap-3">
                                                <div className={`mt-1 p-2 rounded-lg ${request.status === 'approved' ? 'bg-green-50 dark:bg-green-950' :
                                                    'bg-amber-50 dark:bg-amber-950'
                                                    }`}>
                                                    {getStatusIcon(request.status)}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <p className="font-medium text-foreground">
                                                            Request #{request.id}
                                                        </p>
                                                        {getStatusBadge(request.status)}
                                                    </div>
                                                    <p className="text-sm text-muted-foreground">{request.method}</p>
                                                    <p className="text-xs text-muted-foreground">
                                                        {request.requestedAt}
                                                    </p>
                                                    {request.processedAt && (
                                                        <p className="text-xs text-muted-foreground">
                                                            Processed: {request.processedAt}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-destructive">
                                                    -{request.amount.toLocaleString()} ETB
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </TabsContent>
                </Tabs>
            </div>
        </div >
    );
}