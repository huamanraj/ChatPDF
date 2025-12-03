"use server";

import { createClient } from "@/lib/server";
import { redirect } from "next/navigation";

export async function signOut() {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
}

export async function createChat(title: string) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError) {
            console.error("Error getting user:", userError);
            throw new Error("Authentication error");
        }

        if (!user) {
            throw new Error("Unauthorized - no user found");
        }

        console.log("Creating chat for user:", user.id, "with title:", title);

        const { data, error } = await supabase
            .from("chats")
            .insert({ title, user_id: user.id })
            .select()
            .single();

        if (error) {
            console.error("Error creating chat:", error);
            throw error;
        }

        if (!data) {
            throw new Error("Chat created but no data returned");
        }

        console.log("Chat created successfully:", data.id);
        return data;
    } catch (error) {
        console.error("createChat error:", error);
        throw error;
    }
}

export async function createChatWithFiles(title: string) {
    try {
        const supabase = await createClient();
        const { data: { user }, error: userError } = await supabase.auth.getUser();

        if (userError || !user) {
            throw new Error("Authentication error");
        }

        // Create the chat first
        const { data: chat, error: chatError } = await supabase
            .from("chats")
            .insert({ title, user_id: user.id })
            .select()
            .single();

        if (chatError || !chat) {
            throw new Error("Failed to create chat");
        }

        return chat;
    } catch (error) {
        console.error("createChatWithFiles error:", error);
        throw error;
    }
}

export async function saveUserMessage(chatId: string, content: string) {
    const supabase = await createClient();
    const { error } = await supabase.from("messages").insert({
        chat_id: chatId,
        role: "user",
        content,
    });
    if (error) throw error;
}

export async function getChats() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return [];

    const { data, error } = await supabase
        .from("chats")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

    if (error) throw error;
    return data;
}

export async function getChatMessages(chatId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("chat_id", chatId)
        .order("created_at", { ascending: true });

    if (error) throw error;
    return data;
}

export async function getChatFiles(chatId: string) {
    const supabase = await createClient();
    const { data, error } = await supabase
        .from("chat_files")
        .select("*")
        .eq("chat_id", chatId)
        .order("uploaded_at", { ascending: true });

    if (error) throw error;
    return data || [];
}
