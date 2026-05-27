"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadAndAnalyze, importFromArxiv, InsufficientCreditsError, RateLimitError } from "@/lib/paperApi";
import { Upload, FileText, Loader2, AlertCircle, Link2 } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Upload page ───────────────────────────────────────────────────────────────

type InputMode = "pdf" | "arxiv";

export default function UploadPage() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [mode, setMode] = useState<InputMode>("pdf");

  // PDF mode
  const [dragging, setDragging] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // arXiv mode
  const [arxivInput, setArxivInput] = useState("");

  // Shared
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ── PDF handlers ─────────────────────────────────────────────────────────────

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".pdf")) {
      setError("Only PDF files are supported.");
      return;
    }
    setError(null);
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handlePdfSubmit = async () => {
    if (!selectedFile) return;
    setUploading(true);
    setError(null);
    try {
      const { paper_id } = await uploadAndAnalyze(selectedFile);
      router.push(`/papers/${paper_id}`);
    } catch (err: unknown) {
      if (err instanceof InsufficientCreditsError) {
        router.push("/feedback");
        return;
      } else if (err instanceof RateLimitError) {
        const mins = Math.ceil(err.retryAfter / 60);
        setError(`Too many uploads. Please wait ${mins} minute${mins !== 1 ? "s" : ""} and try again.`);
      } else {
        setError(err instanceof Error ? err.message : "Upload failed. Please try again.");
      }
      setUploading(false);
    }
  };

  // ── arXiv handlers ────────────────────────────────────────────────────────────

  const handleArxivSubmit = async () => {
    const trimmed = arxivInput.trim();
    if (!trimmed) return;
    setUploading(true);
    setError(null);
    try {
      const { paper_id } = await importFromArxiv(trimmed);
      router.push(`/papers/${paper_id}`);
    } catch (err: unknown) {
      if (err instanceof InsufficientCreditsError) {
        router.push("/feedback");
        return;
      } else if (err instanceof RateLimitError) {
        const mins = Math.ceil(err.retryAfter / 60);
        setError(`Too many requests. Please wait ${mins} minute${mins !== 1 ? "s" : ""} and try again.`);
      } else {
        setError(err instanceof Error ? err.message : "Import failed. Please try again.");
      }
      setUploading(false);
    }
  };

  const switchMode = (m: InputMode) => {
    setMode(m);
    setError(null);
  };

  const canSubmit =
    !uploading &&
    (mode === "pdf" ? !!selectedFile : arxivInput.trim().length > 0);

  return (
    <AppLayout requiresAuth={true}>

      <div className="p-3 sm:p-6 max-w-2xl mx-auto">
        <div className="mb-5 sm:mb-6">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Upload Paper</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Upload a PDF or paste an arXiv link to get runnable PyTorch code.
          </p>
        </div>

        {/* Mode selector */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => switchMode("pdf")}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
              mode === "pdf"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
            )}
          >
            <Upload className="h-4 w-4" />
            Upload PDF
          </button>
          <button
            onClick={() => switchMode("arxiv")}
            className={cn(
              "flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
              mode === "arxiv"
                ? "border-primary bg-primary/10 text-primary"
                : "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
            )}
          >
            <Link2 className="h-4 w-4" />
            arXiv URL / ID
          </button>
        </div>

        <Card>
          {mode === "pdf" ? (
            <>
              <CardHeader>
                <CardTitle className="text-base">Upload PDF</CardTitle>
                <CardDescription>
                  Supports arXiv PDFs and published ML/AI papers. Max 50 MB.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Drop zone */}
                <div
                  className={cn(
                    "border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors",
                    dragging
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50 hover:bg-secondary/30",
                  )}
                  onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => inputRef.current?.click()}
                >
                  <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">{selectedFile.name}</span>
                      <span className="text-xs text-muted-foreground">
                        ({(selectedFile.size / 1024 / 1024).toFixed(1)} MB)
                      </span>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium">Drop your PDF here</p>
                      <p className="text-xs text-muted-foreground mt-1">or click to browse</p>
                    </>
                  )}
                  <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf"
                    className="hidden"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                  />
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <Button className="w-full" disabled={!canSubmit} onClick={handlePdfSubmit}>
                  {uploading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Uploading and analyzing...</>
                  ) : (
                    <><Upload className="mr-2 h-4 w-4" />Analyze Paper</>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  Analysis takes 30–90 seconds depending on paper complexity.
                </p>
              </CardContent>
            </>
          ) : (
            <>
              <CardHeader>
                <CardTitle className="text-base">Import from arXiv</CardTitle>
                <CardDescription>
                  Paste an arXiv URL, abstract link, or bare arXiv ID. The PDF is fetched automatically.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <Input
                    placeholder="e.g. https://arxiv.org/abs/1706.03762 or 1706.03762"
                    value={arxivInput}
                    onChange={(e) => { setArxivInput(e.target.value); setError(null); }}
                    onKeyDown={(e) => { if (e.key === "Enter" && canSubmit) handleArxivSubmit(); }}
                    disabled={uploading}
                    className="font-mono text-sm"
                  />
                  <p className="text-xs text-muted-foreground pl-0.5">
                    Accepted:{" "}
                    <span className="font-mono">arxiv.org/abs/XXXX.XXXXX</span>,{" "}
                    <span className="font-mono">arxiv.org/pdf/XXXX.XXXXX</span>, or{" "}
                    <span className="font-mono">XXXX.XXXXX</span>
                  </p>
                </div>

                {/* Quick examples */}
                <div className="flex flex-wrap gap-1.5">
                  {[
                    { label: "Attention Is All You Need", id: "1706.03762" },
                    { label: "BERT", id: "1810.04805" },
                    { label: "LoRA", id: "2106.09685" },
                  ].map(({ label, id }) => (
                    <button
                      key={id}
                      onClick={() => setArxivInput(id)}
                      className="rounded-full border border-border bg-secondary/40 px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {error && (
                  <div className="flex items-center gap-2 text-destructive text-sm">
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {error}
                  </div>
                )}

                <Button className="w-full" disabled={!canSubmit} onClick={handleArxivSubmit}>
                  {uploading ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Fetching from arXiv...</>
                  ) : (
                    <><Link2 className="mr-2 h-4 w-4" />Import & Analyze</>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center">
                  The PDF is fetched directly from arxiv.org. Analysis takes 30–90 seconds.
                </p>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </AppLayout>
  );
}
