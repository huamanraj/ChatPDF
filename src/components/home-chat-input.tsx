"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createChat } from "@/app/actions";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
} from "@/components/ui/prompt-input";
import { Button } from "@/components/ui/button";
import { ArrowUp, Loader2 } from "lucide-react";
import { toast } from "sonner";

export function HomeChatInput() {
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) {
      e.preventDefault();
    }
    
    if (!input.trim()) return;

    setIsLoading(true);
    try {
      // Create a new chat with truncated title
      const title = input.trim().slice(0, 50) + (input.length > 50 ? "..." : "");
      const chat = await createChat(title);

      if (!chat || !chat.id) {
        throw new Error("Failed to create chat - no ID returned");
      }

      // Store the initial message in sessionStorage to be picked up by chat interface
      sessionStorage.setItem(
        `chat_initial_${chat.id}`,
        JSON.stringify({ content: input.trim() })
      );

      // Clear input
      setInput("");

      // Navigate to chat page - the chat interface will handle sending the message
      router.push(`/chat/${chat.id}`);
    } catch (error) {
      console.error("Error creating chat:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to start chat. Please try again.";
      toast.error(errorMessage);
      setIsLoading(false);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <form onSubmit={handleSubmit}>
        <PromptInput
          value={input}
          onValueChange={setInput}
          onSubmit={() => handleSubmit()}
          isLoading={isLoading}
          className="bg-background shadow-lg border-muted"
        >
          <PromptInputTextarea placeholder="Ask anything..." />
          <PromptInputActions className="justify-end p-2">
            <Button
              type="submit"
              size="icon"
              className="rounded-full h-8 w-8"
              onClick={(e) => {
                e.preventDefault();
                handleSubmit();
              }}
              disabled={isLoading || !input.trim()}
            >
              {isLoading ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <ArrowUp className="size-4" />
              )}
            </Button>
          </PromptInputActions>
        </PromptInput>
      </form>
    </div>
  );
}
