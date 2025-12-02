import { getChatMessages, getChats } from "@/app/actions";
import { ChatInterface } from "@/components/chat-interface";
import DashboardLayout from "@/components/dashboard-layout";
import { createClient } from "@/lib/server";
import { redirect } from "next/navigation";

export default async function ChatPage({
  params,
}: {
  params: Promise<{ id: string }> | { id: string };
}) {
  // Handle Next.js 16 params which is a Promise
  const resolvedParams = params instanceof Promise ? await params : params;
  const { id } = resolvedParams;
  
  if (!id) {
    console.error("Chat ID is missing from params");
    redirect("/");
    return null;
  }
  
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    console.error("User auth error:");
    redirect("/login");
    return null;
  }

  // Verify chat belongs to user
  const { data: chat } = await supabase
    .from("chats")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single();

  if (!chat) {
    console.error("Chat not found:", { chatId: id, userId: user.id });
    redirect("/");
    return null;
  }

  const messages = await getChatMessages(id);
  const chats = await getChats();

  return (
    <DashboardLayout user={user} chats={chats}>
      <ChatInterface
        chatId={id}
        initialMessages={messages || []}
        chatTitle={chat.title}
      />
    </DashboardLayout>
  );
}
