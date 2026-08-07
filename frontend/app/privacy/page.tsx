"use client";

import Link from "next/link";
import { Cpu } from "lucide-react";

const LAST_UPDATED = "August 6, 2026";
const CONTACT_EMAIL = "privacy@runpaper.app";

export default function PrivacyPage() {
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
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-12">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-10">Last updated: {LAST_UPDATED}</p>

        <div className="prose prose-sm dark:prose-invert max-w-none space-y-8 text-sm leading-relaxed text-foreground/90">

          <section>
            <h2 className="text-base font-semibold mb-3">1. What RunPaper does</h2>
            <p>
              RunPaper is a tool that lets you upload ML/AI research papers (PDFs) or supply an arXiv
              URL and receive a runnable Python code scaffold, reproducibility checklist, and
              interactive Q&amp;A about the paper. This privacy policy explains what data we collect,
              how we use it, and your rights.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">2. Data we collect</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Uploaded PDFs.</strong> When you upload a paper, the raw PDF bytes are stored
                temporarily in our cloud storage (Supabase Storage). Files are retained for up to 30
                days and then deleted automatically.
              </li>
              <li>
                <strong>Paper content.</strong> We process up to the first 60 pages and send up to
                40,000 characters of extracted text and up to five selected diagram images to our
                LLM providers to generate structured analysis, code scaffolds, and diagrams. We do
                not store the extracted source text as a separate database record.
              </li>
              <li>
                <strong>Account information.</strong> If you sign in with Google, we store your
                Google user ID, display name, email address, and profile picture URL in our database
                (Supabase PostgreSQL). This data is used solely to associate your papers with your
                account.
              </li>
              <li>
                <strong>Chat messages.</strong> Questions you ask in the Chat tab, together with a
                limited amount of recent chat history, are sent to an LLM provider for answering.
                RunPaper does not persist chat history in its database; it is held in the current
                browser page state.
              </li>
              <li>
                <strong>Usage logs.</strong> Our servers log the HTTP method, path, response status,
                and latency of each request (not request bodies). Application logs are retained
                according to our hosting configuration, generally for up to 30 days, and are used
                for debugging, performance monitoring, and abuse detection.
              </li>
              <li>
                <strong>Paper fingerprints and shared results.</strong> We calculate a SHA-256 hash
                of uploaded PDF bytes, or use the arXiv ID, to detect a paper that has already been
                processed. Generated analysis is stored in a shared cache and may be reused when
                another user submits the same paper. Other users do not receive your account details,
                original uploaded file, or chat messages.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">3. Third-party services</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Anthropic</strong> — We send paper text and chat messages to Anthropic&apos;s
                Claude API for analysis and code generation. Anthropic&apos;s{" "}
                <a href="https://www.anthropic.com/privacy" target="_blank" rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2">privacy policy</a> governs
                their handling of API data. By default, Anthropic does not train on API data.
              </li>
              <li>
                <strong>OpenAI</strong> — We use OpenAI&apos;s API for selected generation and validation
                steps. OpenAI&apos;s{" "}
                <a href="https://openai.com/policies/privacy-policy/" target="_blank" rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2">privacy policy</a> governs
                its handling of API data.
              </li>
              <li>
                <strong>Supabase</strong> — We use Supabase for database storage and file storage.
                Data is stored in the US (AWS us-east-1). See{" "}
                <a href="https://supabase.com/privacy" target="_blank" rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2">Supabase&apos;s privacy policy</a>.
              </li>
              <li>
                <strong>Google OAuth</strong> — Sign-in is handled by Google. We receive only the
                standard OpenID Connect profile (name, email, picture). Google&apos;s{" "}
                <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer"
                  className="text-primary underline underline-offset-2">privacy policy</a> applies to
                the OAuth flow.
              </li>
              <li>
                <strong>Sentry (optional)</strong> — If configured, we use Sentry for error
                monitoring. Error payloads may include stack traces and request metadata but never
                paper content.
              </li>
              <li>
                <strong>arXiv</strong> — When you import a paper via arXiv URL, we fetch the PDF
                from <code>arxiv.org</code> on your behalf. No personal data is sent to arXiv.
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">4. How we use your data</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>To generate code scaffolds, reproducibility checklists, and architecture diagrams for papers you submit.</li>
              <li>To authenticate you and associate papers with your account.</li>
              <li>To manage your credit balance and process feedback requests.</li>
              <li>To debug errors and detect abuse.</li>
            </ul>
            <p className="mt-2">
              We do not sell, rent, or share your data with third parties beyond the services listed
              above. We do not use your data for advertising.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">5. Data retention</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>Uploaded PDFs: deleted within 30 days of upload.</li>
              <li>Shared paper analysis results and fingerprints: retained as a reusable service cache with no fixed automatic deletion period.</li>
              <li>Account data: retained until you request deletion.</li>
              <li>Application logs: generally retained for up to 30 days, subject to hosting and security requirements.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">6. Your rights</h2>
            <p>
              You may request deletion of your account and account-associated data at any time by
              emailing us at{" "}
              <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary underline underline-offset-2">
                {CONTACT_EMAIL}
              </a>. We will respond within 30 days.
            </p>
            <p className="mt-2">
              You can remove individual papers from your dashboard at any time. This removes your
              account&apos;s link to the paper. The shared, de-identified analysis cache and paper
              fingerprint may remain so that RunPaper can avoid processing the same paper again.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">7. Security</h2>
            <p>
              Data at rest is encrypted by Supabase (AES-256). Data in transit is encrypted via
              TLS. We use short-lived signed URLs for PDF access. Our backend API rate-limits all
              requests to mitigate abuse. Nevertheless, no system is perfectly secure; please do
              not upload documents containing sensitive personal or confidential information.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">8. Children</h2>
            <p>
              RunPaper is not directed at children under 13. We do not knowingly collect personal
              information from children.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">9. Changes to this policy</h2>
            <p>
              We may update this policy from time to time. Material changes will be noted at the
              top of this page with a new &ldquo;Last updated&rdquo; date. Continued use of the
              service after changes constitutes acceptance of the revised policy.
            </p>
          </section>

          <section>
            <h2 className="text-base font-semibold mb-3">10. Contact</h2>
            <p>
              Questions about this privacy policy? Email us at{" "}
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
            <Link href="/privacy" className="hover:text-foreground transition-colors font-medium">Privacy</Link>
            <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
