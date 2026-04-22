"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Download, FileText, ChevronRight, BookOpen, LayoutGrid, NotebookPen } from "lucide-react";
import type { CodeScaffold, FlowchartData } from "@/types/paper";
import { downloadZip, downloadNotebook } from "@/lib/paperApi";
import SyntaxHighlighter from "react-syntax-highlighter";
import { githubGist } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { cn } from "@/lib/utils";

const FILES: { key: keyof CodeScaffold; label: string; lang: string }[] = [
  { key: "model_py",        label: "model.py",        lang: "python" },
  { key: "train_py",        label: "train.py",         lang: "python" },
  { key: "config_yaml",     label: "config.yaml",      lang: "yaml"   },
  { key: "requirements_txt",label: "requirements.txt", lang: "text"   },
];

const FILE_ANNOTATION_KEYS: Record<keyof CodeScaffold, string> = {
  model_py:         "model.py",
  train_py:         "train.py",
  config_yaml:      "config.yaml",
  requirements_txt: "requirements.txt",
};

function extractSnippet(code: string, signature: string, maxLines = 40): string {
  const lines = code.split("\n");
  const idx = lines.findIndex((l) => l.includes(signature.trim().split("(")[0].trim()));
  if (idx === -1) return code; // fall back to full file
  return lines.slice(idx, Math.min(lines.length, idx + maxLines)).join("\n");
}

interface CodeTabProps {
  scaffold: CodeScaffold;
  paperId: string;
  flowchart?: FlowchartData | null;
  hasNotebook?: boolean;
}

export function CodeTab({ scaffold, paperId, flowchart, hasNotebook }: CodeTabProps) {
  const [activeFile, setActiveFile] = useState<keyof CodeScaffold>("model_py");
  const [selectedFn, setSelectedFn] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);
  const [downloadingNb, setDownloadingNb] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const blob = await downloadZip(paperId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `runpaper_${paperId}.zip`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadNotebook = async () => {
    setDownloadingNb(true);
    try {
      const { blob, filename } = await downloadNotebook(paperId);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setDownloadingNb(false);
    }
  };

  const currentFile = FILES.find((f) => f.key === activeFile)!;
  const fullCode = scaffold[activeFile];

  // Annotations for the current file
  const annotationKey = FILE_ANNOTATION_KEYS[activeFile];
  const fileAnnotations = flowchart?.annotations?.[annotationKey];
  const functions = fileAnnotations?.functions ?? [];

  // Code to display: if a function is selected, show just its snippet
  const selectedFnMeta = functions.find((f) => f.name === selectedFn);
  const displayCode = selectedFnMeta
    ? extractSnippet(fullCode, selectedFnMeta.signature)
    : fullCode;

  const showSidebar = functions.length > 0;

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Runnable Python scaffold generated from the paper.{" "}
          <span className="text-amber-600"># TODO markers flag ambiguities.</span>
        </p>
        <div className="flex items-center gap-2">
          {hasNotebook && (
            <Button
              size="sm"
              variant="default"
              onClick={handleDownloadNotebook}
              disabled={downloadingNb}
              title="Download .ipynb — open in Google Colab or Jupyter"
            >
              <NotebookPen className="mr-1.5 h-3.5 w-3.5" />
              {downloadingNb ? "Preparing…" : "Run in Colab"}
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            {downloading ? "Downloading…" : "Download .zip"}
          </Button>
        </div>
      </div>

      <div className="flex gap-3">
        {/* ── Left: file tree ── */}
        <div className="w-40 shrink-0 space-y-0.5">
          <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground px-2 mb-1.5">Files</p>
          {FILES.map((f) => (
            <button
              key={f.key}
              onClick={() => { setActiveFile(f.key); setSelectedFn(null); }}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-xs text-left transition-colors",
                activeFile === f.key
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-secondary/50",
              )}
            >
              <FileText className="h-3 w-3 shrink-0" />
              {f.label}
            </button>
          ))}
        </div>

        {/* ── Middle: function navigator (only for py files with annotations) ── */}
        {showSidebar && (
          <div className="w-52 shrink-0 rounded-xl border border-border bg-card overflow-hidden flex flex-col">
            <div className="px-3 py-2 border-b border-border bg-secondary/30">
              <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <LayoutGrid className="h-3 w-3" /> Navigator
              </p>
              {fileAnnotations?.overview && (
                <p className="text-[10px] text-muted-foreground mt-1 leading-tight line-clamp-2">
                  {fileAnnotations.overview}
                </p>
              )}
            </div>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-0.5">
                {/* "Full file" option */}
                <button
                  onClick={() => setSelectedFn(null)}
                  className={cn(
                    "w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-left text-xs transition-colors",
                    selectedFn === null
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-secondary/50",
                  )}
                >
                  <BookOpen className="h-3 w-3 shrink-0" />
                  Full file
                </button>
                <Separator className="my-1" />
                {functions.map((fn) => (
                  <button
                    key={fn.name}
                    onClick={() => setSelectedFn(fn.name === selectedFn ? null : fn.name)}
                    className={cn(
                      "w-full flex items-start gap-1.5 px-2 py-1.5 rounded text-left text-xs transition-colors",
                      selectedFn === fn.name
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-muted-foreground hover:bg-secondary/50",
                    )}
                  >
                    <ChevronRight className="h-3 w-3 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="font-mono truncate text-[10px]">{fn.name}</p>
                      {fn.component_id && (
                        <Badge variant="secondary" className="mt-0.5 text-[9px] h-4 px-1">
                          {fn.component_id.replaceAll("_", " ")}
                        </Badge>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* ── Right: code viewer ── */}
        <Card className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/30">
            <span className="text-xs font-mono text-muted-foreground">
              {currentFile.label}
              {selectedFnMeta && (
                <span className="text-primary ml-2">→ {selectedFnMeta.name}</span>
              )}
            </span>
            {selectedFnMeta && (
              <p className="text-[10px] text-muted-foreground max-w-[300px] truncate">
                {selectedFnMeta.explanation}
              </p>
            )}
          </div>
          <CardContent className="p-0 overflow-auto max-h-[580px]">
            <SyntaxHighlighter
              language={currentFile.lang}
              style={githubGist}
              customStyle={{ margin: 0, fontSize: "12px", background: "transparent", padding: "16px" }}
              wrapLines
              lineProps={(lineNumber) => {
                const line = displayCode.split("\n")[lineNumber - 1] || "";
                if (line.includes("# TODO")) {
                  return { style: { backgroundColor: "rgb(255, 251, 235)" } };
                }
                return {};
              }}
            >
              {displayCode}
            </SyntaxHighlighter>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
