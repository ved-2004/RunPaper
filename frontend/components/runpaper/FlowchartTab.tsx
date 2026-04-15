"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeProps,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Code2, Sigma, Info, X } from "lucide-react";
import { TexMath } from "@/components/ui/katex-math";
import type { FlowchartData, FlowchartNode, CodeScaffold } from "@/types/paper";

// ── Layout ────────────────────────────────────────────────────────────────────

const NODE_W = 200;
const NODE_H = 72;
const H_GAP = 100;
const V_GAP = 32;

function computePositions(nodes: FlowchartNode[]): Record<string, { x: number; y: number }> {
  const byLayer: Record<number, FlowchartNode[]> = {};
  for (const n of nodes) {
    (byLayer[n.layer] ??= []).push(n);
  }
  const positions: Record<string, { x: number; y: number }> = {};
  for (const [layerStr, layerNodes] of Object.entries(byLayer)) {
    const layer = Number(layerStr);
    const x = layer * (NODE_W + H_GAP);
    const totalH = layerNodes.length * NODE_H + (layerNodes.length - 1) * V_GAP;
    layerNodes.forEach((n, i) => {
      positions[n.id] = { x, y: i * (NODE_H + V_GAP) - totalH / 2 };
    });
  }
  return positions;
}

// ── Node colours ──────────────────────────────────────────────────────────────

