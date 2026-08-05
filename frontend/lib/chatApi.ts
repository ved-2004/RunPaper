import { API_BASE_URL } from "./config";
import type { ChatMessage, ChatResponse } from "@/types/chat";

function _authHeaders(): Record<string, string> {
  const token =
    typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function sendMessage(
  paperId: string,
  message: string,
  history: ChatMessage[],
  mode: "direct" | "socratic",
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE_URL}/api/papers/${paperId}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ..._authHeaders() },
    body: JSON.stringify({ message, history, mode }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(err || "Chat request failed");
  }
  return res.json();
}
