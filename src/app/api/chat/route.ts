
import { createClient } from "@/lib/server";
import { OpenAI } from "openai";
import { OpenAIEmbeddings } from "@langchain/openai";

export const maxDuration = 60;

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Simple in-memory rate limiter (Note: resets on serverless cold start)
const rateLimit = new Map<string, { count: number; timestamp: number }>();

export async function POST(req: Request) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return new Response("Unauthorized", { status: 401 });
    }

    // Rate Limiting: 5 requests per minute
    const now = Date.now();
    const windowMs = 60 * 1000;
    const userRate = rateLimit.get(user.id) || { count: 0, timestamp: now };

    if (now - userRate.timestamp > windowMs) {
        userRate.count = 0;
        userRate.timestamp = now;
    }

    if (userRate.count >= 5) {
        return new Response("Rate limit exceeded. Please try again later.", { status: 429 });
    }

    userRate.count++;
    rateLimit.set(user.id, userRate);

    const { messages, chatId } = (await req.json()) as {
        messages: { role: string; content: string }[];
        chatId: string;
    };

    // Save the user message (last message in the array)
    const lastUserMessage = messages[messages.length - 1];
    if (lastUserMessage && lastUserMessage.role === "user") {
        await supabase.from("messages").insert({
            chat_id: chatId,
            role: "user",
            content: lastUserMessage.content,
        });
    }

    // RAG: Retrieve relevant documents
    let contextText = "";
    let documentsFound = 0;
    let allDocumentsCount = 0;

    if (lastUserMessage && lastUserMessage.role === "user") {
        // First, check if ANY documents exist for this chat
        const { data: allDocs, error: countError } = await supabase
            .from("documents")
            .select("content, file_name")
            .eq("chat_id", chatId)
            .limit(100); // Get up to 100 chunks

        if (countError) {
            console.error("Error fetching documents:", countError);
        } else if (allDocs && allDocs.length > 0) {
            allDocumentsCount = allDocs.length;
            console.log(`Total documents in chat: ${allDocumentsCount}`);

            // Try semantic search first
            try {
                const embeddings = new OpenAIEmbeddings({
                    apiKey: process.env.OPENAI_API_KEY,
                    modelName: "text-embedding-3-small",
                });

                const embedding = await embeddings.embedQuery(lastUserMessage.content);

                const { data: semanticDocs, error: semanticError } = await supabase.rpc("match_documents", {
                    query_embedding: embedding,
                    match_threshold: 0.1, // Very low threshold to catch anything relevant
                    match_count: 15,
                    filter_chat_id: chatId,
                });

                if (!semanticError && semanticDocs && semanticDocs.length > 0) {
                    documentsFound = semanticDocs.length;
                    contextText = semanticDocs.map((doc: any) => doc.content).join("\n\n");
                    console.log(`Found ${documentsFound} relevant chunks via semantic search`);
                } else {
                    // Fallback: Use all documents if semantic search fails
                    console.log("Semantic search found nothing, using all documents as context");
                    documentsFound = allDocs.length;
                    contextText = allDocs.map((doc: any) => doc.content).join("\n\n");
                }
            } catch (embeddingError) {
                console.error("Embedding error, using all documents:", embeddingError);
                // Fallback: Use all documents
                documentsFound = allDocs.length;
                contextText = allDocs.map((doc: any) => doc.content).join("\n\n");
            }
        } else {
            console.log("No documents found for this chat. User needs to upload files.");
        }
    }

    const systemMessage = contextText
        ? `You are a helpful AI assistant that helps users understand their uploaded documents.

DOCUMENT CONTENT (${documentsFound} sections):
${contextText}

YOUR ROLE:
- Answer questions based ONLY on the document content shown above
- Provide summaries, explanations, and insights about what's IN the documents
- Use clear, natural language to explain the content
- You can rephrase and explain concepts in your own words
- BUT you must NOT add any facts, details, or information that isn't in the documents

STRICT RULES:
1. When asked for a summary, provide a comprehensive overview of ALL the document content
2. Base ALL your answers on the document content above - do not add external facts or details
3. You can explain concepts using natural language, but the information must come from the documents
4. If asked about something not in the documents, clearly state: "This information is not mentioned in the uploaded documents"
5. You can organize and present the information clearly, but don't add new information
6. For "what is this about" questions, give a detailed overview of what IS in the document

WHAT YOU CAN DO:
✅ Explain document content in clear, natural language
✅ Summarize and organize information from the documents
✅ Answer questions using only document content
✅ Rephrase and clarify what's written in the documents

WHAT YOU CANNOT DO:
❌ Add facts or details not in the documents
❌ Use external knowledge to add information
❌ Make assumptions about things not mentioned
❌ Provide context or background not in the documents

You have ${documentsFound} sections of content. Use all of it when providing summaries, but stick to what's actually written.`
        : `You are a helpful AI assistant. 

IMPORTANT: No documents have been found in this chat.

Please inform the user that they need to upload PDF or TXT files to this chat before you can help them with document-related questions. 

You can still help with:
- General questions
- Explaining how to use this application
- Other topics not requiring document context`;

    // Create streaming response using OpenAI Chat Completions API
    const stream = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: systemMessage },
            ...messages.map((m) => ({
                role: m.role as "user" | "assistant" | "system",
                content: m.content,
            })),
        ],
        stream: true,
    });

    // Create a readable stream for the response
    const encoder = new TextEncoder();
    let fullContent = "";

    const readableStream = new ReadableStream({
        async start(controller) {
            try {
                for await (const chunk of stream) {
                    const delta = chunk.choices[0]?.delta?.content;
                    if (delta) {
                        fullContent += delta;
                        controller.enqueue(
                            encoder.encode(`data: ${JSON.stringify({ content: delta })}\n\n`)
                        );
                    }

                    if (chunk.choices[0]?.finish_reason === "stop") {
                        // Save the complete assistant message
                        await supabase.from("messages").insert({
                            chat_id: chatId,
                            role: "assistant",
                            content: fullContent,
                        });
                        controller.enqueue(encoder.encode(`data: [DONE]\n\n`));
                        controller.close();
                    }
                }
            } catch (error) {
                console.error("Streaming error:", error);
                controller.error(error);
            }
        },
    });

    return new Response(readableStream, {
        headers: {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
        },
    });
}

