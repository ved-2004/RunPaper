export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CodeRef {
  file: string;
  ref: string;
  description: string;
}

export interface ChatResponse {
  answer: string;
  code_refs: CodeRef[];
  flowchart_refs: string[];
  follow_up: string | null;
}

export interface FaqItem {
  question: string;
  answer: string;
  code_ref: string | null;
  code_file: string | null;
}
