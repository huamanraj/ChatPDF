import { createClient } from "@/lib/server";
import { OpenAI } from "openai";

export const maxDuration = 60;

const client = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(req: Request) {
    const supabase = await createClient();

    const {
        data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
        return new Response("Unauthorized", { status: 401 });
    }

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

    // Create streaming response using OpenAI Chat Completions API
    const stream = await client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: messages.map((m) => ({
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
        })),
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

