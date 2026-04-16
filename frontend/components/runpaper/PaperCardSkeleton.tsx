"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/** Skeleton placeholder for a paper card row while loading. */
export function PaperCardSkeleton() {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Skeleton className="h-9 w-9 rounded-lg shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-4 w-3/4 max-w-xs" />
              <Skeleton className="h-3 w-1/2 max-w-[180px]" />
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-8 w-16 rounded-md" />
            <Skeleton className="h-8 w-8 rounded-md" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/** Three skeleton cards — matches typical initial load. */
export function PaperListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <PaperCardSkeleton key={i} />
      ))}
    </div>
  );
}
