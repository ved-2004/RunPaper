"use client";

import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  useExplain,
  type ExplainItem,
  type ExplainPaperContext,
} from "@/contexts/ExplainContext";
import { cn } from "@/lib/utils";

interface ExplainButtonProps {
  item: ExplainItem;
  paperId: string;
  paperContext: ExplainPaperContext;
  className?: string;
}

/**
 * Small spark button that opens the floating ExplainPanel.
 * Appears on hover of its parent (the parent must have `group` class).
 * Stays highlighted while the panel is showing THIS item.
 */
export function ExplainButton({
  item,
  paperId,
  paperContext,
  className,
}: ExplainButtonProps) {
  const { openExplain, item: currentItem, isOpen } = useExplain();

  const isActive =
    isOpen &&
    currentItem?.label === item.label &&
    currentItem?.type === item.type;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={cn(
            "h-6 w-6 shrink-0",
            isActive && "text-primary bg-primary/10",
            className,
          )}
          onClick={(e) => {
            e.stopPropagation();
            openExplain(item, paperId, paperContext);
          }}
        >
          <Sparkles className="h-3.5 w-3.5" />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">Explain this</TooltipContent>
    </Tooltip>
  );
}
