import { Play, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

// ============================================================
// Types
// ============================================================
interface RouletteButtonsProps {
    gameStart: () => void;
    handleHandleExit: () => void;
}

interface Action {
    key: string;
    icon: typeof Play;
    onClick: () => void;
    label: string;
}

// ============================================================
// Component
// ============================================================
export default function RouletteButtons({
    gameStart,
    handleHandleExit,
}: RouletteButtonsProps) {
    const actions: readonly Action[] = [
        {
            key: "start",
            icon: Play,
            onClick: gameStart,
            label: "Spin",
        },
        {
            key: "back",
            icon: RotateCcw,
            onClick: handleHandleExit,
            label: "Leave",
        },
    ];

    return (
        <TooltipProvider delayDuration={150}>
            <div className="button_action_group roulette_buttons_container flex items-center gap-2">
                {actions.map(({ key, icon: Icon, onClick, label }) => (
                    <Tooltip key={key}>
                        <TooltipTrigger asChild>
                            <Button
                                type="button"
                                size="icon"
                                variant="outline"
                                aria-label={label}
                                onClick={onClick}
                                className="mybutton round button_transparent shadow_convex h-10 w-10 rounded-full"
                            >
                                <Icon className="h-4 w-4" />
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">{label}</TooltipContent>
                    </Tooltip>
                ))}
            </div>
        </TooltipProvider>
    );
}