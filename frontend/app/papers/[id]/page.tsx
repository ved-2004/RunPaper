"use client";

import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { getPaper } from "@/lib/paperApi";
import AppLayout from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, AlertCircle, FileText, Code2, GitCompare } from "lucide-react";
import { ExtractionTab } from "@/components/runpaper/ExtractionTab";
import { CodeTab } from "@/components/runpaper/CodeTab";
import { ReproducibilityTab } from "@/components/runpaper/ReproducibilityTab";

export default function PaperPage() {
  const { id } = useParams<{ id: string }>();

  const { data: paper, isLoading, error } = useQuery({
    queryKey: ["paper", id],
    queryFn: () => getPaper(id),
    // Poll every 3s while processing
    refetchInterval: (query) =>
      query.state.data?.status === "processing" ? 3000 : false,
    enabled: !!id,
  });

  return (
    <AppLayout>
      <div className="p-6 max-w-6xl mx-auto">
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
                Extracting structure, generating code, and running reproducibility check.
                This takes 30–90 seconds.
              </p>
            </CardContent>
          </Card>
        ) : paper?.status === "failed" ? (
          <Card>
            <CardContent className="py-16 text-center">
              <AlertCircle className="h-10 w-10 mx-auto text-destructive mb-4" />
              <h3 className="text-sm font-medium">Analysis failed</h3>
              <p className="text-xs text-muted-foreground mt-1">{paper.error_message || "An error occurred during analysis."}</p>
            </CardContent>
          </Card>
        ) : paper ? (
          <>
            <div className="mb-6">
              <h1 className="text-xl font-bold tracking-tight truncate">
                {paper.extraction?.title || "Paper Results"}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {paper.extraction?.authors?.slice(0, 3).join(", ")}
                {(paper.extraction?.authors?.length ?? 0) > 3 ? " et al." : ""}
                {paper.extraction?.year ? ` · ${paper.extraction.year}` : ""}
              </p>
            </div>

            <Tabs defaultValue="extraction">
              <TabsList className="mb-4">
                <TabsTrigger value="extraction" className="gap-1.5">
                  <FileText className="h-3.5 w-3.5" />
                  Extraction
                </TabsTrigger>
                <TabsTrigger value="code" className="gap-1.5">
                  <Code2 className="h-3.5 w-3.5" />
                  Code
                </TabsTrigger>
                <TabsTrigger value="reproducibility" className="gap-1.5">
                  <GitCompare className="h-3.5 w-3.5" />
                  Reproducibility
                </TabsTrigger>
              </TabsList>

              <TabsContent value="extraction">
                {paper.extraction ? (
                  <ExtractionTab extraction={paper.extraction} />
                ) : (
                  <p className="text-sm text-muted-foreground">No extraction data.</p>
                )}
              </TabsContent>

              <TabsContent value="code">
                {paper.code_scaffold ? (
                  <CodeTab scaffold={paper.code_scaffold} paperId={id} />
                ) : (
                  <p className="text-sm text-muted-foreground">No code scaffold generated.</p>
                )}
              </TabsContent>

              <TabsContent value="reproducibility">
                {paper.reproducibility ? (
                  <ReproducibilityTab items={paper.reproducibility} />
                ) : (
                  <p className="text-sm text-muted-foreground">No reproducibility data.</p>
                )}
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </div>
    </AppLayout>
  );
}
