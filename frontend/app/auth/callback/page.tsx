"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Suspense } from "react";
import { getTrialId } from "@/lib/trial";
import { migrateTrialPapers } from "@/lib/paperApi";

function AuthCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const token = searchParams.get("token");
    if (!token) {
      router.replace("/");
      return;
    }

    // Store token — AuthContext will pick it up on the next page render
    localStorage.setItem("access_token", token);

    // Migrate any trial papers (fire-and-forget)
    const trialId = getTrialId();
    if (trialId) {
      migrateTrialPapers(trialId).catch(() => {});
    }

    // Go straight to dashboard — AppLayout will verify auth via /auth/me
    router.replace("/dashboard");
  }, [searchParams, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <span className="ml-2 text-sm text-muted-foreground">Signing in…</span>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    }>
      <AuthCallbackInner />
    </Suspense>
  );
}
