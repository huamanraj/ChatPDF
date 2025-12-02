import { createClient } from "@/lib/server";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/mode-toggle";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4 relative">
      <div className="absolute top-4 right-4">
        <ModeToggle />
      </div>
      <h1 className="text-2xl font-bold">Welcome to ChatPDF</h1>
      <p>You are logged in as {user.email}</p>
      <form
        action={async () => {
          "use server";
          const supabase = await createClient();
          await supabase.auth.signOut();
          redirect("/login");
        }}
      >
        <Button type="submit" variant="destructive">
          Sign Out
        </Button>
      </form>
    </div>
  );
}
