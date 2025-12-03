import { createClient } from "@/lib/server";
import { redirect } from "next/navigation";
import DashboardLayout from "@/components/dashboard-layout";
import { HomeChatInput } from "@/components/home-chat-input";
import { getChats } from "@/app/actions";

export default async function Home() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const chats = await getChats();

  return (
    <DashboardLayout user={user} chats={chats}>
      <div className="flex flex-1 flex-col items-center h-full px-4 py-8 overflow-y-auto">
        <div className="w-full max-w-2xl text-center mb-8">
          <h1 className="text-4xl font-bold text-foreground">
            What can I help you with?
          </h1>
          <p className="mt-2 text-muted-foreground">
            Upload your documents and start chatting with AI
          </p>
        </div>
        <div className="w-full max-w-2xl mb-8">
          <HomeChatInput />
        </div>
      </div>
    </DashboardLayout>
  );
}
