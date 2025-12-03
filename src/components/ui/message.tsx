import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { Markdown } from "./markdown";

export type MessageProps = {
  children: React.ReactNode;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

const Message = ({ children, className, ...props }: MessageProps) => (
  <div
    className={cn(
      "flex items-start gap-3 w-full animate-in fade-in-0 slide-in-from-bottom-2 duration-300",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageAvatarProps = {
  src: string;
  alt: string;
  fallback?: string;
  delayMs?: number;
  className?: string;
};

const MessageAvatar = ({
  src,
  alt,
  fallback,
  delayMs,
  className,
}: MessageAvatarProps) => {
  return (
    <Avatar
      className={cn(
        "h-9 w-9 shrink-0 border-2 shadow-sm transition-transform hover:scale-105",
        // Light mode
        "border-border/50 shadow-black/5",
        // Dark mode
        "dark:border-border/30 dark:shadow-lg dark:shadow-black/30",
        className
      )}
    >
      <AvatarImage src={src} alt={alt} className="object-cover" />
      {fallback && (
        <AvatarFallback
          delayMs={delayMs}
          className={cn(
            "text-xs font-semibold",
            // Light mode
            "bg-muted text-muted-foreground",
            // Dark mode
            "dark:bg-muted/50 dark:text-foreground"
          )}
        >
          {fallback}
        </AvatarFallback>
      )}
    </Avatar>
  );
};

export type MessageContainerProps = {
  children: React.ReactNode;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

const MessageContainer = ({
  children,
  className,
  ...props
}: MessageContainerProps) => (
  <div className={cn("flex flex-col gap-1 flex-1 min-w-0", className)} {...props}>
    {children}
  </div>
);

export type MessageContentProps = {
  children: React.ReactNode;
  markdown?: boolean;
  className?: string;
} & Omit<React.ComponentProps<typeof Markdown>, "children"> &
  React.HTMLProps<HTMLDivElement>;

const MessageContent = ({
  children,
  markdown = false,
  className,
  ...props
}: MessageContentProps) => {
  const baseStyles = cn(
    // Base styling
    "rounded-2xl px-4 py-3",
    // Typography
    "text-[15px] leading-relaxed font-sans",
    
    // === LIGHT MODE ===
    "bg-secondary/80 text-foreground",
    "border border-border/40 shadow-sm shadow-black/5",
    
    // === DARK MODE ===
    "dark:bg-[#2a2a28] dark:text-[#e5e5e2]",
    "dark:border-[#3e3e38]/50 dark:shadow-lg dark:shadow-black/20",
    
    // Prose base styling
    "prose prose-sm max-w-none",
    "prose-p:my-2 prose-p:leading-relaxed",
    "prose-headings:font-semibold prose-headings:tracking-tight",
    "prose-h1:text-xl prose-h2:text-lg prose-h3:text-base",
    "prose-ul:my-2 prose-ol:my-2",
    "prose-li:my-0.5",
    
    // === CODE STYLING - LIGHT MODE ===
    "prose-code:text-primary prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:text-sm prose-code:font-mono prose-code:before:content-none prose-code:after:content-none",
    "prose-pre:bg-muted prose-pre:border prose-pre:border-border prose-pre:rounded-xl prose-pre:my-3 prose-pre:shadow-sm",
    
    // === CODE STYLING - DARK MODE ===
    "dark:prose-code:text-[#d97757] dark:prose-code:bg-[#1a1a18] dark:prose-code:px-1.5 dark:prose-code:py-0.5 dark:prose-code:rounded-md dark:prose-code:text-sm dark:prose-code:font-mono",
    "dark:prose-pre:bg-[#1a1a18] dark:prose-pre:border-[#3e3e38]/50 dark:prose-pre:shadow-lg dark:prose-pre:shadow-black/30",
    
    // === LINKS ===
    "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
    "dark:prose-a:text-[#d97757]",
    
    // === STRONG/BOLD ===
    "prose-strong:font-semibold prose-strong:text-foreground",
    "dark:prose-strong:text-[#e5e5e2]",
    
    // === BLOCKQUOTES ===
    "prose-blockquote:border-l-primary prose-blockquote:text-muted-foreground prose-blockquote:italic prose-blockquote:pl-4",
    "dark:prose-blockquote:border-l-[#d97757] dark:prose-blockquote:text-[#b7b5a9]",
    
    // === LISTS ===
    "prose-li:marker:text-muted-foreground",
    "dark:prose-li:marker:text-[#b7b5a9]",
    
    // === HR ===
    "prose-hr:border-border",
    "dark:prose-hr:border-[#3e3e38]",
    
    // Word wrapping
    "break-words whitespace-pre-wrap",
    
    // Dark mode prose invert
    "dark:prose-invert",
    
    className
  );

  return markdown ? (
    <Markdown className={baseStyles} {...props}>
      {children as string}
    </Markdown>
  ) : (
    <div className={baseStyles} {...props}>
      {children}
    </div>
  );
};

export type MessageActionsProps = {
  children: React.ReactNode;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

const MessageActions = ({
  children,
  className,
  ...props
}: MessageActionsProps) => (
  <div
    className={cn(
      "flex items-center gap-1 mt-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200",
      "text-muted-foreground",
      "dark:text-[#b7b5a9]",
      className
    )}
    {...props}
  >
    {children}
  </div>
);

export type MessageActionProps = {
  className?: string;
  tooltip: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
} & React.ComponentProps<typeof Tooltip>;

const MessageAction = ({
  tooltip,
  children,
  className,
  side = "top",
  ...props
}: MessageActionProps) => {
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip {...props}>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent
          side={side}
          className={cn(
            "text-xs font-medium",
            // Light mode
            "bg-popover text-popover-foreground border-border",
            // Dark mode
            "dark:bg-[#30302e] dark:text-[#e5e5e2] dark:border-[#3e3e38]/50",
            className
          )}
        >
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};

// Additional helper component for message timestamps
export type MessageTimestampProps = {
  children: React.ReactNode;
  className?: string;
};

const MessageTimestamp = ({ children, className }: MessageTimestampProps) => (
  <span
    className={cn(
      "text-[11px] font-medium tracking-wide",
      // Light mode
      "text-muted-foreground/70",
      // Dark mode
      "dark:text-[#b7b5a9]/60",
      className
    )}
  >
    {children}
  </span>
);

// Helper component for message sender name
export type MessageSenderProps = {
  children: React.ReactNode;
  className?: string;
};

const MessageSender = ({ children, className }: MessageSenderProps) => (
  <span
    className={cn(
      "text-xs font-semibold tracking-tight",
      // Light mode
      "text-foreground",
      // Dark mode
      "dark:text-[#e5e5e2]",
      className
    )}
  >
    {children}
  </span>
);

export {
  Message,
  MessageAvatar,
  MessageContainer,
  MessageContent,
  MessageActions,
  MessageAction,
  MessageTimestamp,
  MessageSender,
};
