import { useQuery } from "@tanstack/react-query";
import { getSupport } from "@/api/stat";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    Gift,
    TrendingUp,
    Shield,
    CircleDollarSign,
    Zap,
    Star,
    Trophy,
    MessageCircle,
} from "lucide-react";
import { useState } from "react";

// =====================================================
// Types
// =====================================================

interface Benefit {
    type: string;
    unit: string;
    label: string;
    value: number | boolean;
    description: string;
}

interface Level {
    level: number;
    benefits: Benefit[];
    description: string;
    minimum_deposit: number;
    required_points: number;
}

interface WageringRule {
    id: string;
    type: string;
    title: string;
    active: boolean;
    example: string;
    description: string;
    short_description: string;
    wagering_multiplier: number;
    contribution_description: string;
}

interface SupportData {
    levels: Level[];
    wagering_rules: WageringRule[];
}

// =====================================================
// Benefit Icon
// =====================================================

const getBenefitIcon = (type: string) => {
    switch (type) {
        case "daily_cashback":
            return <TrendingUp className="h-4 w-4 text-green-500" />;
        case "daily_bonus":
            return <Gift className="h-4 w-4 text-amber-500" />;
        case "deposit_bonus":
            return <CircleDollarSign className="h-4 w-4 text-blue-500" />;
        case "priority_support":
            return <Shield className="h-4 w-4 text-purple-500" />;
        case "vip_status":
            return <Star className="h-4 w-4 text-yellow-500" />;
        case "special_promotions":
            return <Zap className="h-4 w-4 text-pink-500" />;
        case "maximum_rewards":
            return <Trophy className="h-4 w-4 text-primary" />;
        default:
            return <Zap className="h-4 w-4 text-muted-foreground" />;
    }
};

// =====================================================
// Main Component
// =====================================================

