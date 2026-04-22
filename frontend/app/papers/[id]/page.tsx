"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getPaper, getPdfUrl, downloadZip } from "@/lib/paperApi";
import type { PaperSummary } from "@/types/paper";
import AppLayout from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Loader2, AlertCircle, FileText, Code2, GitCompare,
  Workflow, FileIcon, PanelRight, X, MessageSquare, Download,
} from "lucide-react";
import { ExtractionTab } from "@/components/runpaper/ExtractionTab";
import { CodeTab } from "@/components/runpaper/CodeTab";
import { ReproducibilityTab } from "@/components/runpaper/ReproducibilityTab";
import { SanityBadge } from "@/components/runpaper/SanityBadge";
import { FlowchartTab } from "@/components/runpaper/FlowchartTab";
import { ChatTab } from "@/components/runpaper/ChatTab";
import { PaperPageSkeleton } from "@/components/runpaper/PaperPageSkeleton";
import { ErrorBoundary } from "@/components/ui/error-boundary";
import { cn } from "@/lib/utils";

// ── Still-processing placeholder for a single tab ────────────────────────────

function TabProcessing({ label }: { label: string }) {
  return (
    <Card>
      <CardContent className="py-12 text-center">
        <Loader2 className="h-7 w-7 mx-auto animate-spin text-primary mb-3" />
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-1">This will appear in a few seconds…</p>
      </CardContent>
    </Card>
  );
}

// ── PDF Viewer ────────────────────────────────────────────────────────────────

function PdfViewer({ paperId }: { paperId: string }) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["pdf-url", paperId],
    queryFn: () => getPdfUrl(paperId),
    staleTime: 50 * 60 * 1000, // 50 min (signed URL lasts 1h)
  });

  if (isLoading) return (
    <div className="flex items-center justify-center h-[75vh]">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
    </div>
  );

  if (error || !data) return (
    <div className="flex flex-col items-center justify-center h-[75vh] gap-2 text-sm text-muted-foreground">
      <FileIcon className="h-8 w-8" />
      <p>PDF not available.</p>
      <p className="text-xs">Upload via arXiv ID or ensure Supabase storage is configured.</p>
    </div>
  );

  return (
    <iframe
      src={data.url}
      className="w-full rounded-xl border border-border"
      style={{ height: "80vh" }}
      title="Research Paper PDF"
    />
  );
}

// ── Companion toggle button ───────────────────────────────────────────────────

type Companion = "none" | "code" | "paper";

