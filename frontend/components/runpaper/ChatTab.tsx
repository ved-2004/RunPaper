"use client";

import { useEffect, useRef, useState } from "react";
import { sendMessage } from "@/lib/chatApi";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Loader2, Bot, User, Code2, Workflow,
  GraduationCap, Zap, RotateCcw, Lock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ChatMessage, ChatResponse } from "@/types/chat";

// ── Markdown-lite renderer ────────────────────────────────────────────────────
// Renders **bold**, `code`, and bullet points without a heavy markdown lib.

function renderMarkdown(text: string): React.ReactNode[] {
  return text.split("\n").map((line, i) => {
    // Bullet point
    if (line.trimStart().startsWith("- ") || line.trimStart().startsWith("• ")) {
      const content = line.replace(/^[\s\-•]+/, "");
      return (
        <li key={i} className="ml-4 list-disc">
          {inlineFormat(content)}
        </li>
      );
    }
    // Empty line
    if (!line.trim()) return <br key={i} />;
    return <p key={i}>{inlineFormat(line)}</p>;
  });
}

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={i} className="bg-muted px-1 py-0.5 rounded text-[11px] font-mono">
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

// ── Message bubble ────────────────────────────────────────────────────────────

function UserBubble({ content }: { content: string }) {
  return (
    <div className="flex items-start gap-2.5 justify-end">
      <div className="max-w-[80%] rounded-2xl rounded-tr-sm bg-primary px-4 py-2.5 text-primary-foreground text-sm leading-relaxed">
        {content}
      </div>
      <div className="h-7 w-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
        <User className="h-3.5 w-3.5 text-primary" />
      </div>
    </div>
  );
}

function AssistantBubble({
  content,
  codeRefs,
  flowchartRefs,
  followUp,
  isLoading,
}: {
  content: string;
  codeRefs: ChatResponse["code_refs"];
  flowchartRefs: string[];
  followUp: string | null;
  isLoading?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 text-primary animate-spin" />
        ) : (
          <Bot className="h-3.5 w-3.5 text-primary" />
        )}
      </div>
      <div className="max-w-[85%] space-y-2">
        {isLoading ? (
          <div className="flex gap-1 pt-2">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="h-2 w-2 rounded-full bg-muted-foreground/40 animate-bounce"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </div>
        ) : (
          <>
            <div className="rounded-2xl rounded-tl-sm bg-card border border-border px-4 py-3 text-sm leading-relaxed space-y-1">
              {renderMarkdown(content)}
            </div>

            {/* Code refs */}
            {codeRefs.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {codeRefs.map((ref, i) => (
                  <div
                    key={i}
                    title={ref.description}
                    className="flex items-center gap-1 rounded-full border border-border bg-secondary/50 px-2.5 py-1 text-[10px] font-mono cursor-default"
                  >
                    <Code2 className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{ref.file}</span>
                    <span className="text-foreground font-medium">{ref.ref}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Flowchart refs */}
            {flowchartRefs.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {flowchartRefs.map((ref, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-1 rounded-full border border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-950/30 px-2.5 py-1 text-[10px]"
                  >
                    <Workflow className="h-3 w-3 text-violet-500" />
                    <span className="text-violet-700 dark:text-violet-300">{ref.replaceAll("_", " ")}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Socratic follow-up */}
            {followUp && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/20 px-3 py-2 text-xs text-amber-800 dark:text-amber-200 italic">
                💭 {followUp}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main ChatTab ──────────────────────────────────────────────────────────────

interface ChatTabProps {
  paperId: string;
  status: string;
}

export function ChatTab({ paperId, status }: ChatTabProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [responses, setResponses] = useState<Map<number, ChatResponse>>(new Map());
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<"direct" | "socratic">("direct");
  const bottomRef = useRef<HTMLDivElement>(null);

  const isReady = status === "complete";

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const handleSend = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMsg: ChatMessage = { role: "user", content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await sendMessage(paperId, trimmed, messages, mode);
      const assistantMsg: ChatMessage = { role: "assistant", content: res.answer };
      const idx = newMessages.length;
      setMessages([...newMessages, assistantMsg]);
      setResponses((prev) => new Map(prev).set(idx, res));
    } catch {
      const errMsg: ChatMessage = {
        role: "assistant",
        content: "Sorry, something went wrong. Please try again.",
      };
      setMessages([...newMessages, errMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(input);
    }
  };

  const handleReset = () => {
    setMessages([]);
    setResponses(new Map());
    setInput("");
  };

  if (!isReady) {
    return (
      <div className="flex flex-col items-center justify-center h-[75vh] rounded-xl border border-border bg-card gap-3 text-muted-foreground">
        <Lock className="h-8 w-8 opacity-30" />
        <p className="text-sm font-medium">Chat available once analysis is complete</p>
        <p className="text-xs opacity-60">Still generating code and architecture diagram…</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[75vh] rounded-xl border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-secondary/20">
        <div className="flex items-center gap-2">
          <Bot className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Ask about this paper</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Mode toggle */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-background p-0.5">
            <button
              onClick={() => setMode("direct")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors",
                mode === "direct"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Zap className="h-3 w-3" />
              Direct
            </button>
            <button
              onClick={() => setMode("socratic")}
              className={cn(
                "flex items-center gap-1 rounded-md px-2.5 py-1 text-xs transition-colors",
                mode === "socratic"
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <GraduationCap className="h-3 w-3" />
              Socratic
            </button>
          </div>
          {messages.length > 0 && (
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleReset}>
              <RotateCcw className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-4">
        <div className="space-y-4">
          {/* Empty state */}
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Bot className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium">Ask anything about this paper</p>
              <p className="text-xs text-muted-foreground mt-1">
                {mode === "socratic"
                  ? "Socratic mode: I'll guide your thinking with questions rather than just answering."
                  : "Direct mode: I'll answer grounded in the paper and generated code."}
              </p>
            </div>
          )}

          {/* Conversation */}
          {messages.map((msg, i) => {
            if (msg.role === "user") {
              return <UserBubble key={i} content={msg.content} />;
            }
            const resp = responses.get(i);
            return (
              <AssistantBubble
                key={i}
                content={msg.content}
                codeRefs={resp?.code_refs ?? []}
                flowchartRefs={resp?.flowchart_refs ?? []}
                followUp={resp?.follow_up ?? null}
              />
            );
          })}

          {/* Loading bubble */}
          {isLoading && (
            <AssistantBubble
              content=""
              codeRefs={[]}
              flowchartRefs={[]}
              followUp={null}
              isLoading
            />
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <Separator />

      {/* Input */}
      <div className="px-4 py-3 flex gap-2 items-end">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            mode === "socratic"
              ? "Ask a question — I'll guide your thinking..."
              : "Ask about the architecture, code, or any detail..."
          }
          rows={2}
          className="resize-none text-sm min-h-[60px]"
          disabled={isLoading}
        />
        <Button
          size="icon"
          onClick={() => handleSend(input)}
          disabled={!input.trim() || isLoading}
          className="h-10 w-10 shrink-0"
        >
          {isLoading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>
    </div>
  );
}