export default function Support() {
    const { data, isLoading, error } = useQuery({
        queryKey: ["getSupport"],
        queryFn: getSupport,
    });

    const [selectedLevel, setSelectedLevel] = useState<Level | null>(null);
    const [dialogOpen, setDialogOpen] = useState(false);

    // ===================================================
    // Loading
    // ===================================================

    if (isLoading) {
        return (
            <div className="min-h-dvh w-full flex items-center justify-center bg-background">
                <div className="flex flex-col items-center gap-2">
                    <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                    <p className="text-[11px] text-muted-foreground">Loading support...</p>
                </div>
            </div>
        );
    }

    // ===================================================
    // Error
    // ===================================================

    if (error) {
        return (
            <div className="min-h-dvh w-full flex items-center justify-center bg-background px-4">
                <div className="text-center max-w-xs">
                    <Shield className="mx-auto mb-2 h-7 w-7 text-destructive" />
                    <p className="text-sm font-medium">Unable to load support information</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">
                        Please try again later.
                    </p>
                </div>
            </div>
        );
    }

    // ===================================================
    // Data
    // ===================================================

    const supportData = data?.data as SupportData | undefined;

    if (!supportData) {
        return (
            <div className="min-h-dvh flex items-center justify-center bg-background">
                <p className="text-xs text-muted-foreground">
                    No support information available.
                </p>
            </div>
        );
    }

    const { levels = [], wagering_rules = [] } = supportData;
    const sortedLevels = [...levels].sort((a, b) => a.level - b.level);
    const activeRules = wagering_rules.filter((rule) => rule.active !== false);

    // ===================================================
    // Handlers
    // ===================================================

    const handleLevelClick = (level: Level) => {
        setSelectedLevel(level);
        setDialogOpen(true);
    };

    // ===================================================
    // Render
    // ===================================================

    return (
        <div className="min-h-dvh w-full overflow-x-hidden bg-background">
            {/* Main Container */}
            <main className="mx-auto w-full max-w-[420px] px-2.5 pt-2.5 pb-24 sm:px-4 sm:pt-4">
                <div className="space-y-2.5 sm:space-y-4">
                    {/* Page Header */}
                    <div className="px-1">
                        <h1 className="text-base sm:text-lg font-bold tracking-tight">
                            Support
                        </h1>
                        <p className="mt-0.5 text-[10px] sm:text-xs text-muted-foreground leading-relaxed">
                            Learn about wagering requirements, loyalty levels,
                            and available benefits.
                        </p>
                    </div>

                    {/* Wagering Rules */}
                    {activeRules.length > 0 && (
                        <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
                            <CardHeader className="px-3 py-2.5 sm:px-4 sm:py-3">
                                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                        <Shield className="h-3.5 w-3.5 text-primary" />
                                    </div>
                                    <div>
                                        <span>Wagering Rules</span>
                                        <p className="mt-0.5 text-[9px] sm:text-[10px] font-normal text-muted-foreground">
                                            Requirements for bonuses, deposits and cashback
                                        </p>
                                    </div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 pt-0 sm:px-4 sm:pb-4">
                                <div className="divide-y divide-border/40">
                                    {activeRules.map((rule) => (
                                        <div key={rule.id} className="py-2.5 first:pt-0 last:pb-0">
                                            <div className="flex min-w-0 items-center gap-1.5">
                                                <Badge
                                                    variant="outline"
                                                    className="shrink-0 px-1.5 py-0 text-[8px] font-medium uppercase tracking-wide"
                                                >
                                                    {rule.type}
                                                </Badge>
                                                <h3 className="min-w-0 flex-1 truncate text-[11px] sm:text-xs font-semibold">
                                                    {rule.title}
                                                </h3>
                                                <Badge className="shrink-0 border-0 bg-primary/10 px-1.5 py-0 text-[9px] font-semibold text-primary">
                                                    {rule.wagering_multiplier}×
                                                </Badge>
                                            </div>
                                            {rule.short_description && (
                                                <p className="mt-1 text-[9px] sm:text-[10px] leading-relaxed text-muted-foreground">
                                                    {rule.short_description}
                                                </p>
                                            )}
                                            {rule.description && (
                                                <p className="mt-1 text-[9px] sm:text-[10px] leading-relaxed text-muted-foreground">
                                                    {rule.description}
                                                </p>
                                            )}
                                            {rule.contribution_description && (
                                                <div className="mt-1.5 rounded-lg bg-muted/30 px-2 py-1.5">
                                                    <p className="text-[9px] leading-relaxed">
                                                        <span className="font-medium">How it counts:</span>{" "}
                                                        <span className="text-muted-foreground">
                                                            {rule.contribution_description}
                                                        </span>
                                                    </p>
                                                </div>
                                            )}
                                            {rule.example && (
                                                <div className="mt-1.5 rounded-lg border border-border/30 bg-background px-2 py-1.5">
                                                    <p className="text-[9px] leading-relaxed">
                                                        <span className="font-medium">Example:</span>{" "}
                                                        <span className="italic text-muted-foreground">
                                                            {rule.example}
                                                        </span>
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Loyalty Levels */}
                    {sortedLevels.length > 0 && (
                        <Card className="overflow-hidden rounded-2xl border-border/60 shadow-sm">
                            <CardHeader className="px-3 py-2.5 sm:px-4 sm:py-3">
                                <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                                        <Trophy className="h-3.5 w-3.5 text-primary" />
                                    </div>
                                    <div>
                                        <span>Loyalty Levels</span>
                                        <p className="mt-0.5 text-[9px] sm:text-[10px] font-normal text-muted-foreground">
                                            Tap a level to see full details
                                        </p>
                                    </div>
                                </CardTitle>
                            </CardHeader>
                            <CardContent className="px-3 pb-3 pt-0 sm:px-4">
                                <div className="grid grid-cols-2 gap-2">
                                    {sortedLevels.map((level) => (
                                        <button
                                            key={level.level}
                                            onClick={() => handleLevelClick(level)}
                                            className="text-left focus:outline-none focus:ring-2 focus:ring-primary/50 rounded-xl"
                                        >
                                            <div className="rounded-xl border border-border/40 bg-muted/10 p-2.5 transition hover:bg-muted/30 active:scale-[0.97]">
                                                <Badge className="bg-primary/10 text-primary text-[9px] px-1.5 py-0">
                                                    Lv.{level.level}
                                                </Badge>
                                                <p className="mt-1 text-[10px] font-medium leading-tight line-clamp-2">
                                                    {level.description || `Level ${level.level}`}
                                                </p>
                                                <div className="mt-1.5 flex items-center gap-1 text-[8px] text-muted-foreground">
                                                    <span>{level.minimum_deposit} ETB</span>
                                                    <span className="mx-0.5">·</span>
                                                    <span>{level.required_points.toLocaleString()} pts</span>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Bottom help text */}
                    <div className="px-1 pb-1 text-center">
                        <p className="text-[9px] leading-relaxed text-muted-foreground">
                            Need help with your account, wagering, or rewards?
                        </p>
                    </div>
                </div>
            </main>

            {/* ===================================================
          Level Detail Dialog
          =================================================== */}
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogContent className="rounded-2xl max-w-[400px] max-h-[80vh] overflow-y-auto p-5 sm:p-6">
                    {selectedLevel && (
                        <>
                            <DialogHeader className="pb-2">
                                <DialogTitle className="flex items-center gap-2 text-lg">
                                    <Trophy className="h-5 w-5 text-primary" />
                                    Level {selectedLevel.level}
                                </DialogTitle>
                                <DialogDescription className="text-sm leading-relaxed">
                                    {selectedLevel.description}
                                </DialogDescription>
                            </DialogHeader>

                            {/* Requirements */}
                            <div className="grid grid-cols-2 gap-2 text-xs bg-muted/20 rounded-xl p-3">
                                <div>
                                    <span className="text-[10px] text-muted-foreground">Min Deposit</span>
                                    <p className="font-semibold">{selectedLevel.minimum_deposit} ETB</p>
                                </div>
                                <div>
                                    <span className="text-[10px] text-muted-foreground">Required Points</span>
                                    <p className="font-semibold">{selectedLevel.required_points.toLocaleString()}</p>
                                </div>
                            </div>

                            {/* Benefits */}
                            {selectedLevel.benefits && selectedLevel.benefits.length > 0 && (
                                <div className="space-y-2">
                                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                                        Benefits
                                    </p>
                                    {selectedLevel.benefits.map((benefit, idx) => (
                                        <div
                                            key={idx}
                                            className="flex items-start gap-3 rounded-xl border border-border/30 bg-background p-2.5"
                                        >
                                            <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-muted/30">
                                                {getBenefitIcon(benefit.type)}
                                            </div>
                                            <div>
                                                <p className="text-sm font-medium">{benefit.label}</p>
                                                <p className="text-[11px] text-muted-foreground">
                                                    {benefit.description}
                                                </p>
                                                {benefit.value !== undefined && benefit.value !== null && (
                                                    <p className="mt-0.5 text-[10px] font-medium text-primary">
                                                        {typeof benefit.value === "boolean"
                                                            ? benefit.value
                                                                ? "Included"
                                                                : "Not included"
                                                            : `${benefit.value}${benefit.unit ? ` ${benefit.unit}` : ""}`}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {(!selectedLevel.benefits || selectedLevel.benefits.length === 0) && (
                                <div className="rounded-xl bg-muted/20 px-3 py-2 text-center">
                                    <p className="text-[11px] text-muted-foreground">
                                        No additional benefits for this level.
                                    </p>
                                </div>
                            )}

                            <div className="mt-3 flex justify-end">
                                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                                    Close
                                </Button>
                            </div>
                        </>
                    )}
                </DialogContent>
            </Dialog>

            {/* ===================================================
          Contact Support (fixed bottom)
          =================================================== */}
            <div className="fixed inset-x-0 bottom-0 z-50 pointer-events-none">
                <div className="mx-auto w-full max-w-[420px] px-2.5 pb-[max(0.6rem,env(safe-area-inset-bottom))] sm:px-4">
                    <a
                        href="https://t.me/gebetagamesadmin"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="pointer-events-auto block"
                    >
                        <Button className="h-10 w-full rounded-xl text-xs font-semibold shadow-lg sm:h-11 sm:text-sm">
                            <MessageCircle className="mr-1.5 h-3.5 w-3.5 sm:h-4 sm:w-4" />
                            Contact Support
                        </Button>
                    </a>
                </div>
            </div>
        </div>
    );
}