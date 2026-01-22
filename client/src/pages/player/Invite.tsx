/*eslint-disable*/
import React, { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from "@/components/ui/badge";
import {
    Copy,
    Share2,
    Users,
    Link,
    Gift,
    Coins,
    CheckCircle,
    AlertCircle
} from "lucide-react";
import { toast } from "sonner"
interface TelegramUser {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
}

interface InviteStats {
    totalInvites: number;
    activeInvites: number;
    totalEarned: number;
    pendingRewards: number;
}

export default function Invite() {
    const [user, setUser] = useState<TelegramUser | null>(null);
    const [inviteLink, setInviteLink] = useState<string>("");
    const [stats, setStats] = useState<InviteStats>({
        totalInvites: 0,
        activeInvites: 0,
        totalEarned: 0,
        pendingRewards: 0
    });
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        // Fetch Telegram user info
        const tgUser = (window as any).Telegram?.WebApp?.initDataUnsafe?.user;

        if (tgUser) {
            setUser(tgUser);
        } else {
            // DEV MOCK
            setUser({
                id: 123456789,
                first_name: "Naol",
                last_name: "Demo",
                username: "naol_dev",
                language_code: "en",
            });
        }

        // Generate invite link
        const baseUrl = window.location.origin;
        const userId = tgUser?.id || "123456789";
        const link = `${baseUrl}?ref=${userId}`;
        setInviteLink(link);

        // Mock stats
        setStats({
            totalInvites: 0,
            activeInvites: 0,
            totalEarned: 0,
            pendingRewards: 0
        });
    }, []);

    const handleCopyLink = async () => {
        try {
            await navigator.clipboard.writeText(inviteLink);
            setCopied(true);

            toast.success("Invite link copied to clipboard");

            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error("Failed to copy");
        }
    };

    const handleShare = async () => {
        if (navigator.share) {
            try {
                await navigator.share({
                    title: 'Join me on this amazing platform!',
                    text: 'Use my referral link to get started',
                    url: inviteLink,
                });
            } catch (err) {
                console.log('Error sharing:', err);
            }
        } else {
            handleCopyLink();
        }
    };

    const handleInviteViaTelegram = () => {
        const text = `Join me on this amazing platform! Use my referral link: ${inviteLink}`;
        const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent(text)}`;
        window.open(telegramUrl, '_blank');
    };

    if (!user) return (
        <div className="flex items-center justify-center min-h-screen">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
    );

    return (
        <div className="min-h-screen bg-background p-4 pb-20">
            <div className="max-w-2xl mx-auto space-y-6">
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold text-foreground">Invite Friends</h1>
                        <p className="text-muted-foreground text-sm">Earn rewards for every friend you invite</p>
                    </div>
                    <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                        <Gift className="mr-1 h-2 w-2" />
                        Rewards
                    </Badge>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-3">
                    <Card className="border bg-card">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Users className="h-4 w-4 text-primary" />
                                <span className="text-sm text-muted-foreground">Total Invites</span>
                            </div>
                            <p className="text-2xl font-bold text-foreground">{stats.totalInvites}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {stats.activeInvites} active
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="border bg-card">
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 mb-1">
                                <Coins className="h-4 w-4 text-amber-500" />
                                <span className="text-sm text-muted-foreground">Total Earned</span>
                            </div>
                            <p className="text-2xl font-bold text-foreground">{stats.totalEarned} ETB</p>
                            <p className="text-xs text-muted-foreground mt-1">
                                {stats.pendingRewards} pending
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Your Invite Link Card */}
                <Card className="border">
                    <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Link className="h-5 w-5 text-primary" />
                            Your Invite Link
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Link Display */}
                        <div className="relative">
                            <div className="flex items-center bg-muted border rounded-lg pl-3 pr-1 py-1">
                                <Link className="h-4 w-4 text-muted-foreground mr-2 flex-shrink-0" />
                                <input
                                    type="text"
                                    readOnly
                                    value={inviteLink}
                                    className="w-full bg-transparent border-none outline-none text-sm text-foreground truncate pr-2"
                                />
                                <Button
                                    size="sm"
                                    variant={copied ? "default" : "outline"}
                                    onClick={handleCopyLink}
                                    className="flex-shrink-0"
                                >
                                    {copied ? (
                                        <>
                                            <CheckCircle className="mr-1 h-3 w-3" />
                                            Copied
                                        </>
                                    ) : (
                                        <>
                                            <Copy className="mr-1 h-3 w-3" />
                                            Copy
                                        </>
                                    )}
                                </Button>
                            </div>
                        </div>

                        {/* Share Buttons */}
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                onClick={handleShare}
                                variant="outline"
                                className="h-10"
                            >
                                <Share2 className="mr-2 h-4 w-4" />
                                Share Link
                            </Button>
                            <Button
                                onClick={handleInviteViaTelegram}
                                className="h-10  bg-[#0088cc] hover:bg-[#0088cc]/90"
                            >

                                Share on Telegram
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* How It Works */}
                <Card className="border">
                    <CardHeader>
                        <CardTitle className="text-lg">How It Works</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-xs font-semibold text-primary">1</span>
                            </div>
                            <div>
                                <h3 className="font-medium text-foreground">Share Your Link</h3>
                                <p className="text-sm text-muted-foreground">
                                    Share your unique invite link with friends and family
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-xs font-semibold text-primary">2</span>
                            </div>
                            <div>
                                <h3 className="font-medium text-foreground">They Sign Up</h3>
                                <p className="text-sm text-muted-foreground">
                                    Your friends sign up using your link and make their first deposit
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
                                <span className="text-xs font-semibold text-primary">3</span>
                            </div>
                            <div>
                                <h3 className="font-medium text-foreground">Earn Rewards</h3>
                                <p className="text-sm text-muted-foreground">
                                    Earn commission from their activity. The more friends you invite, the more you earn!
                                </p>
                            </div>
                        </div>
                    </CardContent>
                </Card>


                {/* FAQ */}
                <Card className="border">
                    <CardHeader>
                        <CardTitle className="text-lg">FAQ</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div>
                            <h3 className="font-medium text-foreground mb-1">When do I receive my rewards?</h3>
                            <p className="text-sm text-muted-foreground">
                                Rewards are credited instantly when your friend completes their first deposit.
                            </p>
                        </div>
                        <div>
                            <h3 className="font-medium text-foreground mb-1">Is there a limit to how many friends I can invite?</h3>
                            <p className="text-sm text-muted-foreground">
                                No limits! Invite as many friends as you want and earn unlimited rewards.
                            </p>
                        </div>
                        <div>
                            <h3 className="font-medium text-foreground mb-1">Can I withdraw my referral rewards?</h3>
                            <p className="text-sm text-muted-foreground">
                                Yes, referral rewards can be withdrawn just like your regular balance.
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}