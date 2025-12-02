"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowUp, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
    PromptInput,
    PromptInputTextarea,
    PromptInputActions,
    PromptInputAction,
} from "@/components/ui/prompt-input";
import { createChat } from "@/app/actions";

export function NewChatForm() {
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();

    const handleSubmit = async () => {
        if (!input.trim() || isLoading) return;

        setIsLoading(true);

        try {
            // Create chat with first message as title (truncated)
            const title = input.trim().slice(0, 50) + (input.length > 50 ? "..." : "");
            const chat = await createChat(title);

            // Store the initial message in session storage to use on the chat page
            sessionStorage.setItem(
                `chat_initial_${chat.id}`,
                JSON.stringify({ content: input.trim() })
            );

            // Navigate to chat page
            router.push(`/chat/${chat.id}`);
        } catch (error) {
            console.error("Error creating chat:", error);
            setIsLoading(false);
        }
    };

    return (
        <div className="flex h-screen flex-col items-center justify-center bg-background p-4">
            <div className="w-full max-w-2xl space-y-8">
                <div className="text-center">
                    <h1 className="text-4xl font-bold text-foreground">
                        What can I help you with?
                    </h1>
                    <p className="mt-2 text-muted-foreground">
                        Start a conversation by typing your message below.
                    </p>
                </div>

                <PromptInput
                    value={input}
                    onValueChange={setInput}
                    isLoading={isLoading}
                    onSubmit={handleSubmit}
                    className="w-full"
                >
                    <PromptInputTextarea
                        placeholder="Message AI..."
                        className="min-h-[60px]"
                    />
                    <PromptInputActions className="justify-end pt-2">
                        <PromptInputAction tooltip="Send message">
                            <Button
                                size="icon"
                                className="h-9 w-9 rounded-full bg-primary hover:bg-primary/90"
                                onClick={handleSubmit}
                                disabled={!input.trim() || isLoading}
                            >
                                {isLoading ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <ArrowUp className="h-4 w-4" />
                                )}
                            </Button>
                        </PromptInputAction>
                    </PromptInputActions>
                </PromptInput>
            </div>
        </div>
    );
}
