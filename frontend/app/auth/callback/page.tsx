"use client";

import { useEffect } from "react";
import { Loader2 } from "lucide-react";

export default function AuthCallbackPage() {
  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.slice(1));
    const token = fragment.get("token");
    window.history.replaceState({}, document.title, "/auth/callback");

    if (!token) {
      window.location.replace("/");
      return;
    }

    localStorage.setItem("access_token", token);
    window.location.replace("/dashboard");
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
      <span className="ml-2 text-sm text-muted-foreground">Signing in…</span>
    </div>
  );
}
