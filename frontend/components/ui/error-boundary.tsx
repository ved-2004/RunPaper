"use client";

import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * React class ErrorBoundary.
 * Wraps sections that might crash (e.g. ReactFlow, KaTeX) so the whole
 * page doesn't white-screen. Reports to Sentry when DSN is configured.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <FlowchartTab ... />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
    // Report to Sentry if available
    if (typeof window !== "undefined" && process.env.NEXT_PUBLIC_SENTRY_DSN) {
      import("@sentry/nextjs").then(({ captureException }) => {
        captureException(error, { extra: { componentStack: info.componentStack } });
      }).catch(() => {});
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/20 bg-destructive/5 p-10 text-center">
          <AlertTriangle className="h-8 w-8 text-destructive/60" />
          <div>
            <p className="text-sm font-medium">Failed to render this section</p>
            <p className="text-xs text-muted-foreground mt-1">
              {this.state.error?.message || "An unexpected error occurred"}
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 mt-1"
            onClick={() => this.setState({ hasError: false, error: null })}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
