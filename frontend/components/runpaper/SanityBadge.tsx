"use client";

import { useState } from "react";
import type { SanityStatus, SanityDetails } from "@/types/paper";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { CheckCircle2, AlertTriangle, XCircle, Clock, ShieldCheck, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  SanityStatus,
  { label: string; icon: React.ElementType; badge: string; dot: string }
> = {
  passed: {
    label: "Sanity passed",
    icon: CheckCircle2,
    badge: "bg-green-500/10 text-green-700 border-green-500/20 dark:text-green-400",
    dot: "bg-green-500",
  },
  warning: {
    label: "Needs review",
    icon: AlertTriangle,
    badge: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20 dark:text-yellow-400",
    dot: "bg-yellow-500",
  },
  failed: {
    label: "Check failed",
    icon: XCircle,
    badge: "bg-red-500/10 text-red-700 border-red-500/20 dark:text-red-400",
    dot: "bg-red-500",
  },
  skipped: {
    label: "Not checked",
    icon: Clock,
    badge: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground/40",
  },
  pending: {
    label: "Not checked",
    icon: Clock,
    badge: "bg-muted text-muted-foreground border-border",
    dot: "bg-muted-foreground/40",
  },
};

const CHECK_LABELS: Record<string, string> = {
  syntax_model_py: "model.py syntax",
  syntax_train_py: "train.py syntax",
  config_valid: "Config values",
  llm_review: "Code review",
};

// ── Compact badge (for dashboard cards) ──────────────────────────────────────

interface SanityBadgeProps {
  status: SanityStatus | null | undefined;
  details?: SanityDetails | null;
  /** "compact" = small pill only; "detailed" = pill + popover with breakdown */
  variant?: "compact" | "detailed";
  className?: string;
}

export function SanityBadge({
  status,
  details,
  variant = "compact",
  className,
}: SanityBadgeProps) {
  const s = status ?? "pending";
  const cfg = STATUS_CONFIG[s];
  const Icon = cfg.icon;

  const pill = (
    <Badge
      variant="outline"
      className={cn("gap-1 text-[11px] font-medium cursor-default select-none", cfg.badge, className)}
    >
      <Icon className="h-3 w-3" />
      {cfg.label}
    </Badge>
  );

  if (variant === "compact" || !details || (s !== "warning" && s !== "failed")) {
    return pill;
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="inline-flex">
          <Badge
            variant="outline"
            className={cn(
              "gap-1 text-[11px] font-medium cursor-pointer select-none hover:opacity-80 transition-opacity",
              cfg.badge,
              className,
            )}
          >
            <Icon className="h-3 w-3" />
            {cfg.label}
            <ChevronRight className="h-2.5 w-2.5 opacity-60" />
          </Badge>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-80 p-0" align="start">
        {/* Header */}
        <div className={cn("flex items-center gap-2 px-4 py-3 border-b", cfg.badge)}>
          <Icon className="h-4 w-4 shrink-0" />
          <div>
            <p className="text-xs font-semibold">Sanity Check Results</p>
            <p className="text-[11px] opacity-80">Automatically run on the generated code</p>
          </div>
        </div>

        {/* Checks breakdown */}
        <div className="px-4 py-3 space-y-1.5 border-b">
          <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
            Checks
          </p>
          {Object.entries(details.checks).map(([key, passed]) => (
            <div key={key} className="flex items-center gap-2 text-xs">
              {passed ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 shrink-0" />
              ) : (
                <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0" />
              )}
              <span className={passed ? "" : "text-red-700 dark:text-red-400"}>
                {CHECK_LABELS[key] ?? key}
              </span>
            </div>
          ))}
        </div>

        {/* Issues list */}
        {details.issues.length > 0 && (
          <div className="px-4 py-3">
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
              Issues
            </p>
            <ul className="space-y-1.5">
              {details.issues.map((issue, i) => (
                <li key={i} className="flex gap-1.5 text-[11px] text-foreground/80">
                  <span className="text-muted-foreground shrink-0">·</span>
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Footer hint */}
        <div className="px-4 py-2.5 border-t bg-muted/30">
          <p className="text-[10px] text-muted-foreground">
            <ShieldCheck className="inline h-3 w-3 mr-1 -mt-px" />
            Checks: syntax · config validation · LLM code review
          </p>
        </div>
      </PopoverContent>
    </Popover>
  );
}
