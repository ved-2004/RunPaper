"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getPaper, getPdfUrl, downloadZip } from "@/lib/paperApi";
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
import { FlowchartTab } from "@/components/runpaper/FlowchartTab";
import { ChatTab } from "@/components/runpaper/ChatTab";
import { cn } from "@/lib/utils";

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

  const { data: paper, isLoading, error } = useQuery({
    queryKey: ["paper", id],
    queryFn: () => getPaper(id),
    refetchInterval: (query) =>
      query.state.data?.status === "processing" ? 3000 : false,
    enabled: !!id,
  });

  const toggleCompanion = (val: Companion) =>
    setCompanion((c) => (c === val ? "none" : val));

  return (
    <AppLayout requiresAuth={false}>
      <div className="p-6 max-w-[1400px] mx-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-16 text-center">
              <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-4" />
              <p className="text-sm font-medium">Failed to load paper</p>
            </CardContent>
          </Card>
        ) : paper?.status === "processing" ? (
          <Card>
            <CardContent className="py-16 text-center">
              <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary mb-4" />
              <h3 className="text-sm font-medium">Analyzing paper...</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Extracting structure, generating code, building architecture diagram.
                This takes 60–120 seconds.
              </p>
            </CardContent>
          </Card>
        ) : paper?.status === "failed" ? (
          <Card>
            <CardContent className="py-16 text-center">
              <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-4" />
              <h3 className="text-sm font-medium">Analysis failed</h3>
              <p className="text-xs text-muted-foreground mt-1">
                {paper.error_message || "An error occurred during analysis."}
              </p>
            </CardContent>
          </Card>
        ) : paper ? (
          <>
            {/* Paper header */}
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h1 className="text-xl font-bold tracking-tight truncate">
                  {paper.extraction?.title || "Paper Results"}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {paper.extraction?.authors?.slice(0, 3).join(", ")}
                  {(paper.extraction?.authors?.length ?? 0) > 3 ? " et al." : ""}
                  {paper.extraction?.year ? ` · ${paper.extraction.year}` : ""}
                </p>
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
                  Download code
                </Button>
              )}
            </div>

            <Tabs defaultValue="learn">
              <TabsList className="mb-4">
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
                  Reproducibility
                </TabsTrigger>
                <TabsTrigger value="chat" className="gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Chat
                </TabsTrigger>
              </TabsList>

              {/* ── Learn tab — flowchart + optional companion panel ── */}
              <TabsContent value="learn">
                {paper.flowchart && paper.code_scaffold ? (
                  <>
                    {/* Companion controls */}
                    <div className="flex items-center gap-2 mb-3">
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

                    {/* Split layout */}
                    <div className={cn("flex gap-4", companion !== "none" && "items-start")}>
                      {/* Flowchart */}
                      <div className={companion !== "none" ? "flex-1 min-w-0" : "w-full"}>
                        <FlowchartTab
                          flowchart={paper.flowchart}
                          scaffold={paper.code_scaffold}
                        />
                      </div>

                      {/* Companion panel */}
                      {companion === "code" && (
                        <div className="w-[45%] shrink-0">
                          <div className="rounded-xl border border-border bg-card p-4">
                            <p className="text-xs font-medium text-muted-foreground mb-3 flex items-center gap-1">
                              <Code2 className="h-3.5 w-3.5" /> Code Scaffold
                            </p>
                            <CodeTab
                              scaffold={paper.code_scaffold}
                              paperId={id}
                              flowchart={paper.flowchart}
                            />
                          </div>
                        </div>
                      )}

                      {companion === "paper" && (
                        <div className="w-[45%] shrink-0">
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
                {paper.code_scaffold ? (
                  <CodeTab
                    scaffold={paper.code_scaffold}
                    paperId={id}
                    flowchart={paper.flowchart}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">No code scaffold generated.</p>
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
                  <p className="text-sm text-muted-foreground">No extraction data.</p>
                )}
              </TabsContent>

              {/* ── Reproducibility tab ── */}
              <TabsContent value="reproducibility">
                {paper.reproducibility ? (
                  <ReproducibilityTab items={paper.reproducibility} />
                ) : (
                  <p className="text-sm text-muted-foreground">No reproducibility data.</p>
                )}
              </TabsContent>

              {/* ── Chat tab ── */}
              <TabsContent value="chat">
                <ChatTab paperId={id} />
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}
