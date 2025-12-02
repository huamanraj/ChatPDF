"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowUp, Loader2, Square, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  PromptInput,
  PromptInputTextarea,
  PromptInputActions,
  PromptInputAction,
} from "@/components/ui/prompt-input";
import {
  Message,
  MessageAvatar,
  MessageContent,
  MessageContainer,
  MessageActions,
  MessageAction,
} from "@/components/ui/message";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

type ChatMessage = {
  id?: string;
  role: "user" | "assistant";
  content: string;
  created_at?: string;
};

type ChatInterfaceProps = {
  chatId: string;
  initialMessages: ChatMessage[];
  chatTitle: string;
};

export function ChatInterface({
  chatId,
  initialMessages,
  chatTitle,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const hasProcessedInitialRef = useRef(false);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const copyToClipboard = async (text: string, index: number) => {
    await navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const sendMessage = useCallback(
    async (messageContent: string, currentMessages: ChatMessage[]) => {
      const userMessage: ChatMessage = {
        role: "user",
        content: messageContent,
      };

      const updatedMessages = [...currentMessages, userMessage];
      setMessages(updatedMessages);
      setIsLoading(true);

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: "",
      };
      setMessages((prev) => [...prev, assistantMessage]);

      try {
        abortControllerRef.current = new AbortController();

        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            chatId,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error("Failed to send message");
        }

        const reader = response.body?.getReader();
        const decoder = new TextDecoder();

        if (!reader) {
          throw new Error("No reader available");
        }

        let accumulatedContent = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") {
                break;
              }
              try {
                const parsed = JSON.parse(data);
                if (parsed.content) {
                  accumulatedContent += parsed.content;
                  setMessages((prev) => {
                    const newMessages = [...prev];
                    const lastMessage = newMessages[newMessages.length - 1];
                    if (lastMessage && lastMessage.role === "assistant") {
                      lastMessage.content = accumulatedContent;
                    }
                    return newMessages;
                  });
                }
              } catch {
                // Skip invalid JSON
              }
            }
          }
        }
      } catch (error) {
        if (error instanceof Error && error.name === "AbortError") {
          console.log("Request aborted");
        } else {
          console.error("Error sending message:", error);
          setMessages((prev) => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === "assistant") {
              lastMessage.content =
                "Sorry, an error occurred. Please try again.";
            }
            return newMessages;
          });
        }
      } finally {
        setIsLoading(false);
        abortControllerRef.current = null;
      }
    },
    [chatId]
  );

  // Check for initial message from sessionStorage on mount
  useEffect(() => {
    if (hasProcessedInitialRef.current) return;

    const storageKey = `chat_initial_${chatId}`;
    const storedMessage = sessionStorage.getItem(storageKey);

    if (storedMessage && initialMessages.length === 0) {
      hasProcessedInitialRef.current = true;
      sessionStorage.removeItem(storageKey);

      try {
        const { content } = JSON.parse(storedMessage);
        if (content) {
          sendMessage(content, []);
        }
      } catch (e) {
        console.error("Error parsing stored message:", e);
      }
    } else {
      hasProcessedInitialRef.current = true;
    }
  }, [chatId, initialMessages.length, sendMessage]);

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;
    const messageContent = input.trim();
    setInput("");
    await sendMessage(messageContent, messages);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      {/* Messages Area */}
      <ScrollArea className="flex-1 px-4" ref={scrollRef}>
        <div className="mx-auto max-w-3xl py-6">
          {messages.length === 0 ? (
            <div className="flex h-[60vh] items-center justify-center">
              <div className="text-center space-y-3">
                <h2 className={cn(
                  "text-2xl font-semibold tracking-tight",
                  "text-foreground",
                  "dark:text-[#e5e5e2]"
                )}>
                  {chatTitle}
                </h2>
                <p className={cn(
                  "text-sm",
                  "text-muted-foreground",
                  "dark:text-[#b7b5a9]"
                )}>
                  Start a conversation by typing a message below.
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((message, index) => (
                <Message
                  key={index}
                  className={cn(
                    "group",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {message.role === "assistant" && (
                    <MessageAvatar
                      src="/ai-avatar.png"
                      alt="AI Assistant"
                      fallback="AI"
                      className={cn(
                        // Light mode
                        "bg-primary/10 text-primary border-primary/20",
                        // Dark mode
                        "dark:bg-[#d97757]/20 dark:text-[#d97757] dark:border-[#d97757]/30"
                      )}
                    />
                  )}
                  <MessageContainer
                    className={cn(message.role === "user" && "items-end")}
                  >
                    {/* Loading state for assistant */}
                    {message.role === "assistant" && !message.content ? (
                      <div
                        className={cn(
                          "rounded-2xl px-4 py-3 max-w-[85%]",
                          // Light mode
                          "bg-secondary/80 border border-border/50 shadow-sm",
                          // Dark mode
                          "dark:bg-[#2a2a28] dark:border-[#3e3e38]/50 dark:shadow-lg dark:shadow-black/20"
                        )}
                      >
                        <span className={cn(
                          "flex items-center gap-2 text-sm",
                          "text-muted-foreground",
                          "dark:text-[#b7b5a9]"
                        )}>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          <span className="animate-pulse">Thinking...</span>
                        </span>
                      </div>
                    ) : (
                      <>
                        <MessageContent
                          markdown={message.role === "assistant"}
                          className={cn(
                            "max-w-[85%]",
                            message.role === "user" && [
                              // Light mode user message
                              "bg-primary text-primary-foreground border-primary/50 ml-auto",
                              // Dark mode user message
                              "dark:bg-[#d97757] dark:text-white dark:border-[#d97757]/50 dark:shadow-lg dark:shadow-[#d97757]/20",
                            ]
                          )}
                        >
                          {message.content}
                        </MessageContent>
                        {/* Actions for assistant messages */}
                        {message.role === "assistant" && message.content && (
                          <MessageActions>
                            <MessageAction
                              tooltip={copiedIndex === index ? "Copied!" : "Copy"}
                            >
                              <Button
                                variant="ghost"
                                size="icon"
                                className={cn(
                                  "h-7 w-7 rounded-lg",
                                  "hover:bg-muted",
                                  "dark:hover:bg-[#3e3e38]/50"
                                )}
                                onClick={() =>
                                  copyToClipboard(message.content, index)
                                }
                              >
                                {copiedIndex === index ? (
                                  <Check className="h-3.5 w-3.5 text-green-500 dark:text-green-400" />
                                ) : (
                                  <Copy className="h-3.5 w-3.5" />
                                )}
                              </Button>
                            </MessageAction>
                          </MessageActions>
                        )}
                      </>
                    )}
                  </MessageContainer>
                  {message.role === "user" && (
                    <MessageAvatar
                      src="/user-avatar.png"
                      alt="You"
                      fallback="U"
                      className={cn(
                        // Light mode
                        "bg-primary text-primary-foreground border-primary",
                        // Dark mode
                        "dark:bg-[#d97757] dark:text-white dark:border-[#d97757]/80"
                      )}
                    />
                  )}
                </Message>
              ))}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div
        className={cn(
          "border-t p-4",
          // Light mode
          "border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80",
          // Dark mode
          "dark:border-[#3e3e38]/50 dark:bg-[#262624]/95 dark:backdrop-blur-lg"
        )}
      >
        <div className="mx-auto max-w-3xl">
          <PromptInput
            value={input}
            onValueChange={setInput}
            isLoading={isLoading}
            onSubmit={handleSubmit}
            className={cn(
              "w-full",
              // Light mode
              "bg-background shadow-lg border-border/80",
              // Dark mode
              "dark:bg-[#1f1e1d] dark:shadow-xl dark:shadow-black/30 dark:border-[#3e3e38]/50"
            )}
          >
            <PromptInputTextarea
              placeholder="Type your message..."
              className="min-h-[52px] text-[15px]"
            />
            <PromptInputActions className="justify-end pt-2">
              <PromptInputAction
                tooltip={isLoading ? "Stop generating" : "Send message"}
              >
                <Button
                  size="icon"
                  className={cn(
                    "h-9 w-9 rounded-full transition-all duration-200",
                    isLoading
                      ? "bg-destructive hover:bg-destructive/90 dark:bg-[#ef4444] dark:hover:bg-[#ef4444]/80"
                      : "bg-primary hover:bg-primary/90 hover:scale-105 dark:bg-[#d97757] dark:hover:bg-[#d97757]/80"
                  )}
                  onClick={isLoading ? handleStop : handleSubmit}
                  disabled={!input.trim() && !isLoading}
                >
                  {isLoading ? (
                    <Square className="h-4 w-4 fill-current" />
                  ) : (
                    <ArrowUp className="h-4 w-4" />
                  )}
                </Button>
              </PromptInputAction>
            </PromptInputActions>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}
