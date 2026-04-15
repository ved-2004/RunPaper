"use client";

import { BarChart3, Settings, Upload, FileText, Cpu, LogIn } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
        {isTrial && (
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
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
