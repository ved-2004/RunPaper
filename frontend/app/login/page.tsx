"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Cpu, ArrowRight } from "lucide-react";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
  }, [user, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="w-full max-w-sm px-6">
        {/* Logo */}
        <div className="flex flex-col items-center gap-4 mb-8">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary shadow-lg">
            <Cpu className="h-6 w-6 text-primary-foreground" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold tracking-tight">RunPaper</h1>
            <p className="text-sm text-muted-foreground mt-1">
              From paper to PyTorch in minutes
            </p>
          </div>
        </div>

        {/* Sign in card */}
        <div className="rounded-xl border border-border bg-card p-6 shadow-sm">
          <p className="text-sm text-center text-muted-foreground mb-5">
            Sign in to upload papers and generate code scaffolds
          </p>
          <div className="flex justify-center">
            <GoogleSignInButton />
          </div>
        </div>

        {/* Trial CTA */}
        <div className="mt-4 rounded-xl border border-dashed border-border bg-card/50 px-5 py-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Try it first</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              One free paper — no account needed
            </p>
          </div>
          <Button asChild size="sm" variant="outline" className="shrink-0 gap-1.5">
            <Link href="/upload">
              Upload a paper
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          By signing in, you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}
