/*eslint-disable*/
import React, { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
        queryKey: ["getInviteData"]
    })
    const inviteStats = invitedata?.data;
    const invitedUsers = inviteStats?.invited_users || [];
    const totalInvites = inviteStats?.invite_count || 0;
    const [stats] = useState<InviteStats>({
        totalInvites: 0,
        activeInvites: 0,
        totalEarned: 0,
        pendingRewards: 0,
    });

    const [copied, setCopied] = useState(false);

    // ✅ BUILD INVITE LINK FROM referral_id
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
                <div className="animate-spin h-10 w-10 border-b-2 border-primary rounded-full" />
            </div>
        );
    }

    return (
        <div className="min-h-screen p-4 pb-20">
            <div className="max-w-2xl mx-auto space-y-6">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-xl font-bold">Invite Friends</h1>
                        <p className="text-sm text-muted-foreground">
                            Earn 50 ETB by inviting 40 friends
                        </p>
                    </div>

                    <Badge className="bg-primary/10 text-primary">
                        <Gift className="w-3 h-3 mr-1" />
                        50 ETB
                    </Badge>
                </div>

                {/* Stats */}
                <Card>
                    <CardContent className="p-4 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <Users className="w-4 h-4" />
                            <span>Total Invites</span>
                        </div>

                        <p className="text-2xl font-bold">{totalInvites}</p>
                    </CardContent>
                </Card>

                {/* Invite Link */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Link className="w-4 h-4" />
                            Your Invite Link
                        </CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-4">

                        <div className="flex items-center gap-2 p-2 border rounded">
                            <input
                                value={inviteLink}
                                readOnly
                                className="flex-1 bg-transparent outline-none text-sm"
                            />

                            <Button onClick={handleCopyLink} size="sm">
                                {copied ? (
                                    <>
                                        <CheckCircle className="w-4 h-4 mr-1" />
                                        Copied
                                    </>
                                ) : (
                                    <>
                                        <Copy className="w-4 h-4 mr-1" />
                                        Copy
                                    </>
                                )}
                            </Button>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Button onClick={handleShare} variant="outline">
                                <Share2 className="w-4 h-4 mr-1" />
                                Share
                            </Button>

                            <Button onClick={handleInviteViaTelegram}>
                                Telegram
                            </Button>
                        </div>

                    </CardContent>
                </Card>


                <Card>
                    <CardHeader>
                        <CardTitle>People You Invited</CardTitle>
                    </CardHeader>

                    <CardContent className="space-y-3">
                        {invitedUsers.length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                                No invites yet
                            </p>
                        ) : (
                            invitedUsers.map((u: any) => (
                                <div
                                    key={u.id}
                                    className="flex items-center justify-between p-2 rounded-lg border"
                                >
                                    <div className="flex items-center gap-3">

                                        {/* Avatar */}
                                        <Avatar className="h-9 w-9">
                                            <AvatarFallback>
                                                {u?.Fname?.charAt(0)?.toUpperCase() || "U"}
                                            </AvatarFallback>
                                        </Avatar>

                                        {/* Name */}
                                        <div>
                                            <p className="font-medium">
                                                {u?.Fname || "Unknown"}
                                            </p>

                                            <p className="text-xs text-muted-foreground">
                                                Joined user
                                            </p>
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