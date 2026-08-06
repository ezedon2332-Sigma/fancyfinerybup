/** Shared AI-concierge types — safe to import from client and server. */

export interface QuickAction {
  label: string;
  href: string;
}

/** The subset of AI config safe to hand a browser (no persona / model). */
export interface AiPublicConfig {
  enabled: boolean;
  welcomeMessage: string;
  suggestedQuestions: string[];
  quickActions: QuickAction[];
}

export interface ConciergeProduct {
  name: string;
  slug: string;
  /** Pre-formatted price string, e.g. "₦300,000". */
  price: string;
  imageUrl: string | null;
  sizes: string[];
  colors: string[];
  inStock: boolean;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

/** One line of the NDJSON stream the chat route returns. */
export type ConciergeStreamEvent =
  | { type: "session"; token: string }
  | { type: "text"; text: string }
  | { type: "products"; items: ConciergeProduct[] }
  | { type: "handoff" }
  | { type: "error"; message: string }
  | { type: "done" };

/** A message on the customer-facing transcript (poll endpoint). */
export interface ConciergeTranscriptMessage {
  id: string;
  /** "agent" = a human staff reply. */
  role: "user" | "assistant" | "agent" | "system";
  content: string;
  createdAt: string;
}
