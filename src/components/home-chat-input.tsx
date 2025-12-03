"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { createChatWithFiles } from "@/app/actions";
import {
  Loader2,
  FileText,
  Upload,
  MessageSquare,
  X,
  File,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export function HomeChatInput() {
  const [files, setFiles] = useState<File[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const handleFileSelect = (selectedFiles: FileList | null) => {
    if (!selectedFiles) return;

    const newFiles = Array.from(selectedFiles);
    const validFiles: File[] = [];

    // Check if adding these files would exceed the limit
    if (files.length + newFiles.length > 5) {
      toast.error(
        `Maximum 5 files allowed. You can add ${5 - files.length} more file(s).`
      );
      return;
    }

    for (const file of newFiles) {
      // Check file type
      if (!file.type.includes("text/plain") && !file.type.includes("pdf")) {
        toast.error(`${file.name}: Only TXT and PDF files are supported`);
        continue;
      }

      // Check file size (5MB limit per file)
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name}: File size exceeds 5MB limit`);
        continue;
      }

      validFiles.push(file);
    }

    setFiles((prev) => [...prev, ...validFiles]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFileSelect(e.dataTransfer.files);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    if (files.length === 0 || isLoading) return;

    setIsLoading(true);
    try {
      // Auto-generate chat name from file names
      const chatName =
        files.length === 1
          ? files[0].name.replace(/\.[^/.]+$/, "") // Remove extension
          : `${files[0].name.replace(/\.[^/.]+$/, "")} + ${
              files.length - 1
            } more`;

      // Create the chat first
      const chat = await createChatWithFiles(chatName);

      // Upload files to the API route
      let successCount = 0;
      for (const file of files) {
        try {
          const formData = new FormData();
          formData.append("file", file);
          formData.append("chatId", chat.id);

          const response = await fetch("/api/upload", {
            method: "POST",
            body: formData,
          });

          if (response.ok) {
            successCount++;
          } else {
            const errorText = await response.text();
            console.error(`Failed to upload ${file.name}:`, errorText);
          }
        } catch (uploadError) {
          console.error(`Error uploading ${file.name}:`, uploadError);
        }
      }

      if (successCount > 0) {
        toast.success(
          `Chat created! ${successCount}/${files.length} files processed successfully.`
        );
        router.push(`/chat/${chat.id}`);
      } else {
        toast.error(
          "Chat created but failed to process files. Please try again."
        );
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Failed to create chat:", error);
      toast.error("Failed to create chat. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Info card */}
      <div className="bg-muted/50 dark:bg-[#2a2a28] rounded-lg p-4 sm:p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-primary/10 dark:bg-[#d97757]/10 flex items-center justify-center shrink-0">
            <FileText className="h-5 w-5 text-primary dark:text-[#d97757]" />
          </div>
          <div>
            <h3 className="font-semibold">Chat with your documents</h3>
            <p className="text-sm text-muted-foreground dark:text-[#b7b5a9]">
              Upload multiple PDF or TXT files and ask questions
            </p>
          </div>
        </div>

        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <div className="flex items-start gap-2">
            <Upload className="h-4 w-4 mt-0.5 text-primary dark:text-[#d97757] shrink-0" />
            <div>
              <p className="font-medium">Upload files</p>
              <p className="text-muted-foreground dark:text-[#b7b5a9] text-xs sm:text-sm">
                Up to 5 files, max 5MB each
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <FileText className="h-4 w-4 mt-0.5 text-primary dark:text-[#d97757] shrink-0" />
            <div>
              <p className="font-medium">Smart parsing</p>
              <p className="text-muted-foreground dark:text-[#b7b5a9] text-xs sm:text-sm">
                AI-powered embeddings
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <MessageSquare className="h-4 w-4 mt-0.5 text-primary dark:text-[#d97757] shrink-0" />
            <div>
              <p className="font-medium">Ask anything</p>
              <p className="text-muted-foreground dark:text-[#b7b5a9] text-xs sm:text-sm">
                Get answers from all docs
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* File upload area */}
      <div className="space-y-4">
        <input
          type="file"
          ref={fileInputRef}
          onChange={(e) => handleFileSelect(e.target.files)}
          accept=".txt,.pdf"
          multiple
          className="hidden"
        />

        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-lg p-8 sm:p-12 text-center cursor-pointer transition-all",
            "hover:border-primary dark:hover:border-[#d97757]",
            isDragging
              ? "border-primary dark:border-[#d97757] bg-primary/5 dark:bg-[#d97757]/5"
              : "border-border dark:border-[#3e3e38]",
            "bg-background dark:bg-[#1f1e1d]"
          )}
        >
          <div className="flex flex-col items-center gap-3">
            <div className="h-12 w-12 rounded-full bg-primary/10 dark:bg-[#d97757]/10 flex items-center justify-center">
              <Upload className="h-6 w-6 text-primary dark:text-[#d97757]" />
            </div>
            <div>
              <p className="font-medium">
                {isDragging
                  ? "Drop files here"
                  : "Click to upload or drag and drop"}
              </p>
              <p className="text-sm text-muted-foreground dark:text-[#b7b5a9] mt-1">
                TXT or PDF files (max 5MB each)
              </p>
            </div>
          </div>
        </div>

        {/* Selected files list */}
        {files.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              Selected files ({files.length}/5)
            </p>
            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
              {files.map((file, index) => (
                <div
                  key={index}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-lg border",
                    "bg-muted/50 dark:bg-[#2a2a28] border-border dark:border-[#3e3e38]"
                  )}
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <File className="h-4 w-4 text-primary dark:text-[#d97757] shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {file.name}
                      </p>
                      <p className="text-xs text-muted-foreground dark:text-[#b7b5a9]">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Submit button */}
        <Button
          onClick={handleSubmit}
          disabled={files.length === 0 || isLoading}
          className={cn(
            "w-full h-12 text-base font-medium transition-all",
            "bg-primary hover:bg-primary/90 dark:bg-[#d97757] dark:hover:bg-[#d97757]/90"
          )}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Creating chat and processing files...
            </>
          ) : (
            <>
              <MessageSquare className="mr-2 h-5 w-5" />
              Start chatting with {files.length}{" "}
              {files.length === 1 ? "file" : "files"}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
