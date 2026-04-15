"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { TopNav } from "@/components/layout/TopNav";
import { useAuth } from "@/contexts/AuthContext";

interface AppLayoutProps {
  children: React.ReactNode;
  /**
   * When true (default), unauthenticated users are redirected to /login.
   * Set to false for pages that allow anonymous trial access (upload, paper view).
   */
  requiresAuth?: boolean;
}

export default function AppLayout({ children, requiresAuth = true }: AppLayoutProps) {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (requiresAuth && !isLoading && !user) {
      router.replace("/login");
    }
  }, [isLoading, user, router, requiresAuth]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Auth-required pages: don't render anything while redirecting
  if (requiresAuth && !user) return null;

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar isTrial={!user} />
        <div className="flex-1 flex flex-col min-w-0">
          <TopNav />
          <main className="flex-1 overflow-auto">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
