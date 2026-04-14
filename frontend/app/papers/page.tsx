"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// Redirect /papers → /dashboard which lists all papers
export default function PapersIndexPage() {
  const router = useRouter();
  useEffect(() => { router.replace("/dashboard"); }, [router]);
  return null;
}
