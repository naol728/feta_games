/* eslint-disable */
import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
    Copy,
    Share2,
    Users,
    Link,
    Gift,
    CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import { useAppSelector } from "@/store/hook";
import { useQuery } from "@tanstack/react-query";
import { getInviteData } from "@/api/invite";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Coupon from "@/components/Coupon";

interface InviteStats {
    totalInvites: number;
    activeInvites: number;
    totalEarned: number;
    pendingRewards: number;
}

export default function Invite() {
    const user = useAppSelector((state) => state.auth.user);
    const { data: invitedata, isLoading: getInviteDataloading, error } = useQuery({
        queryFn: getInviteData,
        queryKey: ["getInviteData"],
    });

    const inviteStats = invitedata?.data;
    const invitedUsers = inviteStats?.invited_users || [];
    const totalInvites = inviteStats?.invite_count || 0;

    const [copied, setCopied] = useState(false);

    // Goal: 40 invites to earn 50 ETB
    const GOAL = 40;
    const progress = Math.min((totalInvites / GOAL) * 100, 100);
    const remaining = Math.max(GOAL - totalInvites, 0);

    const inviteLink = useMemo(() => {
        if (!user?.referral_id) return "";
        return `https://t.me/fetasgamebot?start=ref_${user.referral_id}`;
    }, [user?.referral_id]);

    const handleCopyLink = async () => {
        try {
            if (!inviteLink) {
                toast.error("Invite link not ready");
                return;
            }
            await navigator.clipboard.writeText(inviteLink);
            setCopied(true);
            toast.success("Invite link copied");
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            toast.error("Failed to copy");
        }
    };

    const handleShare = async () => {
        if (!inviteLink) return;
        if (navigator.share) {
            try {
                await navigator.share({
                    title: "Join me!",
                    text: "Use my referral link",
                    url: inviteLink,
                });
            } catch (err) {
                console.log(err);
            }
        } else {
            handleCopyLink();
        }
    };

    const handleInviteViaTelegram = () => {
        if (!inviteLink) return;
        const text = `Play a game with me in here ! ${inviteLink}`;
        const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(
            inviteLink
        )}&text=${encodeURIComponent(text)}`;
        window.open(telegramUrl, "_blank");
    };

    if (!user) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin h-8 w-8 border-b-2 border-primary rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background px-2.5 pb-24 pt-2">
            <div className="max-w-sm mx-auto space-y-3">
                {/* Coupon */}
                <Coupon />

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-base font-bold">Invite Friends</h1>
                        <p className="text-[10px] text-muted-foreground">
                            Earn 50 ETB by inviting 40 friends
                        </p>
                    </div>
                    <Badge className="bg-primary/10 text-primary text-[10px]">
                        <Gift className="w-3 h-3 mr-1" />
                        50 ETB
                    </Badge>
                </div>

                {/* Stats + Progress */}
                <Card className="rounded-2xl border-border/60 shadow-sm">
                    <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                <span className="text-xs font-medium">Total Invites</span>
                            </div>
                            <p className="text-xl font-bold">{totalInvites}</p>
                        </div>
                        <div className="space-y-0.5">
                            <div className="flex justify-between text-[10px] text-muted-foreground">
                                <span>Progress to reward</span>
                                <span>{totalInvites} / {GOAL}</span>
                            </div>
                            <Progress value={progress} className="h-1.5" />
                            {remaining > 0 ? (
                                <p className="text-[9px] text-muted-foreground">
                                    {remaining} more invite{remaining > 1 ? "s" : ""} needed
                                </p>
                            ) : (
                                <p className="text-[9px] text-green-500 font-medium">
                                    🎉 Reward unlocked! Claim 50 ETB.
                                </p>
                            )}
                        </div>
                    </CardContent>
                </Card>

                {/* Invite Link */}
                <Card className="rounded-2xl border-border/60 shadow-sm">
                    <CardHeader className="pb-1 pt-2.5 px-3">
                        <CardTitle className="flex items-center gap-2 text-sm">
                            <Link className="w-4 h-4" />
                            Your Invite Link
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="p-3 space-y-2.5">
                        <div className="flex items-center gap-1.5 p-1.5 border rounded-xl bg-muted/20">
                            <input
                                value={inviteLink}
                                readOnly
                                className="flex-1 bg-transparent outline-none text-[10px] px-1.5 py-1 truncate"
                            />
                            <Button
                                onClick={handleCopyLink}
                                size="sm"
                                className="h-7 px-2.5 text-[10px] rounded-lg"
                            >
                                {copied ? (
                                    <>
                                        <CheckCircle className="w-3 h-3 mr-1" />
                                        Copied
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-3 h-3 mr-1" />
                                        Copy
                                    </>
                                )}
                            </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-1.5">
                            <Button
                                onClick={handleShare}
                                variant="outline"
                                size="sm"
                                className="h-8 text-[10px] rounded-xl"
                            >
                                <Share2 className="w-3 h-3 mr-1" />
                                Share
                            </Button>
                            <Button
                                onClick={handleInviteViaTelegram}
                                size="sm"
                                className="h-8 text-[10px] rounded-xl"
                            >
                                Telegram
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Invited Users */}
                <Card className="rounded-2xl border-border/60 shadow-sm">
                    <CardHeader className="pb-1 pt-2.5 px-3">
                        <CardTitle className="text-sm">People You Invited</CardTitle>
                    </CardHeader>
                    <CardContent className="px-3 pb-3 space-y-1.5">
                        {invitedUsers.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground py-1">
                                No invites yet – share your link!
                            </p>
                        ) : (
                            invitedUsers.map((u: any) => (
                                <div
                                    key={u.id}
                                    className="flex items-center justify-between p-2 rounded-xl border border-border/40"
                                >
                                    <div className="flex items-center gap-2">
                                        <Avatar className="h-7 w-7">
                                            <AvatarFallback className="text-[10px]">
                                                {u?.Fname?.charAt(0)?.toUpperCase() || "U"}
                                            </AvatarFallback>
                                        </Avatar>
                                        <div>
                                            <p className="text-xs font-medium">
                                                {u?.Fname || "Unknown"}
                                            </p>
                                            <p className="text-[9px] text-muted-foreground">Joined</p>
                                        </div>
                                    </div>
                                </div>
                            ))
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}