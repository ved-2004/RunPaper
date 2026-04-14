"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { PaperExtraction } from "@/types/paper";

export function ExtractionTab({ extraction }: { extraction: PaperExtraction }) {
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
                <p className="text-xs font-medium text-muted-foreground mb-1">Key Equations</p>
                <div className="space-y-1">
                  {extraction.method.key_equations.map((eq, i) => (
                    <code key={i} className="block text-xs bg-muted px-2 py-1 rounded font-mono">{eq}</code>
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
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-medium text-muted-foreground pb-2">Parameter</th>
                  <th className="text-left text-xs font-medium text-muted-foreground pb-2">Value</th>
                  <th className="text-left text-xs font-medium text-muted-foreground pb-2">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {extraction.hyperparameters.map((hp, i) => (
                  <tr key={i}>
                    <td className="py-2 font-mono text-xs">{hp.name}</td>
                    <td className="py-2 font-mono text-xs text-primary">{hp.value}</td>
                    <td className="py-2 text-xs text-muted-foreground">{hp.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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
              <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-secondary/30">
                <Badge variant="secondary" className="text-xs">{ds.name}</Badge>
                <span className="text-xs text-muted-foreground">{ds.split}</span>
                {ds.size && <span className="text-xs text-muted-foreground ml-auto">{ds.size}</span>}
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
