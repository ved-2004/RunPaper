"use client";

import { createContext, useContext, useRef, useState } from "react";
import type { PaperExtraction, FlowchartData } from "@/types/paper";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ExplainItem {
  type: "flowchart_node" | "equation" | "hyperparameter" | "code_annotation";
  label: string;
  content: string;
  context?: string;
  chatPreload?: string;
}

export interface ExplainPaperContext {
  title: string | null;
  extraction: PaperExtraction | null;
  flowchart: FlowchartData | null;
}

interface ExplainContextValue {
  isOpen: boolean;
  item: ExplainItem | null;
  paperId: string | null;
  paperContext: ExplainPaperContext | null;
  position: { x: number; y: number };
  size: { width: number; height: number };
  openExplain: (item: ExplainItem, paperId: string, paperContext: ExplainPaperContext) => void;
  closeExplain: () => void;
  setPosition: (pos: { x: number; y: number }) => void;
  setSize: (size: { width: number; height: number }) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ExplainContext = createContext<ExplainContextValue | null>(null);

const DEFAULT_W = 400;
const DEFAULT_H = 480;

export function ExplainProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [item, setItem] = useState<ExplainItem | null>(null);
  const [paperId, setPaperId] = useState<string | null>(null);
  const [paperContext, setPaperContext] = useState<ExplainPaperContext | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: DEFAULT_W, height: DEFAULT_H });
  const positionInitialized = useRef(false);

  const openExplain = (
    newItem: ExplainItem,
    newPaperId: string,
    newPaperContext: ExplainPaperContext,
  ) => {
    setItem(newItem);
    setPaperId(newPaperId);
    setPaperContext(newPaperContext);

    // First open: place panel at top-right, clear of the sidebar
    if (!positionInitialized.current) {
      const x = Math.max(0, window.innerWidth - DEFAULT_W - 24);
      const y = 80;
      setPosition({ x, y });
      positionInitialized.current = true;
    }

    setIsOpen(true);
  };

  const closeExplain = () => setIsOpen(false);

  return (
    <ExplainContext.Provider
      value={{
        isOpen, item, paperId, paperContext,
        position, size,
        openExplain, closeExplain,
        setPosition, setSize,
      }}
    >
      {children}
    </ExplainContext.Provider>
  );
}

export function useExplain() {
  const ctx = useContext(ExplainContext);
  if (!ctx) throw new Error("useExplain must be used inside ExplainProvider");
  return ctx;
}
