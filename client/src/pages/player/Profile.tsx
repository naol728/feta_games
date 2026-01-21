import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
}

export default function Profile() {
    const [user, setUser] = useState<TelegramUser | null>(null);
    const [balance, setBalance] = useState<number>(0);

    useEffect(() => {
        // Fetch Telegram user info (dev mock fallback)
        const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;

        if (tgUser) {
            setUser(tgUser);
        } else {
            // DEV MOCK
            setUser({
                id: 123456789,
                first_name: "Naol",
                username: "naol_dev",
                language_code: "en",
            });
        }

        // Fetch user balance from your backend
        fetchBalance();
    }, []);

    const fetchBalance = async () => {
        // TODO: replace with your API call
        // Example: const res = await fetch("/api/balance");
        // const data = await res.json();
        setBalance(150); // mock balance
    };

    const handleDeposit = () => {
        // TODO: open deposit flow (Telebirr, etc)
        alert("Deposit clicked!");
    };

    const handleWithdraw = () => {
        // TODO: open withdraw flow
        alert("Withdraw clicked!");
    };

    if (!user) return <p>Loading...</p>;

    return (
        <div className="p-4 flex flex-col items-center gap-6">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Profile</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-2">
                    <p>
                        <strong>User ID:</strong> {user.id}
                    </p>
                    <p>
                        <strong>Name:</strong> {user.first_name} {user.last_name || ""}
                    </p>
                    <p>
                        <strong>Username:</strong> @{user.username || "N/A"}
                    </p>
                    <p>
                        <strong>Language:</strong> {user.language_code || "N/A"}
                    </p>
                    <p>
                        <strong>Balance:</strong> {balance} ETB
                    </p>
                </CardContent>
            </Card>

            <div className="flex gap-4">
                <Button onClick={handleDeposit} className="bg-green-500 hover:bg-green-600">
                    Deposit
                </Button>
                <Button onClick={handleWithdraw} className="bg-red-500 hover:bg-red-600">
                    Withdraw
                </Button>
            </div>
        </div>
    );
}
