import { useEffect, useMemo, useState } from "react";
import {
    Crown,
    Trophy,
    Medal,
    ChevronRight,
    Coins,
} from "lucide-react";

import {
    Card,
    CardContent,
} from "@/components/ui/card";

import {
    Tabs,
    TabsList,
    TabsTrigger,
} from "@/components/ui/tabs";

import {
    Avatar,
    AvatarFallback,
} from "@/components/ui/avatar";

import { Badge } from "@/components/ui/badge";

import { Separator } from "@/components/ui/separator";

import { ScrollArea } from "@/components/ui/scroll-area";
import { CountdownBox, CountdownSeparator } from "./DailyStreak";

type LeaderboardPeriod =
    | "today"
    | "yesterday"
    | "2days"
    | "3days";

interface LeaderboardPlayer {
    id: string;
    name: string;
    phone?: string;
    points: number;
    prize: number;
    rank: number;
    isCurrentUser?: boolean;
}

const leaderboardData: Record<
    LeaderboardPeriod,
    LeaderboardPlayer[]
> = {
    today: [
        {
            id: "1",
            name: "እውነተኛ ተጫዋች",
            phone: "+251912****70",
            points: 11789,
            prize: 300,
            rank: 1,
        },
        {
            id: "2",
            name: "Yonas",
            phone: "+251972****77",
            points: 7285,
            prize: 200,
            rank: 2,
        },
        {
            id: "3",
            name: "KIYA",
            phone: "+251912****47",
            points: 6657,
            prize: 175,
            rank: 3,
        },
        {
            id: "4",
            name: "Bisrat",
            phone: "+251917****41",
            points: 6058,
            prize: 25,
            rank: 4,
        },
        {
            id: "5",
            name: "Golicha",
            phone: "+251995****05",
            points: 5103,
            prize: 25,
            rank: 5,
        },
        {
            id: "6",
            name: "Chelachew",
            phone: "+251911****21",
            points: 4688,
            prize: 20,
            rank: 6,
        },
        {
            id: "7",
            name: "Dawit",
            phone: "+251922****33",
            points: 4210,
            prize: 20,
            rank: 7,
        },
        {
            id: "8",
            name: "Henok",
            phone: "+251934****18",
            points: 3950,
            prize: 15,
            rank: 8,
        },
        {
            id: "9",
            name: "Miki",
            phone: "+251911****55",
            points: 3675,
            prize: 15,
            rank: 9,
        },
        {
            id: "10",
            name: "Abel",
            phone: "+251922****81",
            points: 3420,
            prize: 10,
            rank: 10,
        },
    ],

    yesterday: [
        {
            id: "11",
            name: "Dawit",
            phone: "+251922****33",
            points: 13250,
            prize: 300,
            rank: 1,
        },
        {
            id: "12",
            name: "Yonas",
            phone: "+251972****77",
            points: 9870,
            prize: 200,
            rank: 2,
        },
        {
            id: "13",
            name: "KIYA",
            phone: "+251912****47",
            points: 8120,
            prize: 175,
            rank: 3,
        },
        {
            id: "14",
            name: "Bisrat",
            phone: "+251917****41",
            points: 6980,
            prize: 25,
            rank: 4,
        },
        {
            id: "15",
            name: "Golicha",
            phone: "+251995****05",
            points: 6210,
            prize: 25,
            rank: 5,
        },
    ],

    "2days": [
        {
            id: "21",
            name: "KIYA",
            phone: "+251912****47",
            points: 15420,
            prize: 300,
            rank: 1,
        },
        {
            id: "22",
            name: "Dawit",
            phone: "+251922****33",
            points: 12100,
            prize: 200,
            rank: 2,
        },
        {
            id: "23",
            name: "Yonas",
            phone: "+251972****77",
            points: 9840,
            prize: 175,
            rank: 3,
        },
        {
            id: "24",
            name: "Henok",
            phone: "+251934****18",
            points: 7230,
            prize: 25,
            rank: 4,
        },
    ],

    "3days": [
        {
            id: "31",
            name: "Yonas",
            phone: "+251972****77",
            points: 16200,
            prize: 300,
            rank: 1,
        },
        {
            id: "32",
            name: "KIYA",
            phone: "+251912****47",
            points: 13800,
            prize: 200,
            rank: 2,
        },
        {
            id: "33",
            name: "Dawit",
            phone: "+251922****33",
            points: 11200,
            prize: 175,
            rank: 3,
        },
    ],
};


