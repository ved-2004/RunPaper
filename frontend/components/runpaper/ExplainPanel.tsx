"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X, GripHorizontal, Sparkles, ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useExplain } from "@/contexts/ExplainContext";
import { getExplanation } from "@/lib/explainApi";

// ── Constants ─────────────────────────────────────────────────────────────────

const MIN_W = 320;
const MIN_H = 280;
const MAX_W_VW = 0.7;
const MAX_H_VH = 0.8;

const TYPE_LABELS: Record<string, string> = {
  flowchart_node:  "flowchart node",
  equation:        "equation",
  hyperparameter:  "hyperparameter",
  code_annotation: "code",
};

// ── Markdown-lite renderer ────────────────────────────────────────────────────
// Mirrors ChatTab's renderMarkdown — handles **bold**, `code`, ## headers, bullets.

function inlineFormat(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i}>{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={i}
          className="bg-muted px-1 py-0.5 rounded text-[11px] font-mono"
          style={{ wordBreak: "break-all" }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function renderMarkdown(text: string): React.ReactNode[] {
  return text.split("\n").map((line, i) => {
    if (line.trimStart().startsWith("## ")) {
      return (
        <h3 key={i} className="font-semibold text-sm mt-3 mb-1 first:mt-0">
          {line.replace(/^#+\s*/, "")}
        </h3>
      );
    }
    if (line.trimStart().startsWith("# ")) {
      return (
        <h2 key={i} className="font-bold text-sm mt-3 mb-1 first:mt-0">
          {line.replace(/^#+\s*/, "")}
        </h2>
      );
    }
    if (line.trimStart().startsWith("- ") || line.trimStart().startsWith("• ")) {
      const content = line.replace(/^[\s\-•]+/, "");
      return (
        <li key={i} className="ml-4 list-disc text-sm leading-relaxed">
          {inlineFormat(content)}
        </li>
      );
    }
    if (!line.trim()) return <br key={i} />;
    return (
      <p key={i} className="text-sm leading-relaxed">
        {inlineFormat(line)}
      </p>
    );
  });
}

// ── Loading skeleton ──────────────────────────────────────────────────────────

function LoadingSkeleton() {
  return (
    <div className="space-y-2 animate-pulse pt-1">
      <div className="h-2.5 bg-muted rounded-full w-full" />
      <div className="h-2.5 bg-muted rounded-full w-4/5" />
      <div className="h-2.5 bg-muted rounded-full w-full" />
      <div className="h-2.5 bg-muted rounded-full w-3/5" />
      <div className="h-2.5 bg-muted rounded-full w-full mt-4" />
      <div className="h-2.5 bg-muted rounded-full w-4/5" />
      <div className="h-2.5 bg-muted rounded-full w-2/3" />
    </div>
  );
}

// ── ExplainPanel ──────────────────────────────────────────────────────────────

export function ExplainPanel() {
  const {
    isOpen, item, paperId, paperContext,
    position, size,
    setPosition, setSize, closeExplain,
  } = useExplain();

  const [explanation, setExplanation] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  // Track which item is currently explained to avoid duplicate fetches
  const prevItemKey = useRef<string | null>(null);
  const itemKey = item ? `${item.type}:${item.label}:${item.content.slice(0, 40)}` : null;

  // ── Mount (portal needs browser) ─────────────────────────────────────────────
  useEffect(() => { setMounted(true); }, []);

  // ── Visibility transition ─────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      // Defer one frame so the element exists before transition fires
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    } else {
      setVisible(false);
    }
  }, [isOpen]);

  // ── Fetch explanation when item changes ───────────────────────────────────────
  useEffect(() => {
    if (!item || !paperId || !paperContext || !isOpen) return;
    if (itemKey === prevItemKey.current) return;

    prevItemKey.current = itemKey;
    setLoading(true);
    setExplanation(null);
    setError(null);

    getExplanation(paperId, item, paperContext)
      .then((exp) => setExplanation(exp))
      .catch(() => setError("Could not load explanation. Please try again."))
      .finally(() => setLoading(false));
  }, [itemKey, isOpen, paperId, paperContext, item]);

  // ── Escape key ────────────────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) closeExplain();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, closeExplain]);

  // ── Drag ──────────────────────────────────────────────────────────────────────
  const dragRef = useRef<{
    mouseX: number; mouseY: number; panelX: number; panelY: number;
  } | null>(null);

  const onDragMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = {
        mouseX: e.clientX, mouseY: e.clientY,
        panelX: position.x, panelY: position.y,
      };
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";

      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const maxW = Math.min(window.innerWidth * MAX_W_VW, size.width);
        const maxH = Math.min(window.innerHeight * MAX_H_VH, size.height);
        const newX = Math.max(
          0,
          Math.min(
            window.innerWidth - maxW,
            dragRef.current.panelX + (ev.clientX - dragRef.current.mouseX),
          ),
        );
        const newY = Math.max(
          0,
          Math.min(
            window.innerHeight - maxH,
            dragRef.current.panelY + (ev.clientY - dragRef.current.mouseY),
          ),
        );
        setPosition({ x: newX, y: newY });
      };

      const onUp = () => {
        dragRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [position, size, setPosition],
  );

  // ── Resize ────────────────────────────────────────────────────────────────────
  const resizeRef = useRef<{
    mouseX: number; mouseY: number; w: number; h: number;
  } | null>(null);

  const onResizeMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      resizeRef.current = {
        mouseX: e.clientX, mouseY: e.clientY,
        w: size.width, h: size.height,
      };
      document.body.style.cursor = "se-resize";
      document.body.style.userSelect = "none";

      const onMove = (ev: MouseEvent) => {
        if (!resizeRef.current) return;
        const newW = Math.min(
          window.innerWidth * MAX_W_VW,
          Math.max(MIN_W, resizeRef.current.w + (ev.clientX - resizeRef.current.mouseX)),
        );
        const newH = Math.min(
          window.innerHeight * MAX_H_VH,
          Math.max(MIN_H, resizeRef.current.h + (ev.clientY - resizeRef.current.mouseY)),
        );
        setSize({ width: newW, height: newH });
      };

      const onUp = () => {
        resizeRef.current = null;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
    },
    [size, setSize],
  );

  // Don't render on server or when closed
  if (!mounted || !isOpen) return null;

  const chatHref = item?.chatPreload
    ? `/papers/${paperId}?tab=chat&q=${encodeURIComponent(item.chatPreload)}`
    : `/papers/${paperId}?tab=chat`;

  const panel = (
    <div
      style={{
        position: "fixed",
        left: position.x,
        top: position.y,
        width: size.width,
        height: size.height,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        // Scale-fade entrance
        transformOrigin: "top right",
        transform: visible ? "scale(1)" : "scale(0.95)",
        opacity: visible ? 1 : 0,
        transition: "transform 0.15s ease, opacity 0.15s ease",
        // Prevent flex children from overflowing
        minWidth: 0,
      }}
      className="rounded-xl border border-border bg-card shadow-2xl overflow-hidden"
    >
      {/* ── Header / drag handle ── */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-secondary/40
                   cursor-grab active:cursor-grabbing shrink-0 select-none"
        onMouseDown={onDragMouseDown}
      >
        <GripHorizontal className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
        <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
        <p
          className="flex-1 min-w-0 text-sm font-semibold truncate"
          title={item?.label}
        >
          {item?.label ?? "Explain"}
        </p>
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={closeExplain}
          className="shrink-0 rounded-md p-1 hover:bg-muted transition-colors"
          aria-label="Close"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Body ── */}
      <div
        className="flex-1 min-h-0 overflow-y-auto px-4 py-3"
        style={{ wordBreak: "break-word", overflowWrap: "break-word" }}
      >
        {/* Context chip */}
        {item?.type && (
          <Badge variant="secondary" className="mb-3 text-[10px] font-medium">
            {TYPE_LABELS[item.type] ?? item.type}
          </Badge>
        )}

        {loading ? (
          <LoadingSkeleton />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : explanation ? (
          <div
            key={itemKey ?? undefined}
            className="space-y-0.5"
            style={{ animation: "fade-in 0.2s ease" }}
          >
            {renderMarkdown(explanation)}
          </div>
        ) : null}
      </div>

      {/* ── Footer: deep-link to Chat ── */}
      {!loading && (explanation || error) && (
        <div className="shrink-0 px-3 py-2 border-t border-border bg-secondary/20">
          <a
            href={chatHref}
            className="flex items-center gap-1 text-xs text-muted-foreground
                       hover:text-primary transition-colors"
          >
            Ask follow-up in Chat
            <ArrowRight className="h-3 w-3" />
          </a>
        </div>
      )}

      {/* ── Resize handle (bottom-right corner) ── */}
      <div
        onMouseDown={onResizeMouseDown}
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize z-10"
        style={{
          backgroundImage:
            "radial-gradient(circle, hsl(var(--border)/0.8) 1px, transparent 1px)",
          backgroundSize: "4px 4px",
          backgroundPosition: "center",
        }}
      />
    </div>
  );

  return createPortal(panel, document.body);
}
