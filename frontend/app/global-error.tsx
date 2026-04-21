"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
      // Dynamically import Sentry only when DSN is configured,
      // so dev without Sentry doesn't trigger OpenTelemetry warnings.
      import("@sentry/nextjs").then((Sentry) => {
        Sentry.captureException(error);
      });
    }
    console.error("Global error:", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex items-center justify-center bg-background p-6">
          <div className="max-w-sm w-full text-center space-y-4">
            <div className="flex justify-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
            </div>
            <h1 className="text-lg font-semibold">Something went wrong</h1>
            <p className="text-sm text-muted-foreground">
              An unexpected error occurred. The team has been notified.
            </p>
            {error.digest && (
              <p className="text-xs text-muted-foreground/60 font-mono">
                Error ID: {error.digest}
              </p>
            )}
            <div className="flex gap-2 justify-center">
              <Button onClick={reset} size="sm">Try again</Button>
              <Button variant="outline" size="sm" onClick={() => window.location.href = "/"}>
                Go home
              </Button>
            </div>
          </div>
        </div>
      </body>
    </html>
  );
}
