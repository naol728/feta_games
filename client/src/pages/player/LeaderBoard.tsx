import { useEffect, useMemo, useState } from "react";
import {
  Trophy,
  Medal,
  ChevronRight,
  Coins,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CountdownBox, CountdownSeparator } from "./DailyStreak";
import { useQuery } from "@tanstack/react-query";
import { getDailyLeaderboard } from "@/api/stat";

type LeaderboardPeriod = "today" | "yesterday" | "2days" | "3days";

interface LeaderboardPlayer {
  id: string;
  name: string;
  phone?: string;
  points: number;
  prize: number;
  rank: number;
  isCurrentUser?: boolean;
}

interface ApiLeaderboardPlayer {
  rank: number;
  user_id: string;
  username?: string | null;
  fname?: string | null;
  lname?: string | null;
  phone?: string | null;
  telegram_id?: number;
  total_points: number;
  reward: number;
}

interface DailyLeaderboardResponse {
  success: boolean;
  date: string;
  leaderboard: ApiLeaderboardPlayer[];
}

/* ==================== DATE HELPERS ==================== */

const getDateForPeriod = (period: LeaderboardPeriod): string => {
  const date = new Date();
  switch (period) {
    case "today": break;
    case "yesterday": date.setDate(date.getDate() - 1); break;
    case "2days": date.setDate(date.getDate() - 2); break;
    case "3days": date.setDate(date.getDate() - 3); break;
  }
  return date.toISOString().split("T")[0];
};

/* ==================== FORMATTERS ==================== */

const formatNumber = (value: number) => String(value).padStart(2, "0");
const formatPoints = (points: number) => points.toLocaleString();
const getInitials = (name: string) => {
  const safeName = name?.trim() || "User";
  const parts = safeName.split(" ");
  if (parts.length === 1) return safeName.slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
};

/* ==================== RANK STYLES ==================== */

const getRankBadgeClass = (rank: number) => {
  if (rank === 1) return "bg-amber-400 text-amber-900 border-amber-300";
  if (rank === 2) return "bg-slate-300 text-slate-800 border-slate-200";
  if (rank === 3) return "bg-amber-700 text-amber-100 border-amber-600";
  return "bg-muted text-muted-foreground";
};

const getRankRowClass = (rank: number) => {
  if (rank === 1) return "border-amber-400/40 bg-amber-50/70 dark:bg-amber-950/20";
  if (rank === 2) return "border-slate-300/40 bg-slate-50/60 dark:bg-slate-900/20";
  if (rank === 3) return "border-amber-700/30 bg-amber-100/40 dark:bg-amber-900/20";
  return "";
};

/* ==================== COMPONENT ==================== */

