"use client";

import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import {
  Cpu, ArrowRight, Upload, Workflow, Code2, GitCompare,
  MessageSquare, FileText, Zap, CheckCircle2, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ── Feature card ──────────────────────────────────────────────────────────────

function FeatureCard({
  icon: Icon, title, description, accent,
}: {
  icon: React.ElementType; title: string; description: string; accent: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", accent)}>
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// ── Step ──────────────────────────────────────────────────────────────────────

function Step({ n, title, description }: { n: number; title: string; description: string }) {
  return (
    <div className="flex gap-4">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
        {n}
      </div>
      <div className="pt-0.5">
        <p className="text-sm font-semibold">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const { user, isLoading } = useAuth();

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* ── Navbar ── */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Cpu className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold tracking-tight">RunPaper</span>
          </Link>

          <div className="flex items-center gap-3">
            {!isLoading && (
              user ? (
                <Button asChild size="sm">
                  <Link href="/dashboard">
                    Go to dashboard <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button asChild size="sm" variant="ghost">
                    <Link href="/login">Sign in</Link>
                  </Button>
                  <Button asChild size="sm">
                    <Link href="/upload">Try free</Link>
                  </Button>
                </>
              )
            )}
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="flex-1 flex flex-col items-center justify-center text-center px-6 pt-20 pb-16 max-w-4xl mx-auto w-full">
        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 py-1 text-xs font-medium text-muted-foreground mb-6">
          <Zap className="h-3 w-3 text-primary" />
          From paper to runnable code in 60–120 seconds
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight leading-[1.1] mb-5">
          Upload a paper.
          <br />
          <span className="text-primary">Run the code.</span>
        </h1>

        <p className="text-base sm:text-lg text-muted-foreground max-w-xl mx-auto leading-relaxed mb-8">
          RunPaper reads any ML research paper and gives you a complete Python scaffold —
          architecture, training loop, config — plus an interactive diagram and a reproducibility audit.
          No more reverse-engineering math into code.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3">
          {!isLoading && (
            user ? (
              <Button asChild size="lg" className="gap-2 text-base px-6">
                <Link href="/dashboard">
                  Go to my papers <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            ) : (
              <>
                <Button asChild size="lg" className="gap-2 text-base px-6">
                  <Link href="/upload">
                    <Upload className="h-4 w-4" />
                    Try free — no account needed
                  </Link>
                </Button>
                <GoogleSignInButton />
              </>
            )
          )}
        </div>

        <p className="text-xs text-muted-foreground mt-4">
          One free paper upload · No credit card · 60 second setup
        </p>
      </section>

      {/* ── How it works ── */}
      <section className="border-t border-border bg-secondary/20 py-14 px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-xl font-bold tracking-tight text-center mb-2">How it works</h2>
          <p className="text-sm text-muted-foreground text-center mb-10">
            Five AI pipelines run in parallel in the background
          </p>
          <div className="grid sm:grid-cols-1 gap-5 max-w-lg mx-auto">
            <Step n={1} title="Upload any ML paper PDF" description="arXiv papers, conference submissions, preprints — anything with text." />
            <Step n={2} title="AI extracts & generates" description="5-step pipeline: structure extraction → code scaffold → reproducibility audit → architecture flowchart → Q&A pairs. Takes 60–120 seconds." />
            <Step n={3} title="Explore, learn, and run" description="Interactive diagram, navigable code, PDF side-by-side, and a chat assistant — all grounded in your specific paper." />
          </div>
        </div>
      </section>

      {/* ── Features ── */}
      <section className="py-14 px-6">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-xl font-bold tracking-tight text-center mb-2">Everything in one place</h2>
          <p className="text-sm text-muted-foreground text-center mb-10">
            Six tabs. One uploaded PDF.
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <FeatureCard
              icon={Workflow}
              title="Learn — Architecture diagram"
              description="Interactive ReactFlow graph of the model's data flow. Click any node to see its math, description, and exact code snippet."
              accent="bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300"
            />
            <FeatureCard
              icon={Code2}
              title="Code — Runnable scaffold"
              description="model.py, train.py, config.yaml, requirements.txt — all generated from the paper. # TODO markers flag what the paper leaves ambiguous."
              accent="bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300"
            />
            <FeatureCard
              icon={FileText}
              title="Paper — Inline PDF"
              description="Original PDF rendered alongside your code and diagram. No more tab-switching between your browser and your editor."
              accent="bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300"
            />
            <FeatureCard
              icon={CheckCircle2}
              title="Extraction — Structured data"
              description="Title, authors, key equations (LaTeX rendered), hyperparameter table with descriptions, and clickable dataset links."
              accent="bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300"
            />
            <FeatureCard
              icon={GitCompare}
              title="Reproducibility — Audit"
              description="20-point checklist: ✅ specified in paper vs ❌ missing — with suggested defaults for everything underdefined."
              accent="bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300"
            />
            <FeatureCard
              icon={MessageSquare}
              title="Chat — Direct or Socratic"
              description="Ask questions grounded in the paper and code. Switch to Socratic mode and the AI guides your thinking instead of just answering."
              accent="bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300"
            />
          </div>
        </div>
      </section>

      {/* ── Differentiators ── */}
      <section className="border-t border-border bg-secondary/20 py-14 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-xl font-bold tracking-tight mb-2">Not just another paper reader</h2>
          <p className="text-sm text-muted-foreground mb-8">
            Most tools help you understand papers. RunPaper helps you <em>run</em> them.
          </p>
          <div className="grid sm:grid-cols-2 gap-3 text-left">
            {[
              ["Other tools", "Summarise, explain, search papers"],
              ["RunPaper", "Generate code you can actually execute"],
              ["Other tools", "Flat text answers to questions"],
              ["RunPaper", "Answers with code refs + flowchart nodes"],
              ["Other tools", "No reproducibility signal"],
              ["RunPaper", "20-point audit with suggested defaults"],
              ["Other tools", "Read the architecture in prose"],
              ["RunPaper", "Click through the architecture interactively"],
            ].reduce<React.ReactNode[]>((acc, [label, text], i) => {
              const isRunPaper = label === "RunPaper";
              acc.push(
                <div key={i} className={cn(
                  "rounded-lg px-4 py-3 text-sm",
                  isRunPaper
                    ? "bg-primary/10 border border-primary/20 font-medium"
                    : "bg-muted/50 text-muted-foreground line-through decoration-muted-foreground/40",
                )}>
                  <span className={cn("text-[10px] font-semibold uppercase tracking-wide mr-2", isRunPaper ? "text-primary" : "text-muted-foreground/60")}>
                    {label}
                  </span>
                  {text}
                </div>
              );
              return acc;
            }, [])}
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="py-16 px-6 text-center">
        <div className="max-w-lg mx-auto">
          <h2 className="text-2xl font-bold tracking-tight mb-3">
            Start with one paper — free
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            No account needed for your first upload. Sign in when you're ready for unlimited access.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="gap-2">
              <Link href="/upload">
                <Upload className="h-4 w-4" /> Upload a paper
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="gap-2">
              <Link href="/login">
                Sign in with Google <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-border py-6 px-6 text-center">
        <p className="text-xs text-muted-foreground">
          © 2026 RunPaper ·{" "}
          <a
            href="https://github.com/ved-2004/RunPaper"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground transition-colors"
          >
            Open source on GitHub
          </a>
        </p>
      </footer>
    </div>
  );
}
