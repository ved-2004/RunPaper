"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { submitFeedback } from "@/lib/paperApi";
import { Coins, CheckCircle2, Loader2 } from "lucide-react";

export default function FeedbackPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [form, setForm] = useState({
    name: user?.name ?? "",
    role: "",
    organization: "",
    why_credits: "",
    improvements: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = (field: string, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.role || !form.organization || !form.why_credits || !form.improvements) {
      setError("Please fill in all fields.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await submitFeedback(form);
      setSubmitted(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <AppLayout>
        <div className="p-3 sm:p-6 max-w-xl mx-auto">
          <Card>
            <CardContent className="pt-8 pb-8 flex flex-col items-center gap-4 text-center">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
              <div>
                <h2 className="text-lg font-semibold">Thanks for your feedback!</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  We review every submission personally. If your use-case is a good fit
                  we'll add more credits to your account and reach out at{" "}
                  <span className="font-medium text-foreground">{user?.email}</span>.
                </p>
              </div>
              <Button onClick={() => router.push("/dashboard")} className="mt-2">
                Back to my papers
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-3 sm:p-6 max-w-xl mx-auto space-y-5">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <Coins className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight">Get More Credits</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              You currently have{" "}
              <span className="font-semibold text-foreground">{user?.credits ?? 0} credit{(user?.credits ?? 0) !== 1 ? "s" : ""}</span>.
              Tell us about your work and we'll top you up.
            </p>
          </div>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">About you</CardTitle>
            <CardDescription>
              Help us understand how you're using RunPaper. We review every submission personally.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Name */}
              <div className="space-y-1.5">
                <Label htmlFor="name">Full name</Label>
                <Input
                  id="name"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="Your name"
                  required
                />
              </div>

              {/* Role */}
              <div className="space-y-1.5">
                <Label htmlFor="role">Role</Label>
                <Input
                  id="role"
                  value={form.role}
                  onChange={(e) => handleChange("role", e.target.value)}
                  placeholder="e.g. PhD Student, ML Engineer, Researcher"
                  required
                />
              </div>

              {/* Organization */}
              <div className="space-y-1.5">
                <Label htmlFor="organization">Organization / University</Label>
                <Input
                  id="organization"
                  value={form.organization}
                  onChange={(e) => handleChange("organization", e.target.value)}
                  placeholder="e.g. MIT, Google, independent"
                  required
                />
              </div>

              {/* Why credits */}
              <div className="space-y-1.5">
                <Label htmlFor="why_credits">
                  What are you using RunPaper for, and why do you need more credits?
                </Label>
                <Textarea
                  id="why_credits"
                  value={form.why_credits}
                  onChange={(e) => handleChange("why_credits", e.target.value)}
                  placeholder="I'm replicating experiments from NeurIPS 2024 papers for my thesis on…"
                  rows={3}
                  required
                />
              </div>

              {/* Improvements */}
              <div className="space-y-1.5">
                <Label htmlFor="improvements">
                  What would make RunPaper more useful for you?
                </Label>
                <Textarea
                  id="improvements"
                  value={form.improvements}
                  onChange={(e) => handleChange("improvements", e.target.value)}
                  placeholder="Better support for vision papers, export to HuggingFace format…"
                  rows={3}
                  required
                />
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <Button type="submit" disabled={submitting} className="w-full gap-2">
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Submitting…
                  </>
                ) : (
                  "Submit feedback"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
