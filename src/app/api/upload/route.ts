import { createClient } from "@/lib/server";
import { NextRequest, NextResponse } from "next/server";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { OpenAIEmbeddings } from "@langchain/openai";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
    try {
        const supabase = await createClient();
        const {
            data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const formData = await req.formData();
        const file = formData.get("file") as File;
        const chatId = formData.get("chatId") as string;

        if (!file || !chatId) {
            return new NextResponse("Missing file or chatId", { status: 400 });
        }

        if (file.size > 5 * 1024 * 1024) {
            return new NextResponse("File size exceeds 5MB limit", { status: 400 });
        }

        // Upload file to Supabase Storage
        const fileExt = file.name.split(".").pop();
        const filePath = `${user.id}/${chatId}/${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from("chat-files")
            .upload(filePath, file);

        if (uploadError) {
            console.error("Upload error:", uploadError);
            return new NextResponse("Failed to upload file", { status: 500 });
        }

        // Track the file in chat_files table
        const { error: fileTrackError } = await supabase
            .from("chat_files")
            .insert({
                chat_id: chatId,
                file_name: file.name,
                file_path: filePath,
                file_size: file.size,
                file_type: file.type,
            });

        if (fileTrackError) {
            console.error("File tracking error:", fileTrackError);
            // Continue even if tracking fails
        }

        // Parse file content
        let text = "";

        if (file.type === "application/pdf") {
            // Parse PDF using pdf-parse-fork (works in Node.js)
            const pdfParse = require("pdf-parse-fork");
            const fileBuffer = await file.arrayBuffer();
            const pdfData = await pdfParse(Buffer.from(fileBuffer));
            text = pdfData.text;
        } else if (file.type === "text/plain") {
            text = await file.text();
        } else {
            return new NextResponse("Unsupported file type. Please upload a PDF or TXT file.", { status: 400 });
        }

        if (!text.trim()) {
            return new NextResponse("File is empty", { status: 400 });
        }

        // Split text into chunks
        const splitter = new RecursiveCharacterTextSplitter({
            chunkSize: 1000,
            chunkOverlap: 200,
        });
        const output = await splitter.createDocuments([text]);

        // Generate embeddings
        const embeddings = new OpenAIEmbeddings({
            apiKey: process.env.OPENAI_API_KEY,
            modelName: "text-embedding-3-small",
        });

        const vectors = await embeddings.embedDocuments(
            output.map((doc) => doc.pageContent)
        );

        // Store in Supabase with file name
        const rows = output.map((doc, i) => ({
            content: doc.pageContent,
            metadata: doc.metadata,
            embedding: vectors[i],
            chat_id: chatId,
            file_name: file.name, // Track which file this chunk came from
        }));

        const { error: insertError } = await supabase.from("documents").insert(rows);

        if (insertError) {
            console.error("Insert error:", insertError);
            return new NextResponse("Failed to store embeddings", { status: 500 });
        }

        return NextResponse.json({ success: true, fileName: file.name });
    } catch (error) {
        console.error("Error processing file:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
