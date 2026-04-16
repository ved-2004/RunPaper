"use client";

import { useState } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { listPapers, deletePaper } from "@/lib/paperApi";
import { ArrowRight, FileText, Upload, Trash2, AlertTriangle } from "lucide-react";
import Link from "next/link";
import type { PaperSummary } from "@/types/paper";
import { cn } from "@/lib/utils";
import { PaperListSkeleton } from "@/components/runpaper/PaperCardSkeleton";

function statusBadge(status: PaperSummary["status"]) {
  if (status === "complete") return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 dark:text-green-400">Complete</Badge>;
  if (status === "processing") return <Badge variant="secondary">Processing…</Badge>;
  return <Badge variant="destructive">Failed</Badge>;
}

// ── Delete confirmation inline ────────────────────────────────────────────────

function PaperCard({ paper }: { paper: PaperSummary }) {
  const [confirming, setConfirming] = useState(false);
  const qc = useQueryClient();

  const { mutate: doDelete, isPending } = useMutation({
    mutationFn: () => deletePaper(paper.paper_id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["papers"] });
    },
  });

  return (
    <Card className={cn("transition-shadow", !confirming && "hover:shadow-md")}>
      <CardContent className="p-4">
        {confirming ? (
          /* ── Confirm strip ── */
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
            <div className="flex items-start sm:items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 sm:mt-0" />
              <span>Delete <span className="font-medium">{paper.title || "this paper"}</span>? This can't be undone.</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                variant="destructive"
                disabled={isPending}
                onClick={() => doDelete()}
              >
                {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Delete"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          /* ── Normal row ── */
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 min-w-0">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{paper.title || "Untitled paper"}</p>
                <p className="text-xs text-muted-foreground">
                  {paper.authors?.slice(0, 2).join(", ")}
                  {paper.authors && paper.authors.length > 2 ? " et al." : ""}
                  {" · "}
                  {new Date(paper.uploaded_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {statusBadge(paper.status)}
              {paper.status === "complete" && (
                <Button size="sm" variant="outline" asChild>
                  <Link href={`/papers/${paper.paper_id}`}>
                    View <ArrowRight className="ml-1.5 h-3 w-3" />
                  </Link>
                </Button>
              )}
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                onClick={() => setConfirming(true)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { data: papers = [], isLoading } = useQuery({
    queryKey: ["papers"],
    queryFn: listPapers,
  });

  return (
    <AppLayout>
      <div className="p-3 sm:p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-5 sm:mb-6">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">My Papers</h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">Your paper implementations</p>
          </div>
          <Button asChild size="sm">
            <Link href="/upload"><Upload className="mr-1.5 h-3.5 w-3.5" /><span className="hidden sm:inline">Upload Paper</span><span className="sm:hidden">Upload</span></Link>
          </Button>
        </div>

        {isLoading ? (
          <PaperListSkeleton />
        ) : papers.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <FileText className="h-10 w-10 mx-auto text-muted-foreground/40 mb-4" />
              <h3 className="text-sm font-medium mb-1">No papers yet</h3>
              <p className="text-xs text-muted-foreground mb-4">Upload an ML research paper to get started.</p>
              <Button size="sm" asChild>
                <Link href="/upload">Upload your first paper</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {papers.map((paper) => (
              <PaperCard key={paper.paper_id} paper={paper} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
