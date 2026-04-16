"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";
import { getTrialId } from "@/lib/trial";
import { migrateTrialPapers } from "@/lib/paperApi";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { refetch } = useAuth();

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      router.replace("/");
      return;
    }

    localStorage.setItem("access_token", token);

    // Migrate any trial papers the user uploaded before signing in.
    // Fire-and-forget — we don't block navigation on this.
    const trialId = getTrialId();
    if (trialId) {
      migrateTrialPapers(trialId).then((count) => {
        if (count > 0) {
          console.info(`[RunPaper] Migrated ${count} trial paper(s) to account.`);
        }
      });
    }

    refetch().then(() => {
      router.replace("/dashboard");
    });
  }, [searchParams, router, refetch]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <span className="ml-2 text-sm text-muted-foreground">Signing in...</span>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}>
      <AuthCallbackInner />
    </Suspense>
  );
}
