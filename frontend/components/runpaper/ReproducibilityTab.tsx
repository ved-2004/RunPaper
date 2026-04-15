"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { ReproducibilityItem } from "@/types/paper";
import { CheckCircle2, XCircle } from "lucide-react";

function groupByCategory(items: ReproducibilityItem[]): Record<string, ReproducibilityItem[]> {
  return items.reduce((acc, item) => {
    const cat = item.category || "general";
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(item);
    return acc;
  }, {} as Record<string, ReproducibilityItem[]>);
}

export function ReproducibilityTab({ items }: { items: ReproducibilityItem[] }) {
  const provided = items.filter((i) => i.provided).length;
  const total = items.length;
  const pct = total > 0 ? Math.round((provided / total) * 100) : 0;

  const groups = groupByCategory(items);

  return (
    <div className="space-y-4">
      {/* Legend */}
      <div className="flex flex-wrap items-center gap-5 px-1 py-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
          <span>Explicitly specified in the paper</span>
        </div>
        <div className="flex items-center gap-1.5">
          <XCircle className="h-4 w-4 text-destructive shrink-0" />
          <span>Not specified — suggested default shown where available</span>
        </div>
      </div>

      {/* Summary */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold">Reproducibility Score</h3>
              <p className="text-xs text-muted-foreground">{provided} of {total} items specified in the paper</p>
            </div>
            <div className="text-3xl font-bold text-primary">{pct}%</div>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* Grouped checklist */}
      {Object.entries(groups).map(([category, categoryItems]) => (
        <Card key={category}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm capitalize">{category}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {categoryItems.map((item, i) => (
              <div key={i} className="space-y-1">
                <div className="flex items-center gap-3">
                  {item.provided ? (
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <span className="text-sm font-medium">{item.label}</span>
                  {item.provided && item.value && (
                    <Badge variant="secondary" className="text-[10px] ml-auto">{item.value}</Badge>
                  )}
                </div>
                {!item.provided && item.suggested_default && (
                  <div className="ml-7 flex items-start gap-1.5">
                    <span className="text-warning text-xs">→</span>
                    <p className="text-xs text-muted-foreground">
                      <span className="font-medium text-amber-600">Suggested default: </span>
                      {item.suggested_default}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