const formatNumber = (
    value: number,
) =>
    String(value).padStart(
        2,
        "0",
    );


const formatPoints = (points: number) => {
    return points.toLocaleString();
};

const getInitials = (name: string) => {
    const parts = name.trim().split(" ");
    if (parts.length === 1) {
        return name.slice(0, 2).toUpperCase();
    }
    return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

const getRankBadgeClass = (rank: number) => {
    if (rank === 1) return "bg-primary text-primary-foreground";
    if (rank === 2) return "bg-secondary text-secondary-foreground";
    if (rank === 3) return "bg-accent text-accent-foreground";
    return "bg-muted text-muted-foreground";
};

const getRankRowClass = (rank: number) => {
    if (rank === 1) return "border-primary/40 bg-primary/5";
    if (rank === 2) return "border-border bg-muted/50";
    if (rank === 3) return "border-border/70 bg-secondary/30";
    return "";
};

const Leaderboard = () => {
    const [period, setPeriod] =
        useState<LeaderboardPeriod>("today");
    const [countdown, setCountdown] = useState({
        hours: 0,
        minutes: 0,
        seconds: 0,
    });

    const players = leaderboardData[period];

    const topThree = useMemo(() => {
        return players
            .filter((player) => player.rank <= 3)
            .sort((a, b) => a.rank - b.rank);
    }, [players]);

    const remainingPlayers = useMemo(() => {
        return players
            .filter((player) => player.rank > 3)
            .sort((a, b) => a.rank - b.rank);
    }, [players]);

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

    return (
        <>
            <div className="relative mx-2 mt-2.5 min-h-[155px] overflow-hidden rounded-2xl bg-linear-to-br from-primary via-primary to-primary/80 px-4 py-4 text-primary-foreground">

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
            <section className="w-full min-w-0 pb-4">

                <Card className="overflow-hidden rounded-2xl border-border/60 bg-card shadow-sm">

                    {/* ==================== HEADER ==================== */}
                    <div className="border-b border-border/60 px-2.5 pb-2 pt-2.5">
                        <div className="mb-2 flex items-center gap-2">
                            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                                <Trophy className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="text-[15px] font-bold leading-tight">
                                    Leaderboard
                                </h1>
                                <p className="text-[9px] text-muted-foreground">
                                    Compete and win daily prizes
                                </p>
                            </div>
                        </div>

                        {/* Period Tabs */}
                        <Tabs
                            value={period}
                            onValueChange={(value) =>
                                setPeriod(value as LeaderboardPeriod)
                            }
                        >
                            <TabsList className="flex h-8 w-full gap-0.5 overflow-x-auto rounded-lg bg-muted/80 p-0.5">
                                <TabsTrigger
                                    value="today"
                                    className="h-6 shrink-0 rounded-md px-2.5 text-[10px] font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                                >
                                    Today
                                </TabsTrigger>
                                <TabsTrigger
                                    value="yesterday"
                                    className="h-6 shrink-0 rounded-md px-2.5 text-[10px] font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                                >
                                    Yesterday
                                </TabsTrigger>
                                <TabsTrigger
                                    value="2days"
                                    className="h-6 shrink-0 rounded-md px-2.5 text-[10px] font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                                >
                                    2 Days Ago
                                </TabsTrigger>
                                <TabsTrigger
                                    value="3days"
                                    className="h-6 shrink-0 rounded-md px-2.5 text-[10px] font-semibold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-sm"
                                >
                                    3 Days Ago
                                </TabsTrigger>
                            </TabsList>
                        </Tabs>
                    </div>

                    <CardContent className="p-2.5">

                        {/* ==================== TOP 3 LIST ==================== */}
                        {topThree.length > 0 && (
                            <div className="space-y-1.5">
                                {topThree.map((player) => (
                                    <TopPlayerRow key={player.id} player={player} />
                                ))}
                            </div>
                        )}

                        {/* ==================== TABLE HEADER ==================== */}
                        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_62px_58px] items-center gap-1.5 px-0.5">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
                                Player
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
                                Points
                            </span>
                            <span className="text-[10px] font-bold uppercase tracking-wide text-primary">
                                Prize
                            </span>
                        </div>

                        <Separator className="mt-1.5" />

                        {/* ==================== REMAINING PLAYERS ==================== */}
                        <ScrollArea className="h-[230px]">
                            <div className="pr-0.5">
                                {remainingPlayers.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-8 text-center">
                                        <Medal className="h-6 w-6 text-muted-foreground/40" />
                                        <p className="mt-1.5 text-[10px] font-medium">
                                            No more players
                                        </p>
                                    </div>
                                ) : (
                                    remainingPlayers.map((player) => (
                                        <PlayerRow key={player.id} player={player} />
                                    ))
                                )}
                            </div>
                        </ScrollArea>
                    </CardContent>
                </Card>
            </section>
        </>
    );
};

