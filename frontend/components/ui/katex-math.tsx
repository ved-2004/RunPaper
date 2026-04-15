"use client";

import { useEffect, useRef } from "react";
import "katex/dist/katex.min.css";

interface TexMathProps {
  tex: string;
  display?: boolean;
  className?: string;
}

/**
 * Renders a LaTeX string using KaTeX.
 * Falls back to showing the raw string if KaTeX can't parse it.
 */
export function TexMath({ tex, display = false, className = "" }: TexMathProps) {
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    import("katex").then((katex) => {
      katex.default.render(tex, ref.current!, {
        displayMode: display,
        throwOnError: false,
        output: "html",
        trust: false,
      });
    }).catch(() => {
      if (ref.current) ref.current.textContent = tex;
    });
  }, [tex, display]);

  return (
    <span
      ref={ref}
      className={display ? `block my-1 ${className}` : `inline ${className}`}
    />
  );
}
