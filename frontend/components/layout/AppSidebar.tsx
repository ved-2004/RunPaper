"use client";

import { BarChart3, Settings, Upload, FileText, Cpu, LogIn, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

const mainNav = [
  { title: "Dashboard", url: "/dashboard", icon: BarChart3 },
];

const workflowNav = [
  { title: "Upload Paper", url: "/upload", icon: Upload },
  { title: "My Papers", url: "/papers", icon: FileText },
];

const systemNav = [
  { title: "Settings", url: "/settings", icon: Settings },
];

function NavItem({ url, title, icon: Icon }: { url: string; title: string; icon: React.ElementType }) {
  const pathname = usePathname();
  const isActive = pathname === url || (url !== "/" && pathname.startsWith(url));

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild>
        <Link
          href={url}
          className={cn(
            "hover:bg-sidebar-accent/80",
            isActive && "bg-sidebar-accent text-sidebar-accent-foreground font-medium",
          )}
        >
          <Icon className="mr-2 h-4 w-4" />
          <span>{title}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

interface AppSidebarProps {
  /** True when the user is not signed in (trial / anonymous mode). */
  isTrial?: boolean;
}

export function AppSidebar({ isTrial = false }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <Link href="/" className="flex items-center gap-2.5 px-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary">
            <Cpu className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="text-sm font-semibold tracking-tight text-foreground">RunPaper</span>
              <span className="text-[10px] text-muted-foreground">From paper to PyTorch</span>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent>
        {isTrial ? (
          /* Trial mode — only show Upload */
          <SidebarGroup>
            <SidebarGroupLabel>Try it free</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                <NavItem url="/upload" title="Upload Paper" icon={Upload} />
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ) : (
          /* Signed-in — full nav */
          <>
            <SidebarGroup>
              <SidebarGroupLabel>Workspace</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {mainNav.map((item) => <NavItem key={item.url} {...item} />)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>Papers</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {workflowNav.map((item) => <NavItem key={item.url} {...item} />)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupLabel>System</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {systemNav.map((item) => <NavItem key={item.url} {...item} />)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      <SidebarFooter className="p-3">
        {isTrial ? (
          /* Trial — Sign in CTA */
          <Link
            href="/login"
            className={cn(
              "flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium",
              "bg-primary/10 text-primary hover:bg-primary/20 transition-colors",
              collapsed && "justify-center px-0",
            )}
          >
            <LogIn className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Sign in for more</span>}
          </Link>
        ) : user ? (
          /* Signed-in — user chip + logout */
          <div className={cn(
            "flex items-center gap-2 rounded-lg px-2 py-2",
            collapsed && "justify-center px-0",
          )}>
            {/* Avatar */}
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-primary-foreground uppercase select-none">
              {user.name?.[0] ?? user.email?.[0] ?? "?"}
            </div>
            {!collapsed && (
              <>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate leading-tight">{user.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate leading-tight">{user.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  className="shrink-0 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        ) : null}
      </SidebarFooter>
    </Sidebar>
  );
}