const Leaderboard = () => {
  const [period, setPeriod] = useState<LeaderboardPeriod>("today");
  const [countdown, setCountdown] = useState({ hours: 0, minutes: 0, seconds: 0 });

  const selectedDate = useMemo(() => getDateForPeriod(period), [period]);

  const { data, error, isLoading } = useQuery<DailyLeaderboardResponse>({
    queryKey: ["getDailyLeaderboard", selectedDate],
    queryFn: () => getDailyLeaderboard(selectedDate),
  });

  const currentUserId = localStorage.getItem("user_id");

  const players: LeaderboardPlayer[] = useMemo(() => {
    const apiPlayers = data?.leaderboard ?? [];
    return apiPlayers.map((player) => {
      const name = player.fname?.trim() || player.username?.trim() || player.phone || "User";
      return {
        id: player.user_id,
        name,
        phone: player.phone ?? undefined,
        points: Number(player.total_points) || 0,
        prize: Number(player.reward) || 0,
        rank: Number(player.rank),
        isCurrentUser: currentUserId === player.user_id,
      };
    });
  }, [data, currentUserId]);

  const topThree = useMemo(() => {
    return players.filter((p) => p.rank <= 3).sort((a, b) => a.rank - b.rank);
  }, [players]);

  // Podium order: [2nd, 1st, 3rd] for left-center-right layout
  const podiumPlayers = useMemo(() => {
    const rank1 = topThree.find(p => p.rank === 1);
    const rank2 = topThree.find(p => p.rank === 2);
    const rank3 = topThree.find(p => p.rank === 3);
    return [rank2, rank1, rank3].filter(Boolean) as LeaderboardPlayer[];
  }, [topThree]);

  const remainingPlayers = useMemo(() => {
    return players.filter((p) => p.rank > 3).sort((a, b) => a.rank - b.rank);
  }, [players]);

  /* ==================== COUNTDOWN ==================== */

  useEffect(() => {
    const updateCountdown = () => {
      const now = new Date();
      const tomorrow = new Date(now);
      tomorrow.setHours(24, 0, 0, 0);
      const diff = Math.max(Math.floor((tomorrow.getTime() - now.getTime()) / 1000), 0);
      setCountdown({
        hours: Math.floor(diff / 3600),
        minutes: Math.floor((diff % 3600) / 60),
        seconds: diff % 60,
      });
    };
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <>
      {/* Header Card – fully shadcn themed */}
      <div className="relative mt-2.5 min-h-[155px] overflow-hidden rounded-2xl bg-gradient-to-br from-primary via-primary to-primary/90 px-4 py-4 text-primary-foreground">
        {/* DECORATIVE CIRCLES */}
        <div className="pointer-events-none absolute -right-12 -top-8 h-44 w-44 rounded-full border-[6px] border-primary-foreground/20" />
        <div className="pointer-events-none absolute -right-4 top-6 h-32 w-32 rounded-full border-2 border-primary-foreground/15" />

        {/* CONTENT */}
        <div className="relative z-10">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-foreground/10">
              <Coins className="h-5 w-5" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-[20px] font-bold leading-tight">Daily Cashback</h2>
              <p className="text-[10px] text-primary-foreground/70">Next reward resets in</p>
            </div>
          </div>

          {/* COUNTDOWN – no custom className passed */}
          <div className="mt-4 flex items-center gap-1.5">
            <CountdownBox
              value={formatNumber(countdown.hours)}
              label="HRS"
            />
            <CountdownSeparator />
            <CountdownBox
              value={formatNumber(countdown.minutes)}
              label="MIN"
            />
            <CountdownSeparator />
            <CountdownBox
              value={formatNumber(countdown.seconds)}
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

      {/* Leaderboard Card */}
      <section className="w-full min-w-0 pb-4">
        <Card className="overflow-hidden rounded-2xl border-border/60 bg-card shadow-md">
          <div className="border-b border-border/60 px-3 pb-2 pt-3">
            <div className="mb-2 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10">
                <Trophy className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h1 className="text-base font-bold leading-tight">Leaderboard</h1>
                <p className="text-[10px] text-muted-foreground">
                  Compete and win daily prizes
                </p>
              </div>
            </div>

            <Tabs value={period} onValueChange={(v) => setPeriod(v as LeaderboardPeriod)}>
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

          <CardContent className="p-3">
            {isLoading && (
              <div className="flex items-center justify-center py-10">
                <p className="text-sm text-muted-foreground">Loading leaderboard...</p>
              </div>
            )}

            {error && !isLoading && (
              <div className="flex items-center justify-center py-10">
                <p className="text-sm text-destructive">Failed to load leaderboard</p>
              </div>
            )}

            {!isLoading && !error && (
              <>
                {/* Top 3 Podium */}
                {podiumPlayers.length > 0 && (
                  <div className="mb-4 grid grid-cols-3 gap-2">
                    {podiumPlayers.map((player) => (
                      <TopPlayerCard key={player.id} player={player} />
                    ))}
                  </div>
                )}

                {/* Table header */}
                <div className="mt-2 grid grid-cols-[minmax(0,1fr)_minmax(auto,70px)_minmax(auto,60px)] items-center gap-1.5 px-1">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Player</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Points</span>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary">Prize</span>
                </div>
                <Separator className="my-1.5" />

                {/* Remaining Players */}
                <div className="space-y-0.5 overflow-hidden">
                  {remainingPlayers.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 text-center">
                      <Medal className="h-6 w-6 text-muted-foreground/40" />
                      <p className="mt-1.5 text-xs font-medium">
                        {players.length === 0 ? "No players yet" : "No more players"}
                      </p>
                    </div>
                  ) : (
                    remainingPlayers.map((player) => (
                      <PlayerRow key={player.id} player={player} />
                    ))
                  )}
                </div>

                {remainingPlayers.length > 0 && (
                  <div className="mt-2 text-center text-[10px] text-muted-foreground">
                    Showing {players.length} participants
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </section>
    </>
  );
};

/* ==================== TOP PLAYER CARD (Podium style) ==================== */

interface TopPlayerCardProps {
  player: LeaderboardPlayer;
}

const TopPlayerCard = ({ player }: TopPlayerCardProps) => {
  const rank = player.rank;
  const rankColors = ["from-amber-400 to-yellow-500", "from-slate-300 to-slate-400", "from-amber-700 to-amber-600"];
  const rankBadges = ["🥇", "🥈", "🥉"];
  const isFirst = rank === 1;
  const avatarSize = isFirst ? "h-16 w-16" : "h-14 w-14";
  const cardClass = isFirst
    ? "scale-105 border-2 border-amber-400 shadow-lg shadow-amber-200/50 dark:shadow-amber-900/30"
    : "border";

  return (
    <div
      className={`relative flex flex-col items-center rounded-xl ${cardClass} p-3 text-center transition-all hover:shadow-md ${getRankRowClass(rank)} max-w-full overflow-hidden`}
    >
      <div
        className={`absolute -top-1 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-b ${rankColors[rank - 1]} px-2 py-0.5 text-xs font-bold text-white shadow-sm`}
      >
        {rankBadges[rank - 1]} #{rank}
      </div>
      <Avatar className={`${avatarSize} mt-1 border-2 border-primary/20`}>
        <AvatarFallback className="bg-muted text-sm font-bold text-muted-foreground">
          {getInitials(player.name)}
        </AvatarFallback>
      </Avatar>
      <p className="mt-1.5 w-full truncate text-sm font-bold">{player.name}</p>
      {player.phone && <p className="w-full truncate text-[10px] text-muted-foreground">{player.phone}</p>}
      <div className="mt-1 flex flex-wrap items-center justify-center gap-2 text-xs">
        <span className="font-bold text-primary">{formatPoints(player.points)} pts</span>
        <span className="font-bold text-amber-600">{player.prize} ETB</span>
      </div>
      {player.isCurrentUser && (
        <Badge variant="secondary" className="mt-1 h-4 px-1 text-[8px]">
          YOU
        </Badge>
      )}
    </div>
  );
};

/* ==================== REGULAR PLAYER ROW ==================== */

interface PlayerRowProps {
  player: LeaderboardPlayer;
}

const PlayerRow = ({ player }: PlayerRowProps) => {
  return (
    <div
      className={`group grid grid-cols-[minmax(0,1fr)_minmax(auto,70px)_minmax(auto,60px)] items-center gap-1.5 border-b border-border/60 px-1 py-1.5 transition-colors ${player.isCurrentUser ? "rounded-lg bg-primary/5" : ""
        }`}
    >
      <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
        <div
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${getRankBadgeClass(
            player.rank
          )}`}
        >
          {player.rank}
        </div>
        <Avatar className="h-6 w-6 shrink-0">
          <AvatarFallback className="bg-muted text-[8px] font-bold text-muted-foreground">
            {getInitials(player.name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1 overflow-hidden">
          <div className="flex min-w-0 items-center gap-1">
            <p className="truncate text-xs font-semibold leading-tight">{player.name}</p>
            {player.isCurrentUser && (
              <Badge variant="secondary" className="h-3.5 shrink-0 px-1 text-[7px]">
                YOU
              </Badge>
            )}
          </div>
          {player.phone && <p className="truncate text-[8px] text-muted-foreground">{player.phone}</p>}
        </div>
      </div>

      <div className="min-w-0 text-right">
        <p className="truncate text-xs font-bold text-primary">{formatPoints(player.points)}</p>
      </div>

      <div className="flex items-center justify-end gap-0.5">
        <p className="truncate text-xs font-bold">{player.prize} ETB</p>
        <ChevronRight className="hidden h-2.5 w-2.5 text-muted-foreground/50 sm:block" />
      </div>
    </div>
  );
};

export default Leaderboard;