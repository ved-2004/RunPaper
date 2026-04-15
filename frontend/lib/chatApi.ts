import { API_BASE_URL } from "./config";
import type { ChatMessage, ChatResponse, FaqItem } from "@/types/chat";

export async function getFaq(paperId: string): Promise<FaqItem[]> {
  const res = await fetch(`${API_BASE_URL}/api/papers/${paperId}/faq`);
  if (!res.ok) return [];
  return res.json();
}

export async function sendMessage(
  paperId: string,
  message: string,
  history: ChatMessage[],
  mode: "direct" | "socratic",
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE_URL}/api/papers/${paperId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history, mode }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Chat request failed");
  }
  return res.json();
}
