import {
    featureMatch,
    placefeaturedbet,
    getMyFeatureMatchBet,
} from "@/api/featurematch";

import {
    useMutation,
    useQuery,
    useQueryClient,
} from "@tanstack/react-query";

import { useState } from "react";
import { toast } from "react-toastify";

import {
    CalendarDays,
    ChevronRight,
    Clock,
    Coins,
    Trophy,
} from "lucide-react";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

// ============================================================
// TYPES
// ============================================================

type Prediction = {
    id: string;
    odds: number;
    score: string;
    away_score: number;
    home_score: number;
};

type FeaturedMatchData = {
    match: {
        id: string;
        league: string;
        status: string;
        home_team: string;
        away_team: string;
        home_score: number | null;
        away_score: number | null;
        kickoff_at: string;
        prize_pool: number;
        settled_at: string | null;
        default_odds: number;
        home_team_logo: string | null;
        away_team_logo: string | null;
        betting_closes_at: string;
    };
    predictions: Prediction[];
};

type FeatureMatchResponse = {
    success: boolean;
    data: FeaturedMatchData | null;
};

type MyBet = {
    id: string;
    match_id: string;
    prediction_id: string;
    stake: number;
    odds: number;
    potential_payout: number;
    payout: number;
    status: "pending" | "won" | "lost" | "cancelled" | "void";
    settled_at: string | null;
    created_at: string;
    prediction: {
        id: string;
        home_score: number;
        away_score: number;
        odds: number;
    } | null;
};

type MyBetResponse = {
    success: boolean;
    data: MyBet | null;
};

// ============================================================
// COMPONENT
// ============================================================

