"use client";

import Link from "next/link";
import { Cpu } from "lucide-react";

const LAST_UPDATED = "April 15, 2025";
const CONTACT_EMAIL = "hello@runpaper.app";

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Simple top nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-3xl mx-auto px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <Cpu className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="text-sm font-semibold">RunPaper</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm text-muted-foreground">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed text-foreground/90">

          <section>
            <h2 className="text-base font-semibold mb-3">1. Acceptance of terms</h2>
            <p>
              By accessing or using RunPaper (&ldquo;the Service&rdquo;), you agree to be bound by
              these Terms of Service. If you do not agree, do not use the Service.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">2. What RunPaper provides</h2>
            <p>
              RunPaper is a research tool that processes ML/AI research paper PDFs using large
              language models (LLMs) to generate: structured paper summaries, Python code scaffolds,
              reproducibility checklists, architecture diagrams, and Q&amp;A responses.
            </p>
            <p className="mt-2">
              <strong>Generated code is a starting point, not production-ready software.</strong>{" "}
              All generated code should be reviewed, tested, and validated before use. RunPaper does
              not guarantee the correctness, completeness, or fitness for purpose of any generated
              output.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">3. Free trial</h2>
            <p>
              Unregistered users may process one paper for free. After the free trial, a Google
              account is required to continue using the Service. We reserve the right to modify or
              discontinue the free trial at any time.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">4. Acceptable use</h2>
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Upload documents that infringe third-party intellectual property rights.</li>
              <li>Upload documents containing personal data of others without their consent.</li>
              <li>Attempt to reverse-engineer, scrape, or circumvent any security measures.</li>
              <li>Use the Service for any unlawful purpose.</li>
              <li>Abuse the free trial (e.g., creating multiple accounts to bypass limits).</li>
              <li>Upload documents exceeding 50 MB or that are not PDF files.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">5. Your content</h2>
            <p>
              You retain all rights to documents you upload. By uploading a document, you grant
              RunPaper a limited, non-exclusive licence to process the document solely for the
              purpose of providing the Service to you.
            </p>
            <p className="mt-2">
              You represent that you have the right to upload documents you submit (e.g., the paper
              is publicly available, you are the author, or you have a licence to process it). If
              you upload an arXiv paper via URL, note that arXiv papers are generally available
              under their respective licences (often CC BY or similar).
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">6. Intellectual property of outputs</h2>
            <p>
              Generated code scaffolds, analysis summaries, and other outputs produced by RunPaper
              are provided to you for your use. We make no claim of ownership over generated outputs.
              However, because outputs are generated by LLMs based on your input, you should not
              assume outputs are free of third-party rights; verify independently if required.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">7. Disclaimers</h2>
            <p>
              THE SERVICE IS PROVIDED &ldquo;AS IS&rdquo; WITHOUT WARRANTIES OF ANY KIND, EXPRESS
              OR IMPLIED, INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A
              PARTICULAR PURPOSE, OR NON-INFRINGEMENT. WE DO NOT WARRANT THAT:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Generated code is correct, complete, or free of bugs.</li>
              <li>Extracted paper data is accurate or complete.</li>
              <li>The Service will be available without interruption.</li>
              <li>Results will reproduce the paper&apos;s reported metrics.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">8. Limitation of liability</h2>
            <p>
              TO THE MAXIMUM EXTENT PERMITTED BY LAW, RUNPAPER SHALL NOT BE LIABLE FOR ANY
              INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF OR
              RELATED TO YOUR USE OF THE SERVICE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH
              DAMAGES. OUR TOTAL LIABILITY SHALL NOT EXCEED $10 USD.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">9. Third-party services</h2>
            <p>
              The Service integrates with third-party services (Anthropic, Supabase, Google, arXiv).
              Your use of those services is subject to their respective terms and policies. We are
              not responsible for any third-party service&apos;s actions, availability, or data
              handling.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">10. Termination</h2>
            <p>
              We reserve the right to suspend or terminate your access to the Service at any time
              for violations of these Terms or for any other reason at our sole discretion.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">11. Changes to these terms</h2>
            <p>
              We may update these Terms at any time. Material changes will be reflected in the
              &ldquo;Last updated&rdquo; date at the top. Continued use of the Service constitutes
              acceptance of the updated Terms.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">12. Governing law</h2>
            <p>
              These Terms are governed by the laws of the State of California, USA, without regard
              to conflict-of-law principles.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">13. Contact</h2>
            <p>
              Questions about these Terms? Email us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">
                {CONTACT_EMAIL}
              </a>.
            </p>
          </section>

        </div>
      </main>

      <footer className="border-t border-border mt-12 py-6">
        <div className="max-w-3xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground">
          <span>© {new Date().getFullYear()} RunPaper</span>
          <div className="flex gap-4">
            <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors font-medium">Terms</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
