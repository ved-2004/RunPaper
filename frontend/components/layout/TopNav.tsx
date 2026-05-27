"use client";

import { Bell, Moon, Sun, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";
import { useTheme } from "next-themes";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const routeNames: Record<string, string> = {
  "/dashboard": "My Papers",
  "/upload": "Upload Paper",
  "/settings": "Settings",
};

export function TopNav() {
  const { theme, setTheme } = useTheme();
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const currentRoute =
    routeNames[pathname] ||
    (pathname.startsWith("/papers/") ? "Paper Results" : "Dashboard");

  return (
    <header className="flex h-14 items-center gap-3 border-b border-border bg-card/50 px-4">
      <SidebarTrigger className="h-8 w-8" />
      <Separator orientation="vertical" className="h-5" />

      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink href="/" className="text-xs text-muted-foreground">
              RunPaper
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="text-xs font-medium">{currentRoute}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex-1" />

      {/* Credits chip — only shown for signed-in users */}
      {user && (
        <button
          onClick={() => router.push("/feedback")}
          title="Click to get more credits"
          className="flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
        >
          <Coins className="h-3.5 w-3.5 text-primary" />
          <span>{user.credits ?? 0}</span>
          <span className="text-muted-foreground hidden sm:inline">credits</span>
        </button>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      >
        <Sun className="h-4 w-4 rotate-0 scale-100 transition-transform dark:-rotate-90 dark:scale-0" />
        <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-transform dark:rotate-0 dark:scale-100" />
      </Button>

      <Button variant="ghost" size="icon" className="hidden sm:flex h-8 w-8 relative">
        <Bell className="h-4 w-4" />
        <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary" />
      </Button>

    </header>
  );
}
