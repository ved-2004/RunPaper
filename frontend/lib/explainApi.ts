import { API_BASE_URL } from "./config";
import type { ExplainItem, ExplainPaperContext } from "@/contexts/ExplainContext";

function _authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

/**
 * POST /api/papers/{paperId}/explain
 * Returns a markdown-formatted explanation of the given item.
 */
export async function getExplanation(
  paperId: string,
  item: ExplainItem,
  paperContext: ExplainPaperContext,
): Promise<string> {
  const extractionSummary = paperContext.extraction
    ? [
        paperContext.extraction.title ?? "",
        paperContext.extraction.core_contribution ?? "",
        paperContext.extraction.method?.architecture ?? "",
      ]
        .filter(Boolean)
        .join(" — ")
    : "";

  const resp = await fetch(`${API_BASE_URL}/api/papers/${paperId}/explain`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ..._authHeaders(),
    },
    body: JSON.stringify({
      item_type: item.type,
      item_label: item.label,
      item_content: item.content,
      item_context: item.context ?? null,
      paper_title: paperContext.title ?? null,
      extraction_summary: extractionSummary || null,
    }),
  });

  if (!resp.ok) {
    throw new Error(`Explain request failed: ${resp.status}`);
  }

  const data = await resp.json();
  return data.explanation as string;
}
