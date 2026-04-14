"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Download, FileText } from "lucide-react";
import type { CodeScaffold } from "@/types/paper";
import { downloadZip } from "@/lib/paperApi";
import SyntaxHighlighter from "react-syntax-highlighter";
import { githubGist } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { cn } from "@/lib/utils";

const FILES: { key: keyof CodeScaffold; label: string; lang: string }[] = [
  { key: "model_py", label: "model.py", lang: "python" },
  { key: "train_py", label: "train.py", lang: "python" },
  { key: "config_yaml", label: "config.yaml", lang: "yaml" },
  { key: "requirements_txt", label: "requirements.txt", lang: "text" },
];

export function CodeTab({ scaffold, paperId }: { scaffold: CodeScaffold; paperId: string }) {
  const [activeFile, setActiveFile] = useState<keyof CodeScaffold>("model_py");
  const [downloading, setDownloading] = useState(false);

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

  const currentFile = FILES.find((f) => f.key === activeFile)!;
  const code = scaffold[activeFile];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Runnable Python implementation scaffold generated from the paper.
          <span className="text-amber-600 ml-1">Lines with # TODO mark ambiguities.</span>
        </p>
        <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading}>
          <Download className="mr-2 h-4 w-4" />
          {downloading ? "Downloading..." : "Download .zip"}
        </Button>
      </div>

      <div className="flex gap-4">
        {/* File tree */}
        <div className="w-44 shrink-0 space-y-1">
          {FILES.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveFile(f.key)}
              className={cn(
                "w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-left transition-colors",
                activeFile === f.key
                  ? "bg-primary/10 text-primary font-medium"
                  : "text-muted-foreground hover:bg-secondary/50",
              )}
            >
              <FileText className="h-3.5 w-3.5 shrink-0" />
              {f.label}
            </button>
          ))}
        </div>

        {/* Code viewer */}
        <Card className="flex-1 min-w-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-secondary/30">
            <span className="text-xs font-mono text-muted-foreground">{currentFile.label}</span>
          </div>
          <CardContent className="p-0 overflow-auto max-h-[600px]">
            <SyntaxHighlighter
              language={currentFile.lang}
              style={githubGist}
              customStyle={{ margin: 0, fontSize: "12px", background: "transparent", padding: "16px" }}
              wrapLines
              lineProps={(lineNumber) => {
                const line = code.split("\n")[lineNumber - 1] || "";
                if (line.includes("# TODO")) {
                  return { style: { backgroundColor: "rgb(255, 251, 235)" } };
                }
                return {};
              }}
            >
              {code}
            </SyntaxHighlighter>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
