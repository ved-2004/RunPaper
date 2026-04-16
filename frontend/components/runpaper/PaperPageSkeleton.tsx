"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

/**
 * Full-page skeleton shown while the paper record is being fetched from the
 * API (not to be confused with the "processing" spinner while the pipeline
 * runs — this one is just for the initial GET /api/papers/{id} request).
 */
export function PaperPageSkeleton() {
  return (
    <div className="p-3 sm:p-6 max-w-[1400px] mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1 space-y-2">
          <Skeleton className="h-6 w-2/3 max-w-lg" />
          <Skeleton className="h-4 w-1/3 max-w-xs" />
        </div>
        <Skeleton className="h-8 w-28 rounded-md shrink-0" />
      </div>

      {/* Tab bar */}
      <div className="flex gap-1">
        {[80, 64, 56, 88, 112, 56].map((w, i) => (
          <Skeleton key={i} className="h-9 rounded-md" style={{ width: w }} />
        ))}
      </div>

      {/* Content area */}
      <Card>
        <CardContent className="py-14 text-center">
          <Skeleton className="h-10 w-10 rounded-full mx-auto mb-4" />
          <Skeleton className="h-4 w-40 mx-auto mb-2" />
          <Skeleton className="h-3 w-64 mx-auto" />
        </CardContent>
      </Card>
    </div>
  );
}
