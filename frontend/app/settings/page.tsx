"use client";

import { useRouter } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, ExternalLink } from "lucide-react";

function initials(name: string) {
  return name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace("/login");
  };

  return (
    <AppLayout>
      <div className="p-3 sm:p-6 max-w-2xl mx-auto space-y-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your account</p>
        </div>

        {/* Profile */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>Your Google account linked to RunPaper</CardDescription>
          </CardHeader>
          <CardContent>
            {user ? (
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  {user.avatar_url && (
                    <AvatarImage src={user.avatar_url} alt={user.name} referrerPolicy="no-referrer" />
                  )}
                  <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                    {initials(user.name || user.email)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Not signed in.</p>
            )}
          </CardContent>
        </Card>

        {/* LLM / stack info */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">About RunPaper</CardTitle>
            <CardDescription>What's running under the hood</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Pipeline</span>
              <span className="font-medium">5-step async (extract → codegen → repro → flowchart → FAQ)</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Code scaffold</span>
              <span className="font-medium">model.py · train.py · config.yaml · requirements.txt</span>
            </div>
            <Separator />
            <div className="flex justify-between">
              <span className="text-muted-foreground">Source</span>
              <a
                href="https://github.com/ved-2004/RunPaper"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium flex items-center gap-1 text-primary hover:underline"
              >
                GitHub <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Sign out */}
        <Card className="border-destructive/30">
          <CardHeader>
            <CardTitle className="text-base text-destructive">Sign out</CardTitle>
            <CardDescription>You'll be redirected to the login page</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="destructive" onClick={handleLogout} className="gap-2">
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