function CompanionButton({
  active, onClick, icon: Icon, label,
}: { active: boolean; onClick: () => void; icon: React.ElementType; label: string }) {
  return (
    <Button
      size="sm"
      variant={active ? "default" : "outline"}
      className="gap-1.5 text-xs h-7"
      onClick={onClick}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </Button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function PaperPage() {
  const { id } = useParams<{ id: string }>();
  const [companion, setCompanion] = useState<Companion>("none");
  const [downloading, setDownloading] = useState(false);
  const queryClient = useQueryClient();

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await downloadZip(id);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `runpaper_${id}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  // Peek at the list cache so we know if this paper was already analyzed
  // before the full GET /api/papers/{id} call completes.
  const cachedSummary = (
    queryClient.getQueryData<PaperSummary[]>(["papers"]) ?? []
  ).find((p) => p.paper_id === id);
  const knownComplete = cachedSummary?.status === "complete";

  const { data: paper, isLoading, error } = useQuery({
    queryKey: ["paper", id],
    queryFn: () => getPaper(id),
    refetchInterval: (query) =>
      query.state.data?.status === "processing" ? 3000 : false,
    enabled: !!id,
  });

  const toggleCompanion = (val: Companion) =>
    setCompanion((c) => (c === val ? "none" : val));

  if (isLoading) {
    return (
      <AppLayout requiresAuth={false}>
        {knownComplete ? (
          /* Paper already analyzed — brief fetch from DB, no need for generic skeleton */
          <div className="p-3 sm:p-6 max-w-[1400px] mx-auto">
            <Card>
              <CardContent className="py-16 text-center">
                <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary mb-4" />
                <h3 className="text-sm font-medium">Loading from database…</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  This paper was already analyzed. Fetching your results.
                </p>
              </CardContent>
            </Card>
          </div>
        ) : (
          <PaperPageSkeleton />
        )}
      </AppLayout>
    );
  }

  return (
    <AppLayout requiresAuth={false}>
      <div className="p-3 sm:p-6 max-w-[1400px] mx-auto">
        {error ? (
          <Card>
            <CardContent className="py-16 text-center">
              <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-4" />
              <p className="text-sm font-medium">Failed to load paper</p>
            </CardContent>
          </Card>
        ) : paper?.status === "processing" && !paper.extraction ? (
          /* Extraction not yet done — show initial spinner */
          <Card>
            <CardContent className="py-16 text-center">
              <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary mb-4" />
              <h3 className="text-sm font-medium">Reading paper…</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Extracting structure and metadata. Usually done in ~40 seconds.
              </p>
            </CardContent>
          </Card>
        ) : paper?.status === "failed" ? (
          <Card>
            <CardContent className="py-16 text-center">
              <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-4" />
              <h3 className="text-sm font-medium">Analysis failed</h3>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
                {paper.error_message?.includes("timed out")
                  ? "The pipeline took too long and was stopped. This can happen with very large or complex PDFs. Please try uploading again."
                  : (paper.error_message || "An error occurred during analysis.")}
              </p>
              <Button asChild size="sm" variant="outline" className="mt-4">
                <a href="/upload">Try again</a>
              </Button>
            </CardContent>
          </Card>
        ) : paper?.extraction ? (
          <>
            {/* Paper header */}
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight line-clamp-2 sm:truncate">
                  {paper.extraction?.title || "Paper Results"}
                </h1>
                <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 line-clamp-2">
                  {paper.extraction?.authors?.slice(0, 3).join(", ")}
                  {(paper.extraction?.authors?.length ?? 0) > 3 ? " et al." : ""}
                  {paper.extraction?.year ? ` · ${paper.extraction.year}` : ""}
                </p>
                {paper.sanity_status && paper.sanity_status !== "pending" && (
                  <div className="mt-2">
                    <SanityBadge
                      status={paper.sanity_status}
                      details={paper.sanity_details}
                      variant="detailed"
                    />
                  </div>
                )}
              </div>
              {paper.status === "complete" && paper.code_scaffold && (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 gap-1.5"
                  onClick={handleDownload}
                  disabled={downloading}
                >
                  {downloading
                    ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    : <Download className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">Download code</span>
                </Button>
              )}
            </div>

            <Tabs defaultValue="learn">
              {/* Tabs scroll horizontally on mobile */}
              <div className="overflow-x-auto pb-1 -mx-3 sm:mx-0 px-3 sm:px-0">
                <TabsList className="mb-4 w-max sm:w-auto">
                  <TabsTrigger value="learn" className="gap-1.5">
                    <Workflow className="h-3.5 w-3.5" />
                    Learn
                  </TabsTrigger>
                  <TabsTrigger value="code" className="gap-1.5">
                    <Code2 className="h-3.5 w-3.5" />
                    Code
                  </TabsTrigger>
                  <TabsTrigger value="paper" className="gap-1.5">
                    <FileIcon className="h-3.5 w-3.5" />
                    Paper
                  </TabsTrigger>
                  <TabsTrigger value="extraction" className="gap-1.5">
                    <FileText className="h-3.5 w-3.5" />
                    Extraction
                  </TabsTrigger>
                  <TabsTrigger value="reproducibility" className="gap-1.5">
                    <GitCompare className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline">Reproducibility</span>
                    <span className="sm:hidden">Repro</span>
                  </TabsTrigger>
                  <TabsTrigger value="chat" className="gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Chat
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* ── Learn tab — flowchart + optional companion panel ── */}
              <TabsContent value="learn">
                {paper.status === "processing" && !paper.flowchart ? (
                  <TabProcessing label="Building architecture diagram…" />
                ) : paper.flowchart && paper.code_scaffold ? (
                  <>
                    {/* Companion controls — desktop only */}
                    <div className="hidden sm:flex items-center gap-2 mb-3">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <PanelRight className="h-3.5 w-3.5" /> Open alongside:
                      </span>
                      <CompanionButton
                        active={companion === "code"}
                        onClick={() => toggleCompanion("code")}
                        icon={Code2}
                        label="Code"
                      />
                      <CompanionButton
                        active={companion === "paper"}
                        onClick={() => toggleCompanion("paper")}
                        icon={FileIcon}
                        label="Paper"
                      />
                      {companion !== "none" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground"
                          onClick={() => setCompanion("none")}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>

                    {/* Split layout — companion stacks below on mobile */}
                    <div className={cn(
                      "flex gap-4",
                      companion !== "none" ? "flex-col sm:flex-row sm:items-start" : "flex-col",
                    )}>
                      {/* Flowchart */}
                      <div className={companion !== "none" ? "w-full sm:flex-1 sm:min-w-0" : "w-full"}>
                        <ErrorBoundary>
                          <FlowchartTab
                            flowchart={paper.flowchart}
                            scaffold={paper.code_scaffold}
                          />
                        </ErrorBoundary>
                      </div>

                      {/* Companion panel */}
                      {companion === "code" && (
                        <div className="w-full sm:w-[45%] sm:shrink-0">
                          <div className="rounded-xl border border-border bg-card p-4">
                            <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1">
                              <Code2 className="h-3.5 w-3.5" /> Code Scaffold
                            </p>
                            <CodeTab
                              scaffold={paper.code_scaffold}
                              paperId={id}
                              flowchart={paper.flowchart}
                              hasNotebook={!!paper.notebook_json}
                            />
                          </div>
                        </div>
                      )}

                      {companion === "paper" && (
                        <div className="w-full sm:w-[45%] sm:shrink-0">
                          <PdfViewer paperId={id} />
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center text-sm text-muted-foreground">
                      No architecture diagram available for this paper.
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* ── Code tab ── */}
              <TabsContent value="code">
                {paper.status === "processing" && !paper.code_scaffold ? (
                  <TabProcessing label="Generating code scaffold…" />
                ) : paper.code_scaffold ? (
                  <CodeTab
                    scaffold={paper.code_scaffold}
                    paperId={id}
                    flowchart={paper.flowchart}
                    hasNotebook={!!paper.notebook_json}
                  />
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <Code2 className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
                      <p className="text-sm font-medium">No code scaffold generated</p>
                      <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
                        The pipeline could not generate code for this paper. The extraction may still be available in the Extraction tab.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* ── Paper PDF tab ── */}
              <TabsContent value="paper">
                <PdfViewer paperId={id} />
              </TabsContent>

              {/* ── Extraction tab ── */}
              <TabsContent value="extraction">
                {paper.extraction ? (
                  <ExtractionTab extraction={paper.extraction} />
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <FileText className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
                      <p className="text-sm font-medium">No extraction data</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Paper metadata could not be extracted.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* ── Reproducibility tab ── */}
              <TabsContent value="reproducibility">
                {paper.status === "processing" && !paper.reproducibility ? (
                  <TabProcessing label="Analyzing reproducibility…" />
                ) : paper.reproducibility ? (
                  <ReproducibilityTab items={paper.reproducibility} />
                ) : (
                  <Card>
                    <CardContent className="py-12 text-center">
                      <GitCompare className="h-8 w-8 mx-auto text-muted-foreground/40 mb-3" />
                      <p className="text-sm font-medium">No reproducibility checklist</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Could not analyze reproducibility for this paper.
                      </p>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* ── Chat tab ── */}
              <TabsContent value="chat">
                <ErrorBoundary>
                  <ChatTab paperId={id} status={paper.status} />
                </ErrorBoundary>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}
