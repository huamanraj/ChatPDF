import { createClient } from "@/lib/server";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/dashboard-layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getChats } from "@/app/actions";

export default async function ProfilePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  const chats = await getChats();

  return (
    <DashboardLayout user={user} chats={chats}>
      <div className="flex flex-1 items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="flex flex-col items-center gap-4">
            <Avatar className="h-24 w-24">
              <AvatarImage
                src={user.user_metadata?.avatar_url}
                alt={user.email}
              />
              <AvatarFallback className="text-2xl">
                {user.email?.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <CardTitle>
              {user.user_metadata?.full_name || "User Profile"}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-2">
            <div className="text-sm text-muted-foreground">Email</div>
            <div className="font-medium">{user.email}</div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}
