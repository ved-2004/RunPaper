"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TexMath } from "@/components/ui/katex-math";
import { ExternalLink } from "lucide-react";
import type { PaperExtraction, FlowchartData } from "@/types/paper";
import { ExplainButton } from "@/components/runpaper/ExplainButton";

function datasetSearchUrl(name: string): string {
  return `https://paperswithcode.com/datasets?q=${encodeURIComponent(name)}`;
}

interface ExtractionTabProps {
  extraction: PaperExtraction;
  /** Required for the Explain buttons to work. */
  paperId?: string;
  flowchart?: FlowchartData | null;
}

export function ExtractionTab({ extraction, paperId, flowchart }: ExtractionTabProps) {
  const canExplain = !!paperId;
  const paperContext = {
    title: extraction.title ?? null,
    extraction,
    flowchart: flowchart ?? null,
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-bold leading-tight">{extraction.title || "Untitled"}</h2>
              <p className="text-sm text-muted-foreground mt-1">
                {extraction.authors?.join(", ")}
                {extraction.year ? ` · ${extraction.year}` : ""}
              </p>
            </div>
          </div>
          {extraction.core_contribution && (
            <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <p className="text-xs font-medium text-primary mb-1">Core Contribution</p>
              <p className="text-sm">{extraction.core_contribution}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Method */}
      {extraction.method && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Method Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {extraction.method.architecture && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Architecture</p>
                <p className="text-sm">{extraction.method.architecture}</p>
              </div>
            )}
            {extraction.method.loss_function && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Loss Function</p>
                <p className="text-sm">{extraction.method.loss_function}</p>
              </div>
            )}
            {extraction.method.training_procedure && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-1">Training Procedure</p>
                <p className="text-sm">{extraction.method.training_procedure}</p>
              </div>
            )}
            {extraction.method.key_equations?.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Key Equations</p>
                <div className="space-y-2">
                  {extraction.method.key_equations.map((eq, i) => (
                    <div
                      key={i}
                      className="group relative rounded-lg bg-muted px-4 py-3 overflow-x-auto"
                    >
                      <TexMath tex={eq} display />
                      {canExplain && (
                        <ExplainButton
                          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
                          paperId={paperId!}
                          paperContext={paperContext}
                          item={{
                            type: "equation",
                            label: `Equation ${i + 1}`,
                            content: eq,
                            context: `Key equation from ${extraction.title ?? "paper"}`,
                            chatPreload: `What does this equation mean: ${eq}?`,
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Hyperparameters */}
      {extraction.hyperparameters?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Hyperparameters</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4">Parameter</th>
                    <th className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4">Value</th>
                    <th className="text-left text-xs font-medium text-muted-foreground pb-2 pr-4">Source</th>
                    <th className="text-left text-xs font-medium text-muted-foreground pb-2">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {extraction.hyperparameters.map((hp, i) => (
                    <tr key={i} className="group">
                      <td className="py-2.5 pr-4 font-mono text-xs">{hp.name}</td>
                      <td className="py-2.5 pr-4 font-mono text-xs text-primary font-medium">{hp.value}</td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground whitespace-nowrap">{hp.source}</td>
                      <td className="py-2.5 text-xs text-muted-foreground">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="min-w-0">{hp.description ?? "—"}</span>
                          {canExplain && (
                            <ExplainButton
                              className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                              paperId={paperId!}
                              paperContext={paperContext}
                              item={{
                                type: "hyperparameter",
                                label: hp.name,
                                content: `Value: ${hp.value}.${hp.description ? ` ${hp.description}` : ""}`,
                                context: `From ${hp.source}`,
                                chatPreload: `Why is ${hp.name}=${hp.value} used in this paper?`,
                              }}
                            />
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Datasets */}
      {extraction.datasets?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Datasets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {extraction.datasets.map((ds, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30">
                <a
                  href={datasetSearchUrl(ds.name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  {ds.name}
                  <ExternalLink className="h-3 w-3" />
                </a>
                <span className="text-xs text-muted-foreground">{ds.split}</span>
                {ds.size && (
                  <span className="text-xs text-muted-foreground ml-auto">{ds.size}</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Ambiguities */}
      {extraction.ambiguities?.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-warning">Ambiguities / Missing Details</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1">
              {extraction.ambiguities.map((a, i) => (
                <li key={i} className="flex items-start gap-2 text-xs">
                  <span className="text-warning mt-0.5">⚠</span>
                  <span>{a}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