export default function FeaturedMatch() {
    const [open, setOpen] = useState(false);

    const [selectedPrediction, setSelectedPrediction] =
        useState<Prediction | null>(null);

    const [betAmount, setBetAmount] = useState<number>(100);

    const queryClient = useQueryClient();

    // ============================================================
    // FEATURED MATCH QUERY
    // ============================================================

    const {
        data,
        isLoading,
        error,
    } = useQuery<FeatureMatchResponse>({
        queryKey: ["featureMatch"],
        queryFn: featureMatch,
    });

    // ============================================================
    // GET FEATURED MATCH
    // ============================================================

    const featured = data?.data;

    const match = featured?.match;

    const predictions = featured?.predictions ?? [];

    // ============================================================
    // USER'S EXISTING BET
    // ============================================================

    const {
        data: myBetResponse,
        isLoading: isBetLoading,
    } = useQuery<MyBetResponse>({
        queryKey: ["featureMatchBet", match?.id],

        queryFn: () => getMyFeatureMatchBet(match!.id),

        enabled: !!match?.id,

        // Don't refetch constantly.
        staleTime: 10_000,
    });

    const myBet = myBetResponse?.data ?? null;

    // ============================================================
    // PLACE BET MUTATION
    // ============================================================

    const placeBetMutation = useMutation({
        mutationFn: placefeaturedbet,

        onSuccess: async (response) => {
            console.log("Bet placed:", response);

            toast.success("Bet placed successfully!");

            // --------------------------------------------------------
            // Important:
            // DON'T close the dialog.
            // DON'T clear everything.
            //
            // We want to immediately show the user's bet.
            // --------------------------------------------------------

            // Refresh the user's bet.
            await queryClient.invalidateQueries({
                queryKey: ["featureMatchBet", match?.id],
            });

            // Refresh wallet.
            await queryClient.invalidateQueries({
                queryKey: ["wallet"],
            });

            // If you have another wallet query key, invalidate it here.
            // Example:
            //
            // queryClient.invalidateQueries({
            //   queryKey: ["user"],
            // });

            // Refresh featured match if needed.
            await queryClient.invalidateQueries({
                queryKey: ["featureMatch"],
            });

            // Clear the temporary selected prediction.
            setSelectedPrediction(null);

            // Reset amount.
            setBetAmount(100);
        },

        onError: (error) => {

            const message =
                error?.message ||
                "Failed to place bet";

            toast.error(message);
        },
    });

    // ============================================================
    // PLACE BET HANDLER
    // ============================================================

    const handlePlaceBet = () => {
        // ----------------------------------------------------------
        // Extra frontend protection.
        //
        // Backend/database must ALSO enforce this.
        // ----------------------------------------------------------

        if (myBet) {
            toast.info("You have already placed a bet on this match.");
            return;
        }

        if (!selectedPrediction) {
            toast.error("Please select a prediction");
            return;
        }

        if (!match?.id) {
            toast.error("Featured match not found");
            return;
        }

        if (!Number.isFinite(betAmount) || betAmount <= 0) {
            toast.error("Enter a valid bet amount");
            return;
        }

        placeBetMutation.mutate({
            matchId: match.id,
            predictionId: selectedPrediction.id,
            stake: betAmount,
        });
    };

    // ============================================================
    // HELPERS
    // ============================================================

    const formatPrizePool = (amount: number) =>
        new Intl.NumberFormat("en-US").format(amount);

    const formatAmount = (amount: number) =>
        new Intl.NumberFormat("en-US", {
            maximumFractionDigits: 2,
        }).format(amount);

    const formatKickoff = (date: string) =>
        new Intl.DateTimeFormat("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        }).format(new Date(date));

    // ============================================================
    // OPEN DIALOG
    // ============================================================

    const handleOpen = () => {
        // If the user already has a bet,
        // don't select anything.
        if (!myBet) {
            setSelectedPrediction(null);
            setBetAmount(100);
        }

        setOpen(true);
    };

    // ============================================================
    // CLOSE DIALOG
    // ============================================================

    const handleClose = (value: boolean) => {
        if (placeBetMutation.isPending) {
            return;
        }

        setOpen(value);

        if (!value) {
            setSelectedPrediction(null);
            setBetAmount(100);
        }
    };

    // ============================================================
    // POTENTIAL PAYOUT
    // ============================================================

    const potentialPayout =
        selectedPrediction && betAmount > 0
            ? Math.round(selectedPrediction.odds * betAmount)
            : 0;

    // ============================================================
    // STATUS HELPERS
    // ============================================================

    const getBetStatusClass = (status: MyBet["status"]) => {
        switch (status) {
            case "won":
                return "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";

            case "lost":
                return "border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400";

            case "cancelled":
            case "void":
                return "border-orange-500/30 bg-orange-500/10 text-orange-600 dark:text-orange-400";

            default:
                return "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400";
        }
    };

    // ============================================================
    // LOADING
    // ============================================================

    if (isLoading) {
        return (
            <section className="w-full px-2 pt-2">
                <Card className="overflow-hidden rounded-xl border-border/60 bg-card">
                    <CardContent className="space-y-2 p-2.5">
                        <div className="h-2.5 w-20 animate-pulse rounded bg-muted" />

                        <div className="flex items-center justify-between">
                            <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />

                            <div className="h-4 w-8 animate-pulse rounded bg-muted" />

                            <div className="h-9 w-9 animate-pulse rounded-full bg-muted" />
                        </div>

                        <div className="h-6 animate-pulse rounded-md bg-muted" />
                    </CardContent>
                </Card>
            </section>
        );
    }

    // ============================================================
    // ERROR
    // ============================================================

    if (error) {
        return (
            <section className="w-full px-2 pt-2">
                <Card className="rounded-xl border-destructive/30 bg-destructive/5">
                    <CardContent className="p-2.5">
                        <p className="text-[10px] text-destructive">
                            Failed to load featured match
                        </p>
                    </CardContent>
                </Card>
            </section>
        );
    }

    // ============================================================
    // NO MATCH
    // ============================================================

    if (!match) {
        return null;
    }

    // ============================================================
    // UI
    // ============================================================

    return (
        <>
            {/* ========================================================
          FEATURED MATCH CARD
      ======================================================== */}

            <section className="w-full px-2 pt-1.5">
                <Card
                    className="group relative cursor-pointer overflow-hidden rounded-xl border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 shadow-sm transition-all active:scale-[0.99]"
                    onClick={handleOpen}
                >
                    <div className="pointer-events-none absolute -right-12 -top-12 h-28 w-28 rounded-full bg-primary/10 blur-3xl" />

                    <CardContent className="relative p-2">
                        {/* Header */}

                        <div className="mb-2 flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                                <div className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/10">
                                    <Trophy className="h-3 w-3 text-primary" />
                                </div>

                                <div>
                                    <p className="text-[8px] font-bold uppercase tracking-wider text-primary leading-none">
                                        Featured Match
                                    </p>

                                    <p className="mt-0.5 text-[9px] leading-none text-muted-foreground">
                                        {match.league}
                                    </p>
                                </div>
                            </div>

                            <Badge
                                variant="outline"
                                className="h-4 border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[8px] uppercase text-emerald-600 dark:text-emerald-400"
                            >
                                <span className="mr-1 h-1 w-1 rounded-full bg-emerald-500" />

                                {match.status}
                            </Badge>
                        </div>

                        {/* Teams */}

                        <div className="flex items-center justify-between gap-1.5">
                            {/* Home */}

                            <div className="flex min-w-0 flex-1 flex-col items-center">
                                <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-muted/40 p-1">
                                    {match.home_team_logo ? (
                                        <img
                                            src={match.home_team_logo}
                                            alt={match.home_team}
                                            className="h-full w-full object-contain"
                                        />
                                    ) : (
                                        <span className="text-[8px] font-bold text-muted-foreground">
                                            {match.home_team.slice(0, 3).toUpperCase()}
                                        </span>
                                    )}
                                </div>

                                <p className="max-w-[80px] truncate text-center text-[10px] font-semibold leading-tight">
                                    {match.home_team}
                                </p>

                                <span className="text-[7px] uppercase tracking-wider text-muted-foreground">
                                    Home
                                </span>
                            </div>

                            {/* VS */}

                            <div className="flex shrink-0 flex-col items-center gap-0.5">
                                <span className="text-[8px] font-bold text-muted-foreground">
                                    VS
                                </span>

                                <div className="h-px w-5 bg-primary/30" />

                                <Badge
                                    variant="outline"
                                    className="h-4 border-primary/30 bg-primary/10 px-1.5 text-[8px] font-bold text-primary"
                                >
                                    {match.default_odds.toFixed(2)}x
                                </Badge>
                            </div>

                            {/* Away */}

                            <div className="flex min-w-0 flex-1 flex-col items-center">
                                <div className="mb-1 flex h-9 w-9 items-center justify-center rounded-full border border-border/60 bg-muted/40 p-1">
                                    {match.away_team_logo ? (
                                        <img
                                            src={match.away_team_logo}
                                            alt={match.away_team}
                                            className="h-full w-full object-contain"
                                        />
                                    ) : (
                                        <span className="text-[8px] font-bold text-muted-foreground">
                                            {match.away_team.slice(0, 3).toUpperCase()}
                                        </span>
                                    )}
                                </div>

                                <p className="max-w-[80px] truncate text-center text-[10px] font-semibold leading-tight">
                                    {match.away_team}
                                </p>

                                <span className="text-[7px] uppercase tracking-wider text-muted-foreground">
                                    Away
                                </span>
                            </div>
                        </div>

                        {/* Info */}

                        <div className="mt-2 grid grid-cols-2 gap-1.5">
                            <div className="rounded-md border border-border/50 bg-muted/30 p-1.5">
                                <div className="mb-0.5 flex items-center gap-1">
                                    <Trophy className="h-2.5 w-2.5 text-primary" />

                                    <span className="text-[7px] uppercase tracking-wider text-muted-foreground">
                                        Prize Pool
                                    </span>
                                </div>

                                <p className="text-[10px] font-bold leading-tight text-primary">
                                    {formatPrizePool(match.prize_pool)} ETB
                                </p>
                            </div>

                            <div className="rounded-md border border-border/50 bg-muted/30 p-1.5">
                                <div className="mb-0.5 flex items-center gap-1">
                                    <CalendarDays className="h-2.5 w-2.5 text-muted-foreground" />

                                    <span className="text-[7px] uppercase tracking-wider text-muted-foreground">
                                        Kickoff
                                    </span>
                                </div>

                                <p className="text-[9px] font-semibold leading-tight">
                                    {formatKickoff(match.kickoff_at)}
                                </p>
                            </div>
                        </div>

                        {/* CTA */}

                        <div className="mt-2 flex items-center justify-between rounded-md bg-primary/10 px-2 py-1.5">
                            <div className="min-w-0">
                                <p className="text-[9px] font-bold leading-tight text-primary">
                                    {myBet ? "View your prediction" : "Predict the exact score"}
                                </p>

                                <p className="text-[7px] leading-tight text-primary/60">
                                    {myBet
                                        ? "You already placed a bet"
                                        : "Tap to view predictions"}
                                </p>
                            </div>

                            <ChevronRight className="h-3 w-3 shrink-0 text-primary transition-transform group-hover:translate-x-0.5" />
                        </div>
                    </CardContent>
                </Card>
            </section>

            {/* ========================================================
          DIALOG
      ======================================================== */}

            <Dialog open={open} onOpenChange={handleClose}>
                <DialogContent className="w-[calc(100%-20px)] max-w-sm gap-0 overflow-hidden rounded-xl border-border/60 bg-card p-0">
                    {/* ====================================================
              HEADER
          ==================================================== */}

                    <DialogHeader className="border-b border-border/50 px-2.5 py-2 text-left">
                        <DialogTitle className="text-[11px] font-bold">
                            Exact Score Prediction
                        </DialogTitle>

                        <DialogDescription className="text-[9px]">
                            {myBet
                                ? "Your prediction for this featured match."
                                : "Select the final score you think will happen."}
                        </DialogDescription>
                    </DialogHeader>

                    {/* ====================================================
              MATCH SUMMARY
          ==================================================== */}

                    <div className="border-b border-border/50 px-2.5 py-2">
                        <div className="flex items-center justify-between gap-1.5">
                            {/* Home */}

                            <div className="flex min-w-0 flex-1 flex-col items-center">
                                <div className="mb-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-muted/40 p-1">
                                    {match.home_team_logo && (
                                        <img
                                            src={match.home_team_logo}
                                            alt={match.home_team}
                                            className="h-full w-full object-contain"
                                        />
                                    )}
                                </div>

                                <p className="max-w-[70px] truncate text-center text-[9px] font-semibold leading-tight">
                                    {match.home_team}
                                </p>
                            </div>

                            {/* VS */}

                            <div className="flex shrink-0 flex-col items-center gap-0.5">
                                <span className="text-[8px] font-bold text-muted-foreground">
                                    VS
                                </span>

                                <Badge
                                    variant="outline"
                                    className="h-4 border-primary/30 bg-primary/10 px-1.5 text-[8px] text-primary"
                                >
                                    {match.default_odds.toFixed(2)}x
                                </Badge>
                            </div>

                            {/* Away */}

                            <div className="flex min-w-0 flex-1 flex-col items-center">
                                <div className="mb-0.5 flex h-7 w-7 items-center justify-center rounded-full border border-border/60 bg-muted/40 p-1">
                                    {match.away_team_logo && (
                                        <img
                                            src={match.away_team_logo}
                                            alt={match.away_team}
                                            className="h-full w-full object-contain"
                                        />
                                    )}
                                </div>

                                <p className="max-w-[70px] truncate text-center text-[9px] font-semibold leading-tight">
                                    {match.away_team}
                                </p>
                            </div>
                        </div>

                        {/* Prize */}

                        <div className="mt-2 flex items-center justify-center gap-1.5 rounded-md border border-primary/15 bg-primary/5 px-2 py-1.5">
                            <Trophy className="h-3 w-3 text-primary" />

                            <div className="text-center">
                                <span className="text-[7px] uppercase tracking-wider text-muted-foreground">
                                    Prize Pool
                                </span>

                                <p className="text-[10px] font-bold leading-tight text-primary">
                                    {formatPrizePool(match.prize_pool)} ETB
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* ====================================================
              CONTENT
          ==================================================== */}

                    {isBetLoading ? (
                        /* --------------------------------------------------
                           CHECKING EXISTING BET
                        -------------------------------------------------- */

                        <div className="flex items-center justify-center px-2.5 py-8">
                            <div className="flex items-center gap-2">
                                <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary/30 border-t-primary" />

                                <p className="text-[9px] text-muted-foreground">
                                    Checking your bet...
                                </p>
                            </div>
                        </div>
                    ) : myBet ? (
                        /* ==================================================
                           USER ALREADY BET
                           NO PREDICTIONS SHOWN
                        ================================================== */

                        <div className="p-2.5">
                            <div className="space-y-2">
                                {/* Your Bet Header */}

                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-[7px] uppercase tracking-wider text-muted-foreground">
                                            Your Prediction
                                        </p>

                                        <p className="mt-0.5 text-xl font-bold leading-tight text-primary">
                                            {myBet.prediction
                                                ? `${myBet.prediction.home_score}-${myBet.prediction.away_score}`
                                                : "—"}
                                        </p>
                                    </div>

                                    <Badge
                                        variant="outline"
                                        className={`px-2 py-1 text-[8px] uppercase ${getBetStatusClass(
                                            myBet.status,
                                        )}`}
                                    >
                                        {myBet.status}
                                    </Badge>
                                </div>

                                {/* Teams */}

                                <div className="rounded-md border border-border/50 bg-muted/30 px-2 py-1.5">
                                    <div className="flex items-center justify-center gap-2 text-center">
                                        <span className="max-w-[90px] truncate text-[9px] font-medium">
                                            {match.home_team}
                                        </span>

                                        <span className="text-[8px] font-bold text-primary">
                                            {myBet.prediction
                                                ? `${myBet.prediction.home_score}-${myBet.prediction.away_score}`
                                                : "—"}
                                        </span>

                                        <span className="max-w-[90px] truncate text-[9px] font-medium">
                                            {match.away_team}
                                        </span>
                                    </div>
                                </div>

                                {/* Stake + Odds */}

                                <div className="grid grid-cols-2 gap-1.5">
                                    <div className="rounded-md border border-border/50 bg-muted/30 p-2">
                                        <div className="mb-0.5 flex items-center gap-1">
                                            <Coins className="h-2.5 w-2.5 text-primary" />

                                            <span className="text-[7px] uppercase tracking-wider text-muted-foreground">
                                                Stake
                                            </span>
                                        </div>

                                        <p className="text-[11px] font-bold">
                                            {formatAmount(Number(myBet.stake))} ETB
                                        </p>
                                    </div>

                                    <div className="rounded-md border border-border/50 bg-muted/30 p-2">
                                        <p className="mb-0.5 text-[7px] uppercase tracking-wider text-muted-foreground">
                                            Odds
                                        </p>

                                        <p className="text-[11px] font-bold">
                                            {Number(myBet.odds).toFixed(2)}x
                                        </p>
                                    </div>
                                </div>

                                {/* Potential payout */}

                                <div className="flex items-center justify-between rounded-md border border-primary/15 bg-primary/5 px-2 py-1.5">
                                    <span className="text-[8px] uppercase tracking-wider text-muted-foreground">
                                        Potential Payout
                                    </span>

                                    <span className="text-[11px] font-bold text-primary">
                                        {formatAmount(Number(myBet.potential_payout))} ETB
                                    </span>
                                </div>

                                {/* Status information */}

                                {myBet.status === "pending" && (
                                    <div className="flex items-center justify-center gap-1 rounded-md bg-muted/40 px-2 py-2">
                                        <Clock className="h-2.5 w-2.5 text-muted-foreground" />

                                        <p className="text-[8px] text-muted-foreground">
                                            Your bet is waiting for the match result.
                                        </p>
                                    </div>
                                )}

                                {myBet.status === "won" && (
                                    <div className="rounded-md border border-emerald-500/20 bg-emerald-500/10 px-2 py-2 text-center">
                                        <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400">
                                            You won {formatAmount(Number(myBet.payout))} ETB
                                        </p>
                                    </div>
                                )}

                                {myBet.status === "lost" && (
                                    <div className="rounded-md border border-red-500/20 bg-red-500/10 px-2 py-2 text-center">
                                        <p className="text-[9px] font-bold text-red-600 dark:text-red-400">
                                            Your prediction did not win
                                        </p>
                                    </div>
                                )}

                                {/* No second bet */}

                                <div className="rounded-md border border-border/50 bg-muted/20 px-2 py-1.5 text-center">
                                    <p className="text-[8px] text-muted-foreground">
                                        You have already placed your bet on this match.
                                    </p>
                                </div>
                            </div>
                        </div>
                    ) : (
                        /* ==================================================
                           USER HAS NOT BET
                           SHOW PREDICTIONS
                        ================================================== */

                        <>
                            {/* Predictions */}

                            <div className="p-2.5">
                                <div className="mb-1.5 flex items-center justify-between">
                                    <p className="text-[10px] font-semibold">
                                        Select exact score
                                    </p>

                                    <Badge
                                        variant="secondary"
                                        className="h-4 bg-muted px-1.5 text-[7px] text-muted-foreground"
                                    >
                                        {predictions.length} predictions
                                    </Badge>
                                </div>

                                <ScrollArea className="h-[170px] pr-1.5">
                                    <div className="grid grid-cols-3 gap-1">
                                        {predictions.map((prediction) => {
                                            const selected =
                                                selectedPrediction?.id === prediction.id;

                                            return (
                                                <Button
                                                    key={prediction.id}
                                                    type="button"
                                                    variant="outline"
                                                    disabled={placeBetMutation.isPending}
                                                    onClick={() =>
                                                        setSelectedPrediction(prediction)
                                                    }
                                                    className={`relative h-auto flex-col gap-0 rounded-md py-1.5 ${selected
                                                        ? "border-primary bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                                                        : "border-border/60 bg-muted/20 text-foreground hover:border-primary/40 hover:bg-primary/5"
                                                        }`}
                                                >
                                                    <span className="text-[11px] font-bold leading-tight">
                                                        {prediction.score}
                                                    </span>

                                                    <span
                                                        className={`text-[7px] leading-tight ${selected
                                                            ? "text-primary/70"
                                                            : "text-muted-foreground"
                                                            }`}
                                                    >
                                                        {prediction.odds.toFixed(2)}x
                                                    </span>

                                                    {selected && (
                                                        <span className="absolute right-1 top-1 h-1 w-1 rounded-full bg-primary" />
                                                    )}
                                                </Button>
                                            );
                                        })}
                                    </div>
                                </ScrollArea>
                            </div>

                            {/* =================================================
                  BET FORM
              ================================================= */}

                            <div className="border-t border-border/50 bg-muted/20 p-2.5">
                                {selectedPrediction ? (
                                    <div className="space-y-1.5">
                                        {/* Score + Odds */}

                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-[7px] uppercase tracking-wider text-muted-foreground">
                                                    Selected Score
                                                </p>

                                                <p className="mt-0.5 text-sm font-bold leading-tight text-primary">
                                                    {selectedPrediction.score}
                                                </p>
                                            </div>

                                            <div className="text-right">
                                                <p className="text-[7px] uppercase tracking-wider text-muted-foreground">
                                                    Odds
                                                </p>

                                                <p className="mt-0.5 text-sm font-bold leading-tight">
                                                    {selectedPrediction.odds.toFixed(2)}x
                                                </p>
                                            </div>
                                        </div>

                                        {/* Amount */}

                                        <div className="space-y-1">
                                            <Label className="flex items-center gap-1 text-[8px] uppercase tracking-wider text-muted-foreground">
                                                <Coins className="h-2.5 w-2.5" />
                                                Bet Amount
                                            </Label>

                                            <div className="relative">
                                                <Input
                                                    type="number"
                                                    min={1}
                                                    value={betAmount}
                                                    disabled={placeBetMutation.isPending}
                                                    onChange={(e) =>
                                                        setBetAmount(
                                                            Math.max(
                                                                0,
                                                                Number(e.target.value),
                                                            ),
                                                        )
                                                    }
                                                    className="h-7 rounded-md pr-10 text-right text-[11px] font-bold"
                                                />

                                                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[8px] font-medium text-muted-foreground">
                                                    ETB
                                                </span>
                                            </div>

                                            {/* Quick Amounts */}

                                            <div className="flex gap-1">
                                                {[50, 100, 500, 1000].map((amt) => (
                                                    <button
                                                        key={amt}
                                                        type="button"
                                                        disabled={placeBetMutation.isPending}
                                                        onClick={() => setBetAmount(amt)}
                                                        className={`flex-1 rounded-md px-1 py-0.5 text-[8px] font-bold transition ${betAmount === amt
                                                            ? "bg-primary/15 text-primary"
                                                            : "bg-muted text-muted-foreground hover:bg-muted/70"
                                                            }`}
                                                    >
                                                        {amt}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Potential Payout */}

                                        {potentialPayout > 0 && (
                                            <div className="flex items-center justify-between rounded-md border border-primary/15 bg-primary/5 px-2 py-1">
                                                <span className="text-[8px] uppercase tracking-wider text-muted-foreground">
                                                    Potential Payout
                                                </span>

                                                <span className="text-[11px] font-bold text-primary">
                                                    {potentialPayout.toLocaleString()} ETB
                                                </span>
                                            </div>
                                        )}

                                        {/* Place Bet */}

                                        <Button
                                            type="button"
                                            disabled={
                                                betAmount <= 0 ||
                                                !selectedPrediction ||
                                                placeBetMutation.isPending
                                            }
                                            onClick={handlePlaceBet}
                                            className="h-7 w-full rounded-md text-[10px] font-bold"
                                        >
                                            {placeBetMutation.isPending
                                                ? "Placing bet..."
                                                : `Place ${selectedPrediction.score} • ${betAmount.toLocaleString()} ETB`}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="flex items-center justify-center gap-1 text-[9px] text-muted-foreground">
                                        <Clock className="h-2.5 w-2.5" />
                                        Select a score prediction to continue
                                    </div>
                                )}
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}