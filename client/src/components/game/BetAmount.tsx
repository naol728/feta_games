import React from "react";
import Monetary from "../Monetary";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface BetAmountProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onHalve: () => void;
  onDouble: () => void;
  onMax?: () => void;
  betValue: number;
  disabled?: boolean;
  label?: string;
  hint?: React.ReactNode;
}

const BetAmount: React.FC<BetAmountProps> = ({
  value,
  onChange,
  onBlur,
  onHalve,
  onDouble,
  onMax,
  betValue,
  disabled,
  label,
  hint,
}) => {
  const steps = [
    {
      key: "half",
      text: "½",
      run: onHalve,
    },
    {
      key: "double",
      text: "2×",
      run: onDouble,
    },
    ...(onMax
      ? [
        {
          key: "max",
          text: "Max",
          run: onMax,
        },
      ]
      : []),
  ];

  return (
    <div className="flex w-full flex-col gap-1.5">
      {/* Label + current value */}
      <div className="flex items-center justify-between px-0.5">
        <span className="text-xs font-medium text-muted-foreground">
          {label || "Bet Amount"}
        </span>

        <span className="text-xs font-semibold text-foreground">
          <Monetary value={betValue} />
        </span>
      </div>

      {/* Input + controls */}
      <div className="flex w-full">
        <Input
          type="text"
          inputMode="numeric"
          value={value}
          onChange={(e) =>
            onChange(e.target.value.replace(/[^0-9]/g, ""))
          }
          onBlur={onBlur}
          disabled={disabled}
          size={1}
          className={cn(
            "h-9 min-w-0 flex-1 rounded-r-none",
            "border-r-0 bg-muted/40",
            "text-sm font-medium",
            "focus-visible:z-10",
            "disabled:cursor-not-allowed disabled:opacity-50"
          )}
        />

        {steps.map((step, index) => {
          const isLast = index === steps.length - 1;

          return (
            <Button
              key={step.key}
              type="button"
              variant="outline"
              size="sm"
              onClick={step.run}
              disabled={disabled}
              className={cn(
                "h-9 rounded-none px-2.5 text-xs font-semibold",
                "bg-muted/40 hover:bg-accent",
                "focus-visible:z-10",
                index > 0 && "border-l-0",
                isLast && "rounded-r-md"
              )}
            >
              {step.text}
            </Button>
          );
        })}
      </div>

      {/* Optional hint */}
      {hint && (
        <span className="px-0.5 text-[11px] leading-tight text-muted-foreground">
          {hint}
        </span>
      )}
    </div>
  );
};

export default BetAmount;

