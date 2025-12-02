"use client"

import { cn } from "@/lib/utils"
import React, { useEffect, useState } from "react"
import { codeToHtml } from "shiki"
import { useTheme } from "next-themes"

export type CodeBlockProps = {
  children?: React.ReactNode
  className?: string
} & React.HTMLProps<HTMLDivElement>

function CodeBlock({ children, className, ...props }: CodeBlockProps) {
  return (
    <div
      className={cn(
        "not-prose flex w-full flex-col overflow-clip border rounded-xl",
        // Light mode
        "border-border bg-card text-card-foreground",
        // Dark mode
        "dark:border-border/30 dark:bg-[#1a1a18] dark:text-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export type CodeBlockCodeProps = {
  code: string
  language?: string
  className?: string
} & React.HTMLProps<HTMLDivElement>

function CodeBlockCode({
  code,
  language = "tsx",
  className,
  ...props
}: CodeBlockCodeProps) {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null)
  const { resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    async function highlight() {
      if (!code) {
        setHighlightedHtml("<pre><code></code></pre>")
        return
      }

      // Use appropriate theme based on current mode
      const theme = resolvedTheme === "dark" ? "github-dark" : "github-light"
      const html = await codeToHtml(code, { lang: language, theme })
      setHighlightedHtml(html)
    }

    if (mounted) {
      highlight()
    }
  }, [code, language, resolvedTheme, mounted])

  const classNames = cn(
    "w-full overflow-x-auto text-[13px]",
    "[&>pre]:px-4 [&>pre]:py-4",
    // Light mode
    "[&>pre]:bg-muted/50",
    // Dark mode
    "dark:[&>pre]:bg-[#1a1a18]",
    className
  )

  // SSR fallback: render plain code if not hydrated yet
  return highlightedHtml ? (
    <div
      className={classNames}
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
      {...props}
    />
  ) : (
    <div className={classNames} {...props}>
      <pre className={cn(
        "bg-muted/50 dark:bg-[#1a1a18]"
      )}>
        <code className="text-foreground">{code}</code>
      </pre>
    </div>
  )
}

export type CodeBlockGroupProps = React.HTMLAttributes<HTMLDivElement>

function CodeBlockGroup({
  children,
  className,
  ...props
}: CodeBlockGroupProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between px-4 py-2",
        // Light mode
        "bg-muted/30 border-b border-border",
        // Dark mode
        "dark:bg-[#232320] dark:border-border/30",
        className
      )}
      {...props}
    >
      {children}
    </div>
  )
}

export { CodeBlockGroup, CodeBlockCode, CodeBlock }
