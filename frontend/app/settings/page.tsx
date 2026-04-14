"use client";

import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export default function SettingsPage() {
  const { user } = useAuth();

  const initials = (name: string) =>
    name.split(" ").slice(0, 2).map((p) => p[0]).join("").toUpperCase();

  return (
    <AppLayout>
      <div className="p-6 max-w-2xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage your account</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Profile</CardTitle>
            <CardDescription>Your Google account details</CardDescription>
          </CardHeader>
          <CardContent>
            {user && (
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  {user.avatar_url && <AvatarImage src={user.avatar_url} alt={user.name} referrerPolicy="no-referrer" />}
                  <AvatarFallback className="bg-primary/10 text-primary font-medium">
                    {initials(user.name || user.email)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
