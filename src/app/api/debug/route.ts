import { createClient } from "@/lib/server";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const chatId = req.nextUrl.searchParams.get("chatId");

        if (!chatId) {
            return NextResponse.json({ error: "chatId required" }, { status: 400 });
        }

        // Get document count for this chat
        const { data: documents, error: docError } = await supabase
            .from("documents")
            .select("id, file_name, content")
            .eq("chat_id", chatId);

        if (docError) {
            return NextResponse.json({ error: docError.message }, { status: 500 });
        }

        // Get uploaded files for this chat
        const { data: files, error: filesError } = await supabase
            .from("chat_files")
            .select("*")
            .eq("chat_id", chatId);

        if (filesError) {
            return NextResponse.json({ error: filesError.message }, { status: 500 });
        }

        return NextResponse.json({
            chatId,
            filesUploaded: files?.length || 0,
            files: files || [],
            documentChunks: documents?.length || 0,
            sampleChunks: documents?.slice(0, 3).map(d => ({
                file_name: d.file_name,
                contentPreview: d.content?.substring(0, 100) + "..."
            })) || []
        });
    } catch (error) {
        console.error("Debug error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}
