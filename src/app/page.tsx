import { createClient } from "@/lib/server";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/dashboard-layout";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  return (
    <DashboardLayout user={user}>
      <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed shadow-sm m-4">
        <div className="flex flex-col items-center gap-1 text-center">
          <h3 className="text-2xl font-bold tracking-tight">
            Welcome to ChatPDF
          </h3>
          <p className="text-sm text-muted-foreground">
            Select a chat from the sidebar or start a new one.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