// ==================== TOP PLAYER ROW (ranks 1–3) ====================
interface TopPlayerRowProps {
    player: LeaderboardPlayer;
}

const TopPlayerRow = ({ player }: TopPlayerRowProps) => {
    const rank = player.rank;
    const isFirst = rank === 1;

    return (
        <div
            className={`
                grid grid-cols-[minmax(0,1fr)_62px_58px] items-center gap-1.5
                rounded-lg border px-2 py-1.5
                ${getRankRowClass(rank)}
                transition-colors
            `}
        >
            {/* Player info */}
            <div className="flex min-w-0 items-center gap-2">
                {/* Rank badge with crown for 1st */}
                <div className="relative flex h-8 w-8 shrink-0 items-center justify-center">
                    <div
                        className={`
                            flex h-8 w-8 items-center justify-center rounded-full
                            text-[11px] font-black
                            ${getRankBadgeClass(rank)}
                        `}
                    >
                        {rank}
                    </div>
                    {isFirst && (
                        <Crown className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 text-primary" />
                    )}
                </div>

                {/* Avatar + name */}
                <div className="flex items-center gap-1.5 min-w-0">
                    <Avatar className="h-8 w-8 shrink-0 border border-border">
                        <AvatarFallback className="bg-muted text-[9px] font-bold text-muted-foreground">
                            {getInitials(player.name)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                        <p className="truncate text-[13px] font-bold leading-tight">
                            {player.name}
                        </p>
                        {player.phone && (
                            <p className="truncate text-[8px] text-muted-foreground">
                                {player.phone}
                            </p>
                        )}
                    </div>
                </div>
            </div>

            {/* Points */}
            <div className="min-w-0">
                <p className="truncate text-[13px] font-bold text-primary">
                    {formatPoints(player.points)}
                </p>
            </div>

            {/* Prize */}
            <div className="flex items-center justify-between gap-0.5">
                <p className="truncate text-[11px] font-bold">
                    {player.prize} ETB
                </p>
                <ChevronRight className="hidden h-3 w-3 text-muted-foreground/50 sm:block" />
            </div>
        </div>
    );
};

// ==================== REGULAR PLAYER ROW ====================
interface PlayerRowProps {
    player: LeaderboardPlayer;
}

const PlayerRow = ({ player }: PlayerRowProps) => {
    return (
        <div
            className={`
                group
                grid grid-cols-[minmax(0,1fr)_62px_58px] items-center gap-1.5
                border-b border-border/60 px-0.5 py-1.5
                transition-colors
                ${player.isCurrentUser ? "rounded-lg bg-primary/5" : ""}
            `}
        >
            {/* Player info */}
            <div className="flex min-w-0 items-center gap-1.5">
                <div
                    className={`
                        flex h-6 w-6 shrink-0 items-center justify-center rounded-full
                        text-[10px] font-bold
                        ${getRankBadgeClass(player.rank)}
                    `}
                >
                    {player.rank}
                </div>
                <Avatar className="h-6 w-6 shrink-0">
                    <AvatarFallback className="bg-muted text-[8px] font-bold text-muted-foreground">
                        {getInitials(player.name)}
                    </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                    <div className="flex min-w-0 items-center gap-1">
                        <p className="truncate text-[11px] font-semibold leading-tight">
                            {player.name}
                        </p>
                        {player.isCurrentUser && (
                            <Badge variant="secondary" className="h-3.5 shrink-0 px-1 text-[7px]">
                                YOU
                            </Badge>
                        )}
                    </div>
                    {player.phone && (
                        <p className="truncate text-[7px] text-muted-foreground">
                            {player.phone}
                        </p>
                    )}
                </div>
            </div>

            {/* Points */}
            <div className="min-w-0">
                <p className="truncate text-[12px] font-bold text-primary">
                    {formatPoints(player.points)}
                </p>
            </div>

            {/* Prize */}
            <div className="flex items-center justify-between gap-0.5">
                <p className="truncate text-[10px] font-bold">
                    {player.prize} ETB
                </p>
                <ChevronRight className="hidden h-2.5 w-2.5 text-muted-foreground/50 sm:block" />
            </div>
        </div>
    );
};

export default Leaderboard;