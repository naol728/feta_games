
import React, { useCallback, useEffect, useMemo, useState } from "react";

import { useNavigate } from "react-router-dom";

import {
    Flame,
    Gamepad2,
    WalletCards,
    Clock3,
    Coins,
    BarChart3,
    ArrowRight,
    UserRound,
    Gift,
    Users,
    Copy,
    Share2,
    X,
    Check,
    CircleCheck,
    ChevronRight,
} from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";

import { Button } from "@/components/ui/button";

import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";

import { useAppSelector } from "@/store/hook";

import { useQuery } from "@tanstack/react-query";

import { getInviteData } from "@/api/invite";

interface Transaction {
    id: string;
    type: string;
    amount: number | string;
    status: string;
    date: string;
}

interface DailyStreakProps {
    mappedTransactions?: Transaction[];
}

type StreakType = "gameplay" | "deposit";

interface StreakDay {
    date: Date;
    dateKey: string;
    day: string;
    month: string;
    hasActivity: boolean;
    isToday: boolean;
    isFuture: boolean;
}

interface InvitedUser {
    id?: string;
    username?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    created_at?: string;
}

const getDateKey = (date: Date) => {
    const year = date.getFullYear();

    const month = String(date.getMonth() + 1).padStart(2, "0");

    const day = String(date.getDate()).padStart(2, "0");

    return `${year}-${month}-${day}`;
};