const TYPE_STYLES: Record<string, { border: string; bg: string; badge: string }> = {
  input:   { border: "border-teal-500",   bg: "bg-teal-50 dark:bg-teal-950/40",   badge: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200" },
  process: { border: "border-violet-500", bg: "bg-violet-50 dark:bg-violet-950/40", badge: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200" },
  output:  { border: "border-blue-500",   bg: "bg-blue-50 dark:bg-blue-950/40",   badge: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  data:    { border: "border-amber-500",  bg: "bg-amber-50 dark:bg-amber-950/40",  badge: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
};

// ── Custom node ───────────────────────────────────────────────────────────────

function ArchNode({ data }: NodeProps) {
  const styles = TYPE_STYLES[data.type as string] ?? TYPE_STYLES.process;
  return (
    <div
      className={`w-[200px] rounded-lg border-2 ${styles.border} ${styles.bg} px-3 py-2 shadow-sm cursor-pointer select-none transition-shadow hover:shadow-md`}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />
      <div className="flex items-start justify-between gap-1">
        <p className="text-xs font-semibold leading-tight line-clamp-2">{data.label as string}</p>
        <span className={`shrink-0 rounded px-1 py-0.5 text-[9px] font-medium uppercase tracking-wide ${styles.badge}`}>
          {data.type as string}
        </span>
      </div>
      <p className="mt-1 text-[10px] text-muted-foreground line-clamp-2 leading-tight">
        {data.description as string}
      </p>
      <Handle type="source" position={Position.Right} className="!bg-muted-foreground" />
    </div>
  );
}

const nodeTypes = { arch: ArchNode };

// ── Code snippet extractor ────────────────────────────────────────────────────

function extractSnippet(code: string, ref: string, maxLines = 35): string {
  const lines = code.split("\n");
  const idx = lines.findIndex((l) => l.includes(ref));
  if (idx === -1) return `# "${ref}" not found in generated code`;
  return lines.slice(idx, Math.min(lines.length, idx + maxLines)).join("\n");
}

// ── Resizable drawer ──────────────────────────────────────────────────────────

const DRAWER_MIN = 320;
const DRAWER_DEFAULT = 480;
// Max = viewport width minus sidebar (≈240px) and a small gutter
const getDrawerMax = () =>
  typeof window !== "undefined" ? window.innerWidth - 260 : 1200;

interface DrawerProps {
  selected: FlowchartNode | null;
  onClose: () => void;
  snippet: string;
  styles: typeof TYPE_STYLES.process;
}

function NodeDrawer({ selected, onClose, snippet, styles }: DrawerProps) {
  const [width, setWidth] = useState(DRAWER_DEFAULT);
  const dragging = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(DRAWER_DEFAULT);

  // Reset width when a different node is selected
  useEffect(() => {
    if (selected) setWidth(DRAWER_DEFAULT);
  }, [selected?.id]);

  const onHandleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;
    startX.current = e.clientX;
    startWidth.current = width;
    document.body.style.cursor = "ew-resize";
    document.body.style.userSelect = "none";

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current) return;
      const delta = startX.current - ev.clientX;
      setWidth(Math.min(getDrawerMax(), Math.max(DRAWER_MIN, startWidth.current + delta)));
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };

    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [width]);

  if (!selected) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        className="fixed top-0 right-0 h-full bg-card border-l border-border shadow-2xl z-50 flex flex-col"
        style={{ width }}
      >
        {/* ── Drag handle ── */}
        <div
          className="absolute left-0 top-0 h-full w-2 cursor-ew-resize flex items-center justify-center group z-10"
          onMouseDown={onHandleMouseDown}
        >
          {/* Visible grip strip */}
          <div className="h-16 w-1 rounded-full bg-border group-hover:bg-primary transition-colors duration-150" />
        </div>

        {/* ── Header ── */}
        <div className="pl-5 pr-4 pt-5 pb-4 border-b border-border flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide ${styles.badge}`}>
              {selected.type}
            </span>
            <h2 className="text-base font-semibold truncate">{selected.label}</h2>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-md p-1.5 hover:bg-muted transition-colors ml-2"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Scrollable content ── */}
        <div className="flex-1 overflow-y-auto">
          <div className="pl-5 pr-5 py-4 space-y-4">
            {/* Description */}
            <div className="flex gap-2">
              <Info className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
              <p className="text-sm text-foreground leading-relaxed">{selected.description}</p>
            </div>

            {/* Math */}
            {selected.math && (
              <div className="rounded-lg bg-muted/50 px-4 py-3 flex gap-2 overflow-x-auto">
                <Sigma className="h-4 w-4 mt-0.5 shrink-0 text-muted-foreground" />
                <TexMath tex={selected.math} display />
              </div>
            )}

            {/* Details */}
            {selected.details && (
              <p className="text-xs text-muted-foreground leading-relaxed">{selected.details}</p>
            )}

            <Separator />

            {/* Code snippet */}
            <div>
              <div className="flex items-center gap-1.5 mb-2">
                <Code2 className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground">
                  {selected.code_file} — {selected.code_ref}
                </span>
              </div>
              <div className="rounded-lg bg-muted">
                <div className="overflow-x-scroll" style={{ maxWidth: "100%" }}>
                  <pre className="p-4 text-[11px] font-mono leading-relaxed text-foreground whitespace-pre">
                    {snippet}
                  </pre>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── Width hint ── */}
        <div className="px-5 py-2 border-t border-border shrink-0">
          <p className="text-[10px] text-muted-foreground/50 text-center select-none">
            ← drag left edge to resize
          </p>
        </div>
      </div>
    </>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

interface FlowchartTabProps {
  flowchart: FlowchartData;
  scaffold: CodeScaffold;
}

export function FlowchartTab({ flowchart, scaffold }: FlowchartTabProps) {
  const [selected, setSelected] = useState<FlowchartNode | null>(null);

  const positions = useMemo(() => computePositions(flowchart.nodes), [flowchart.nodes]);

  const initialNodes: Node[] = useMemo(
    () =>
      flowchart.nodes.map((n) => ({
        id: n.id,
        type: "arch",
        position: positions[n.id] ?? { x: 0, y: 0 },
        data: { ...n },
      })),
    [flowchart.nodes, positions],
  );

  const initialEdges: Edge[] = useMemo(
    () =>
      flowchart.edges.map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        label: e.label,
        animated: true,
        style: { stroke: "hsl(var(--muted-foreground))", strokeWidth: 1.5 },
        labelStyle: { fontSize: 10, fill: "hsl(var(--muted-foreground))" },
        labelBgStyle: { fill: "hsl(var(--card))" },
      })),
    [flowchart.edges],
  );

  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      const meta = flowchart.nodes.find((n) => n.id === node.id);
      if (meta) setSelected(meta);
    },
    [flowchart.nodes],
  );

  if (flowchart.nodes.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
        No architecture flowchart available for this paper.
      </div>
    );
  }

  const codeFile = selected
    ? selected.code_file === "train.py"
      ? scaffold.train_py
      : scaffold.model_py
    : "";
  const snippet = selected ? extractSnippet(codeFile, selected.code_ref) : "";
  const styles = selected ? (TYPE_STYLES[selected.type] ?? TYPE_STYLES.process) : TYPE_STYLES.process;

  return (
    <>
      <div className="w-full rounded-xl border border-border overflow-hidden" style={{ height: 520 }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          minZoom={0.4}
          maxZoom={2}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={16} size={1} color="hsl(var(--muted))" />
          <Controls showInteractive={false} className="[&>button]:bg-card [&>button]:border-border [&>button]:text-foreground" />
        </ReactFlow>
      </div>

      <p className="text-xs text-muted-foreground mt-2 text-center">
        Click any component to see its details and code
      </p>

      <NodeDrawer
        selected={selected}
        onClose={() => setSelected(null)}
        snippet={snippet}
        styles={styles}
      />
    </>
  );
}
