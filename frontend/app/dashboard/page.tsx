"use client";

import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { listPapers } from "@/lib/paperApi";
import { ArrowRight, FileText, Loader2, Upload } from "lucide-react";
import Link from "next/link";
import type { PaperSummary } from "@/types/paper";

function statusBadge(status: PaperSummary["status"]) {
  if (status === "complete") return <Badge className="bg-success/10 text-success border-success/20">Complete</Badge>;
  if (status === "processing") return <Badge variant="secondary">Processing...</Badge>;
  return <Badge variant="destructive">Failed</Badge>;
}

export default function DashboardPage() {
  const { data: papers = [], isLoading } = useQuery({
    queryKey: ["papers"],
    queryFn: listPapers,
  });

  return (
    <AppLayout>
      <div className="p-6 max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-sm text-muted-foreground mt-0.5">Your paper implementations</p>
          </div>
          <Button asChild>
            <Link href="/upload"><Upload className="mr-2 h-4 w-4" />Upload Paper</Link>
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
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
              <Card key={paper.paper_id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 flex items-center justify-between gap-4">
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
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