const DailyStreak = ({
    mappedTransactions = [],
}: DailyStreakProps) => {
    const navigate = useNavigate();

    const user = useAppSelector(
        (state) => state.auth.user,
    );

    const [streakType, setStreakType] =
        useState<StreakType>("gameplay");

    const [affiliateOpen, setAffiliateOpen] =
        useState(false);

    const [copied, setCopied] =
        useState(false);

    const [countdown, setCountdown] = useState({
        hours: 0,
        minutes: 0,
        seconds: 0,
    });

    // =====================================================
    // INVITE DATA
    // =====================================================

    const {
        data: invitedata,
        isLoading: getInviteDataloading,
        error,
    } = useQuery({
        queryFn: getInviteData,
        queryKey: ["getInviteData"],
    });

    const inviteStats = invitedata?.data;

    const invitedUsers: InvitedUser[] =
        inviteStats?.invited_users || [];

    const totalInvites =
        inviteStats?.invite_count || 0;

    const totalEarnings =
        inviteStats?.total_earnings || 0;

    // =====================================================
    // REFERRAL LINK
    // =====================================================

    const referralLink = user?.referral_id
        ? `https://t.me/fetasgamebot?start=ref_${user.referral_id}`
        : "Referral link unavailable";

    // =====================================================
    // CHECK WHETHER USER HAS ACTIVITY
    // =====================================================

    const hasActivityOnDate = useCallback(
        (
            dateKey: string,
            type: StreakType,
        ) => {
            return mappedTransactions.some(
                (transaction) => {
                    if (!transaction.date) {
                        return false;
                    }

                    const transactionDate =
                        new Date(transaction.date);

                    if (
                        Number.isNaN(
                            transactionDate.getTime(),
                        )
                    ) {
                        return false;
                    }

                    const transactionDateKey =
                        getDateKey(transactionDate);

                    if (
                        transactionDateKey !== dateKey
                    ) {
                        return false;
                    }

                    // -----------------------------
                    // GAMEPLAY
                    // -----------------------------

                    if (type === "gameplay") {
                        return (
                            transaction.type === "win" ||
                            transaction.type === "lose"
                        );
                    }

                    // -----------------------------
                    // DEPOSIT
                    // -----------------------------

                    if (type === "deposit") {
                        return (
                            transaction.type === "deposit" &&
                            transaction.status?.toLowerCase() !==
                            "failed"
                        );
                    }

                    return false;
                },
            );
        },
        [mappedTransactions],
    );

    // =====================================================
    // STREAK DAYS
    // 3 PREVIOUS + TODAY + 3 FUTURE
    // =====================================================

    const streakDays = useMemo<StreakDay[]>(
        () => {
            const today = new Date();

            return Array.from(
                { length: 7 },
                (_, index) => {
                    const offset = index - 3;

                    const date = new Date(today);

                    date.setHours(0, 0, 0, 0);

                    date.setDate(
                        today.getDate() + offset,
                    );

                    const dateKey =
                        getDateKey(date);

                    return {
                        date,
                        dateKey,
                        day: date
                            .getDate()
                            .toString(),
                        month:
                            date.toLocaleDateString(
                                "en-US",
                                {
                                    month: "short",
                                },
                            ),
                        hasActivity:
                            hasActivityOnDate(
                                dateKey,
                                streakType,
                            ),
                        isToday: offset === 0,
                        isFuture: offset > 0,
                    };
                },
            );
        },
        [hasActivityOnDate, streakType],
    );

    // =====================================================
    // COMPLETED DAYS
    // =====================================================

    const completedDays = useMemo(() => {
        return streakDays.filter(
            (day) => day.hasActivity,
        ).length;
    }, [streakDays]);

    // =====================================================
    // CURRENT STREAK
    // Counts backwards from today
    // =====================================================

    const currentStreak = useMemo(() => {
        let streak = 0;

        const today = new Date();

        today.setHours(0, 0, 0, 0);

        for (let i = 0; i < 365; i++) {
            const date = new Date(today);

            date.setDate(
                today.getDate() - i,
            );

            const dateKey =
                getDateKey(date);

            if (
                hasActivityOnDate(
                    dateKey,
                    streakType,
                )
            ) {
                streak++;
            } else {
                break;
            }
        }

        return streak;
    }, [
        hasActivityOnDate,
        streakType,
    ]);

    // =====================================================
    // CASHBACK COUNTDOWN
    // Counts down to next midnight
    // =====================================================

    useEffect(() => {
        const updateCountdown = () => {
            const now = new Date();

            const tomorrow = new Date(now);

            tomorrow.setHours(
                24,
                0,
                0,
                0,
            );

            const difference =
                tomorrow.getTime() -
                now.getTime();

            const totalSeconds = Math.max(
                Math.floor(
                    difference / 1000,
                ),
                0,
            );

            const hours = Math.floor(
                totalSeconds / 3600,
            );

            const minutes = Math.floor(
                (totalSeconds % 3600) / 60,
            );

            const seconds =
                totalSeconds % 60;

            setCountdown({
                hours,
                minutes,
                seconds,
            });
        };

        updateCountdown();

        const interval = setInterval(
            updateCountdown,
            1000,
        );

        return () =>
            clearInterval(interval);
    }, []);

    // =====================================================
    // FORMAT COUNTDOWN
    // =====================================================

    const formatNumber = (
        value: number,
    ) =>
        String(value).padStart(
            2,
            "0",
        );

    // =====================================================
    // COPY REFERRAL
    // =====================================================

    const copyReferral = async () => {
        if (!user?.referral_id) {
            return;
        }

        try {
            await navigator.clipboard.writeText(
                referralLink,
            );

            setCopied(true);

            setTimeout(() => {
                setCopied(false);
            }, 2000);
        } catch (error) {
            console.error(
                "Failed to copy referral link:",
                error,
            );
        }
    };

    // =====================================================
    // SHARE REFERRAL
    // =====================================================

    const shareReferral = () => {
        if (!user?.referral_id) {
            return;
        }

        const text = encodeURIComponent(
            "Get 50 ETB by inviting friends to Gebeta Games!",
        );

        const url =
            encodeURIComponent(
                referralLink,
            );

        const telegramShareUrl =
            `https://t.me/share/url?url=${url}&text=${text}`;

        window.open(
            telegramShareUrl,
            "_blank",
        );
    };

    // =====================================================
    // RENDER
    // =====================================================

    return (
        <>
            <section className="w-full overflow-hidden pb-[env(safe-area-inset-bottom)]">

                {/* =================================================
                    DAILY STREAK
                ================================================= */}

                <div className="rounded-2xl border border-border/60 bg-card px-3 py-3 text-card-foreground shadow-sm">

                    {/* HEADER */}

                    <div className="mb-3 flex items-center justify-between">

                        <div className="flex min-w-0 items-center gap-2">

                            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                                <Flame
                                    className="h-5 w-5 fill-primary text-primary"
                                    strokeWidth={2.5}
                                />
                            </div>

                            <div className="min-w-0">
                                <h2 className="text-[17px] font-bold leading-tight">
                                    Daily Streak
                                </h2>

                                <p className="text-[10px] text-muted-foreground">
                                    Keep your streak alive
                                </p>
                            </div>

                        </div>

                        {/* STREAK STATS */}

                        <div className="flex h-8 shrink-0 items-center gap-1.5 rounded-xl border border-primary/20 bg-primary/5 px-2.5">

                            <Flame className="h-3.5 w-3.5 text-primary" />

                            <span className="text-xs font-bold text-primary">
                                {currentStreak}
                            </span>

                            <div className="h-4 w-px bg-border" />

                            <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />

                            <span className="text-xs font-semibold text-muted-foreground">
                                {completedDays}/7
                            </span>

                        </div>

                    </div>

                    {/* GAMEPLAY / DEPOSIT TABS */}

                    <Tabs
                        value={streakType}
                        onValueChange={(value) =>
                            setStreakType(
                                value as StreakType,
                            )
                        }
                        className="mb-3"
                    >
                        <TabsList className="grid h-9 w-full grid-cols-2 rounded-xl bg-muted/80 p-1">

                            <TabsTrigger
                                value="gameplay"
                                className="
                                    h-7
                                    rounded-lg
                                    gap-1.5
                                    px-2
                                    text-[11px]
                                    font-semibold
                                    data-[state=active]:bg-background
                                    data-[state=active]:text-primary
                                    data-[state=active]:shadow-sm
                                "
                            >
                                <Gamepad2 className="h-3.5 w-3.5" />
                                Gameplay
                            </TabsTrigger>

                            <TabsTrigger
                                value="deposit"
                                className="
                                    h-7
                                    rounded-lg
                                    gap-1.5
                                    px-2
                                    text-[11px]
                                    font-semibold
                                    data-[state=active]:bg-background
                                    data-[state=active]:text-primary
                                    data-[state=active]:shadow-sm
                                "
                            >
                                <WalletCards className="h-3.5 w-3.5" />
                                Deposit
                            </TabsTrigger>

                        </TabsList>
                    </Tabs>

                    {/* STREAK DESCRIPTION */}

                    <div className="mb-2 flex items-center justify-between">

                        <div className="flex items-center gap-1.5">

                            {streakType === "gameplay" ? (
                                <Gamepad2 className="h-3.5 w-3.5 text-primary" />
                            ) : (
                                <WalletCards className="h-3.5 w-3.5 text-primary" />
                            )}

                            <span className="text-[11px] font-medium text-muted-foreground">
                                {streakType ===
                                    "gameplay"
                                    ? "Play at least once every day"
                                    : "Make a deposit every day"}
                            </span>

                        </div>

                        <span className="text-[10px] font-medium text-muted-foreground">
                            {completedDays}/7
                        </span>

                    </div>

                    {/* STREAK CALENDAR */}

                    <div className="grid grid-cols-7 gap-1.5">

                        {streakDays.map((item) => {
                            const completed =
                                item.hasActivity;

                            const today =
                                item.isToday;

                            const future =
                                item.isFuture;

                            return (
                                <div
                                    key={item.dateKey}
                                    className={`
                                        relative
                                        flex
                                        h-[72px]
                                        min-w-0
                                        flex-col
                                        items-center
                                        justify-center
                                        overflow-hidden
                                        rounded-xl
                                        border
                                        transition-all

                                        ${completed
                                            ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                            : today
                                                ? "border-primary/50 bg-primary/10 text-primary"
                                                : future
                                                    ? "border-border/40 bg-muted/60 text-muted-foreground"
                                                    : "border-destructive/20 bg-destructive/10 text-destructive"
                                        }
                                    `}
                                >

                                    {/* STATUS ICON */}

                                    <div
                                        className={`
                                            absolute
                                            top-1.5
                                            flex
                                            h-4
                                            w-4
                                            items-center
                                            justify-center
                                            rounded-full

                                            ${completed
                                                ? "bg-primary-foreground/20"
                                                : today
                                                    ? "bg-primary/10"
                                                    : future
                                                        ? "bg-muted"
                                                        : "bg-destructive/10"
                                            }
                                        `}
                                    >
                                        {completed ? (
                                            <CircleCheck
                                                className="h-3 w-3"
                                                strokeWidth={3}
                                            />
                                        ) : today ? (
                                            <Clock3
                                                className="h-3 w-3"
                                                strokeWidth={2.5}
                                            />
                                        ) : future ? (
                                            <Clock3 className="h-3 w-3" />
                                        ) : (
                                            <X
                                                className="h-3 w-3"
                                                strokeWidth={3}
                                            />
                                        )}
                                    </div>

                                    {/* DAY */}

                                    <span className="mt-2 text-[17px] font-bold leading-none">
                                        {item.day}
                                    </span>

                                    {/* MONTH */}

                                    <span className="mt-1 text-[9px] font-medium uppercase">
                                        {item.month}
                                    </span>

                                    {/* TODAY */}

                                    {today && (
                                        <div
                                            className={`
                                                absolute
                                                bottom-0
                                                left-2
                                                right-2
                                                h-[2px]
                                                rounded-full

                                                ${completed
                                                    ? "bg-primary-foreground"
                                                    : "bg-primary"
                                                }
                                            `}
                                        />
                                    )}

                                </div>
                            );
                        })}

                    </div>

                    {/* SMALL LEGEND */}

                    <div className="mt-2.5 flex items-center justify-center gap-3">

                        <div className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-primary" />

                            <span className="text-[9px] text-muted-foreground">
                                Completed
                            </span>
                        </div>

                        <div className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-destructive" />

                            <span className="text-[9px] text-muted-foreground">
                                Missed
                            </span>
                        </div>

                        <div className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />

                            <span className="text-[9px] text-muted-foreground">
                                Upcoming
                            </span>
                        </div>

                    </div>

                </div>

                {/* =================================================
                    DAILY CASHBACK
                ================================================= */}

                <div className="relative mt-2.5 min-h-[155px] overflow-hidden rounded-2xl bg-linear-to-br from-primary via-primary to-primary/80 px-4 py-4 text-primary-foreground">

                    {/* DECORATIVE CIRCLE */}

                    <div className="pointer-events-none absolute -right-12 -top-8 h-44 w-44 rounded-full border-[6px] border-primary-foreground/20" />

                    <div className="pointer-events-none absolute -right-4 top-6 h-32 w-32 rounded-full border-2 border-primary-foreground/15" />

                    {/* CONTENT */}

                    <div className="relative z-10">

                        <div className="flex items-center gap-2">

                            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-foreground/10">

                                <Coins
                                    className="h-5 w-5"
                                    strokeWidth={2.5}
                                />

                            </div>

                            <div>

                                <h2 className="text-[20px] font-bold leading-tight">
                                    Daily Cashback
                                </h2>

                                <p className="text-[10px] text-primary-foreground/70">
                                    Next reward resets in
                                </p>

                            </div>

                        </div>

                        {/* COUNTDOWN */}

                        <div className="mt-4 flex items-center gap-1.5">

                            <CountdownBox
                                value={formatNumber(
                                    countdown.hours,
                                )}
                                label="HRS"
                            />

                            <CountdownSeparator />

                            <CountdownBox
                                value={formatNumber(
                                    countdown.minutes,
                                )}
                                label="MIN"
                            />

                            <CountdownSeparator />

                            <CountdownBox
                                value={formatNumber(
                                    countdown.seconds,
                                )}
                                label="SEC"
                            />

                        </div>

                    </div>

                    {/* CASHBACK BADGE */}

                    <div className="pointer-events-none absolute -right-3 top-[47px] z-20 -rotate-6">

                        <div className="relative flex h-[78px] w-[120px] items-center justify-center rounded-[20px] border-[5px] border-primary-foreground bg-primary/80 shadow-lg">

                            <div className="absolute inset-[5px] rounded-[13px] border border-primary-foreground/50" />

                            <div className="relative text-center text-[22px] font-black leading-[0.85] tracking-tight">
                                CASH
                                <br />
                                BACK
                            </div>

                        </div>

                    </div>

                </div>

                {/* =================================================
                    ACTIONS
                ================================================= */}

                <div className="mt-2.5 grid grid-cols-[1fr_82px] gap-2.5">

                    {/* LEFT ACTIONS */}

                    <div className="space-y-2.5">

                        {/* LEADERBOARD */}

                        <button
                            type="button"
                            onClick={() =>
                                navigate(
                                    "/leaderboard",
                                )
                            }
                            className="
                                group
                                relative
                                flex
                                h-[65px]
                                w-full
                                items-center
                                overflow-hidden
                                rounded-2xl
                                bg-primary
                                px-3.5
                                text-left
                                text-primary-foreground
                                shadow-sm
                                transition
                                active:scale-[0.98]
                            "
                        >

                            <div className="pointer-events-none absolute right-0 top-0 opacity-[0.08]">
                                <BarChart3 className="h-24 w-24" />
                            </div>

                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/10">

                                <BarChart3
                                    className="h-5 w-5"
                                    strokeWidth={2.5}
                                />

                            </div>

                            <div className="relative z-10 ml-3 min-w-0">

                                <p className="text-[15px] font-bold leading-tight">
                                    Leaderboard
                                </p>

                                <p className="mt-0.5 text-[9px] text-primary-foreground/70">
                                    See top players
                                </p>

                            </div>

                            <ArrowRight
                                className="relative z-10 ml-auto h-5 w-5 shrink-0 transition-transform group-active:translate-x-1"
                                strokeWidth={2.5}
                            />

                        </button>

                        {/* AFFILIATE */}

                        <button
                            type="button"
                            onClick={() =>
                                setAffiliateOpen(
                                    true,
                                )
                            }
                            className="
                                group
                                relative
                                flex
                                h-[65px]
                                w-full
                                items-center
                                overflow-hidden
                                rounded-2xl
                                bg-primary
                                px-3.5
                                text-left
                                text-primary-foreground
                                shadow-sm
                                transition
                                active:scale-[0.98]
                            "
                        >

                            <div className="pointer-events-none absolute right-0 top-0 opacity-[0.08]">
                                <Users className="h-24 w-24" />
                            </div>

                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary-foreground/10">

                                <UserRound
                                    className="h-5 w-5"
                                    strokeWidth={2.5}
                                />

                            </div>

                            <div className="relative z-10 ml-3 min-w-0">

                                <p className="text-[15px] font-bold leading-tight">
                                    Affiliate
                                </p>

                                <p className="mt-0.5 text-[9px] text-primary-foreground/70">
                                    Invite friends & earn
                                </p>

                            </div>

                            <ArrowRight
                                className="relative z-10 ml-auto h-5 w-5 shrink-0 transition-transform group-active:translate-x-1"
                                strokeWidth={2.5}
                            />

                        </button>

                    </div>

                    {/* MORE GIFTS */}

                    <button
                        type="button"
                        className="
                            group
                            relative
                            flex
                            min-h-[132px]
                            flex-col
                            items-center
                            justify-center
                            overflow-hidden
                            rounded-2xl
                            border
                            border-primary/40
                            bg-primary/5
                            text-primary
                            transition
                            active:scale-[0.98]
                        "
                    >

                        <div className="absolute -right-5 -top-5 h-16 w-16 rounded-full bg-primary/10" />

                        <Gift
                            className="relative h-9 w-9"
                            strokeWidth={2.3}
                        />

                        <span className="relative mt-2 text-[13px] font-bold leading-tight">
                            More
                        </span>

                        <span className="relative text-[13px] font-bold leading-tight">
                            Gifts
                        </span>

                        <ChevronRight className="mt-1 h-3.5 w-3.5 opacity-50" />

                    </button>

                </div>

            </section>

            {/* =====================================================
                AFFILIATE DIALOG
            ===================================================== */}

            <Dialog
                open={affiliateOpen}
                onOpenChange={
                    setAffiliateOpen
                }
            >

                <DialogContent
                    className="
                        w-[calc(100%-24px)]
                        max-w-[360px]
                        overflow-hidden
                        rounded-2xl
                        border-border
                        bg-background
                        p-0
                    "
                >

                    {/* HEADER */}

                    <div className="bg-linear-to-br from-primary to-primary/80 px-5 pb-6 pt-6">

                        <DialogHeader>

                            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-foreground/10">

                                <Users
                                    className="h-7 w-7 text-primary-foreground"
                                    strokeWidth={2}
                                />

                            </div>

                            <DialogTitle className="text-center text-xl font-bold text-primary-foreground">
                                Affiliate Program
                            </DialogTitle>

                            <DialogDescription className="mt-1.5 text-center text-xs leading-5 text-primary-foreground/75">
                                Invite friends and earn rewards
                                when they join EtyPoto.
                            </DialogDescription>

                        </DialogHeader>

                    </div>

                    {/* BODY */}

                    <div className="space-y-4 p-4">

                        {/* STATS */}

                        <div className="grid grid-cols-2 gap-2.5">

                            <div className="rounded-xl border border-border/60 bg-muted/50 p-3 text-center">

                                {getInviteDataloading ? (
                                    <div className="mx-auto h-6 w-8 animate-pulse rounded bg-muted" />
                                ) : (
                                    <p className="text-xl font-bold text-primary">
                                        {totalInvites}
                                    </p>
                                )}

                                <p className="mt-0.5 text-[10px] text-muted-foreground">
                                    Total Invites
                                </p>

                            </div>

                            <div className="rounded-xl border border-border/60 bg-muted/50 p-3 text-center">

                                {getInviteDataloading ? (
                                    <div className="mx-auto h-6 w-14 animate-pulse rounded bg-muted" />
                                ) : (
                                    <p className="text-xl font-bold text-primary">
                                        {Number(
                                            totalEarnings,
                                        ).toLocaleString()}{" "}
                                        ETB
                                    </p>
                                )}

                                <p className="mt-0.5 text-[10px] text-muted-foreground">
                                    Total Earnings
                                </p>

                            </div>

                        </div>

                        {/* ERROR */}

                        {error && (
                            <div className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-center">

                                <p className="text-[10px] text-destructive">
                                    Failed to load invite
                                    information.
                                </p>

                            </div>
                        )}

                        {/* REFERRAL LINK */}

                        <div>

                            <p className="mb-1.5 text-xs font-semibold">
                                Your referral link
                            </p>

                            <div className="flex items-center gap-1.5 rounded-xl border border-border/60 bg-muted/50 p-1.5">

                                <div className="min-w-0 flex-1 truncate px-2 text-[10px] text-muted-foreground">
                                    {referralLink}
                                </div>

                                <Button
                                    type="button"
                                    size="icon"
                                    onClick={
                                        copyReferral
                                    }
                                    disabled={
                                        !user?.referral_id
                                    }
                                    className="h-8 w-8 shrink-0 rounded-lg"
                                >
                                    {copied ? (
                                        <Check className="h-3.5 w-3.5" />
                                    ) : (
                                        <Copy className="h-3.5 w-3.5" />
                                    )}
                                </Button>

                            </div>

                        </div>

                        {/* INVITED USERS */}

                        <div>

                            <div className="mb-1.5 flex items-center justify-between">

                                <p className="text-xs font-semibold">
                                    Invited Users
                                </p>

                                <span className="text-[10px] font-medium text-muted-foreground">
                                    {totalInvites}
                                </span>

                            </div>

                            {getInviteDataloading ? (
                                <div className="space-y-2">

                                    {[1, 2, 3].map(
                                        (item) => (
                                            <div
                                                key={item}
                                                className="h-12 animate-pulse rounded-xl bg-muted"
                                            />
                                        ),
                                    )}

                                </div>
                            ) : invitedUsers.length ===
                                0 ? (
                                <div className="rounded-xl border border-border/60 bg-muted/50 p-4 text-center">

                                    <Users className="mx-auto h-6 w-6 text-muted-foreground/50" />

                                    <p className="mt-1.5 text-xs font-medium">
                                        No invited users yet
                                    </p>

                                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                                        Share your referral
                                        link to invite
                                        friends.
                                    </p>

                                </div>
                            ) : (
                                <div className="max-h-40 space-y-2 overflow-y-auto pr-0.5">

                                    {/* {invitedUsers.map(
                                        (
                                            invitedUser,
                                            index,
                                        ) => {

                                            const fullName =
                                                [
                                                    invitedUser.first_name,
                                                    invitedUser.last_name,
                                                ]
                                                    .filter(
                                                        Boolean,
                                                    )
                                                    .join(
                                                        " ",
                                                    );

                                            const displayName =
                                                fullName ||
                                                invitedUser.username ||
                                                `User ${index + 1}`;

                                            return (
                                                <div
                                                    key={
                                                        invitedUser.id ||
                                                        index
                                                    }
                                                    className="flex items-center gap-3 rounded-xl border border-border/60 bg-muted/50 p-2.5"
                                                >

                                                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                                                        {displayName
                                                            .charAt(
                                                                0,
                                                            )
                                                            .toUpperCase()}
                                                    </div>

                                                    <div className="min-w-0 flex-1">

                                                        <p className="truncate text-xs font-semibold">
                                                            {
                                                                displayName
                                                            }
                                                        </p>

                                                        {invitedUser.username && (
                                                            <p className="truncate text-[10px] text-muted-foreground">
                                                                @
                                                                {
                                                                    invitedUser.username
                                                                }
                                                            </p>
                                                        )}

                                                    </div>

                                                    <Check className="h-4 w-4 shrink-0 text-primary" />

                                                </div>
                                            );
                                        },
                                    )} */}

                                </div>
                            )}

                        </div>

                        {/* SHARE */}

                        <Button
                            type="button"
                            onClick={
                                shareReferral
                            }
                            disabled={
                                !user?.referral_id
                            }
                            className="h-11 w-full rounded-xl text-sm font-semibold"
                        >

                            <Share2 className="mr-2 h-4 w-4" />

                            Share Referral Link

                        </Button>

                        <p className="px-3 text-center text-[10px] leading-4 text-muted-foreground">
                            Share your referral link with
                            friends and earn rewards when
                            they join EtyPoto.
                        </p>

                    </div>

                </DialogContent>

            </Dialog>
        </>
    );
};

export default DailyStreak;

// =====================================================
// COUNTDOWN BOX
// =====================================================

interface CountdownBoxProps {
    value: string;
    label: string;
}

const CountdownBox = ({
    value,
    label,
}: CountdownBoxProps) => {
    return (
        <div className="flex h-[52px] w-[50px] flex-col items-center justify-center rounded-xl bg-primary-foreground/10 backdrop-blur-sm">

            <span className="text-[18px] font-bold leading-none">
                {value}
            </span>

            <span className="mt-1 text-[7px] font-semibold tracking-wider text-primary-foreground/60">
                {label}
            </span>

        </div>
    );
};

// =====================================================
// COUNTDOWN SEPARATOR
// =====================================================

const CountdownSeparator = () => {
    return (
        <div className="flex h-[52px] items-center text-lg font-bold text-primary-foreground/70">
            :
        </div>
    );
};

