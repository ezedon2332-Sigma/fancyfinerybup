"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import ReactMarkdown from "react-markdown";
import { Headset, Send, Sparkles } from "lucide-react";

import type {
  AiPublicConfig,
  ConciergeProduct,
  ConciergeStreamEvent,
  ConciergeTranscriptMessage,
} from "@/lib/ai-types";

type Role = "user" | "assistant" | "agent" | "system";

interface UiMessage {
  id: string;
  role: Role;
  content: string;
  products?: ConciergeProduct[];
}

const STORAGE_KEY = "ff.concierge.v2";
let idSeq = 0;
const nextId = () => `m${Date.now()}-${idSeq++}`;

interface Saved {
  messages: UiMessage[];
  token: string | null;
  mode: "bot" | "human";
  lastPolled: string | null;
}

export function ConciergePanel({ config }: { config: AiPublicConfig }) {
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"bot" | "human">("bot");

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const tokenRef = useRef<string | null>(null);
  const modeRef = useRef<"bot" | "human">("bot");
  const lastPolledRef = useRef<string | null>(null);
  const seenRef = useRef<Set<string>>(new Set());
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  modeRef.current = mode;

  const patch = useCallback((id: string, fn: (m: UiMessage) => UiMessage) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? fn(m) : m)));
  }, []);

  const pollOnce = useCallback(async () => {
    const token = tokenRef.current;
    if (!token) return;
    try {
      const res = await fetch("/api/ai/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "poll",
          token,
          after: lastPolledRef.current ?? undefined,
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        status: string;
        messages: ConciergeTranscriptMessage[];
      };
      const fresh = data.messages.filter((m) => !seenRef.current.has(m.id));
      if (fresh.length) {
        fresh.forEach((m) => seenRef.current.add(m.id));
        lastPolledRef.current = fresh[fresh.length - 1].createdAt;
        setMessages((prev) => [
          ...prev,
          ...fresh.map((m) => ({
            id: m.id,
            role: m.role as Role,
            content: m.content,
          })),
        ]);
      }
    } catch {
      /* transient — try again next tick */
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollTimer.current) return;
    lastPolledRef.current = lastPolledRef.current ?? new Date().toISOString();
    pollTimer.current = setInterval(pollOnce, 4000);
  }, [pollOnce]);

  // Restore this session's conversation (per-tab) after mount.
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Saved;
        tokenRef.current = saved.token ?? null;
        lastPolledRef.current = saved.lastPolled ?? null;
        if (Array.isArray(saved.messages) && saved.messages.length) {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- post-mount hydration
          setMessages(saved.messages);
        }
        if (saved.mode === "human") {
          // eslint-disable-next-line react-hooks/set-state-in-effect -- post-mount hydration
          setMode("human");
          startPolling();
        }
      }
    } catch {
      /* ignore */
    }
    inputRef.current?.focus();
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, [startPolling]);

  // Persist + autoscroll.
  useEffect(() => {
    try {
      const saved: Saved = {
        messages: messages.slice(-40),
        token: tokenRef.current,
        mode,
        lastPolled: lastPolledRef.current,
      };
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
    } catch {
      /* ignore */
    }
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, mode]);

  const enterHumanMode = useCallback(() => {
    if (modeRef.current !== "human") {
      setMode("human");
      startPolling();
    }
  }, [startPolling]);

  const sendBot = useCallback(
    async (history: UiMessage[], assistantId: string) => {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          token: tokenRef.current ?? undefined,
          messages: history
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      if (!res.ok || !res.body) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "The concierge is unavailable right now.");
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      let gotText = false;
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buf.indexOf("\n")) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (!line) continue;
          let ev: ConciergeStreamEvent;
          try {
            ev = JSON.parse(line) as ConciergeStreamEvent;
          } catch {
            continue;
          }
          if (ev.type === "session") {
            tokenRef.current = ev.token;
          } else if (ev.type === "text") {
            gotText = true;
            patch(assistantId, (m) => ({ ...m, content: m.content + ev.text }));
          } else if (ev.type === "products") {
            patch(assistantId, (m) => ({ ...m, products: ev.items }));
          } else if (ev.type === "handoff") {
            enterHumanMode();
          } else if (ev.type === "error") {
            setError(ev.message);
          }
        }
      }
      if (!gotText) {
        patch(assistantId, (m) =>
          m.content ? m : { ...m, content: "How can I help you shop today?" },
        );
      }
    },
    [patch, enterHumanMode],
  );

  const sendHuman = useCallback(async (text: string) => {
    const token = tokenRef.current;
    if (!token) return;
    await fetch("/api/ai/messages", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "send", token, content: text }),
    });
    // Agent replies arrive via polling.
  }, []);

  const send = useCallback(
    async (text: string) => {
      const value = text.trim();
      if (!value || streaming) return;
      setError(null);
      const userMsg: UiMessage = { id: nextId(), role: "user", content: value };
      setInput("");

      if (modeRef.current === "human") {
        setMessages((prev) => [...prev, userMsg]);
        setStreaming(true);
        try {
          await sendHuman(value);
        } catch {
          setError("Couldn't send your message. Please try again.");
        } finally {
          setStreaming(false);
          inputRef.current?.focus();
        }
        return;
      }

      const assistantId = nextId();
      const history = [...messages, userMsg];
      setMessages([...history, { id: assistantId, role: "assistant", content: "" }]);
      setStreaming(true);
      try {
        await sendBot(history, assistantId);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
        setMessages((prev) => prev.filter((m) => m.id !== assistantId || m.content));
      } finally {
        setStreaming(false);
        inputRef.current?.focus();
      }
    },
    [messages, streaming, sendBot, sendHuman],
  );

  const started = messages.length > 0;

  return (
    <div className="flex h-full flex-col">
      <div
        ref={scrollRef}
        className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
        aria-live="polite"
      >
        {mode === "human" && (
          <div className="rounded-xl border border-yellow-600/30 bg-yellow-500/5 px-3 py-2 text-center text-xs text-yellow-200">
            You’re connected with our team — a stylist will reply here shortly.
          </div>
        )}

        {/* Greeting */}
        <div className="flex gap-2.5">
          <BotCrest />
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-white/[0.04] px-3.5 py-2.5 text-sm text-gray-200">
            {config.welcomeMessage}
          </div>
        </div>

        {messages.map((m) => {
          if (m.role === "user") {
            return (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-yellow-500/90 px-3.5 py-2.5 text-sm font-medium text-black">
                  {m.content}
                </div>
              </div>
            );
          }
          if (m.role === "system") {
            return (
              <p key={m.id} className="text-center text-[11px] text-gray-500">
                {m.content}
              </p>
            );
          }
          const isAgent = m.role === "agent";
          return (
            <div key={m.id} className="flex gap-2.5">
              {isAgent ? <AgentCrest /> : <BotCrest />}
              <div className="max-w-[85%] space-y-2">
                {isAgent && (
                  <span className="text-[10px] uppercase tracking-widest text-yellow-500/80">
                    Fancy Finery Team
                  </span>
                )}
                {m.content ? (
                  <div className="prose-concierge rounded-2xl rounded-tl-sm bg-white/[0.04] px-3.5 py-2.5 text-sm text-gray-200">
                    {isAgent ? (
                      <p className="whitespace-pre-wrap">{m.content}</p>
                    ) : (
                      <ReactMarkdown
                        components={{
                          a: ({ ...props }) => (
                            <a
                              {...props}
                              className="font-medium text-yellow-400 underline decoration-yellow-500/40 underline-offset-2 hover:text-yellow-300"
                            />
                          ),
                          p: ({ ...props }) => (
                            <p {...props} className="my-1 first:mt-0 last:mb-0" />
                          ),
                          ul: ({ ...props }) => (
                            <ul {...props} className="my-1 list-disc pl-4" />
                          ),
                          strong: ({ ...props }) => (
                            <strong {...props} className="text-white" />
                          ),
                        }}
                      >
                        {m.content}
                      </ReactMarkdown>
                    )}
                  </div>
                ) : (
                  <TypingDots />
                )}
                {m.products && m.products.length > 0 && (
                  <div className="space-y-2">
                    {m.products.map((p) => (
                      <ProductCard key={p.slug} product={p} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {error && (
          <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-300">
            {error}
          </p>
        )}
      </div>

      {!started && mode === "bot" && (
        <div className="space-y-2 px-4 pb-2">
          {config.suggestedQuestions.slice(0, 4).map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => send(q)}
              className="block w-full rounded-full border border-white/10 bg-white/[0.03] px-3.5 py-2 text-left text-xs text-gray-300 transition-colors hover:border-yellow-500/40 hover:text-yellow-300"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {config.quickActions.length > 0 && mode === "bot" && (
        <div className="flex flex-wrap gap-1.5 border-t border-white/5 px-4 py-2">
          {config.quickActions.map((a) => (
            <a
              key={a.href + a.label}
              href={a.href}
              className="rounded-full border border-white/10 px-2.5 py-1 text-[11px] text-gray-400 transition-colors hover:border-yellow-500/40 hover:text-yellow-300"
            >
              {a.label}
            </a>
          ))}
        </div>
      )}

      <form
        className="flex items-end gap-2 border-t border-white/10 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
      >
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder={mode === "human" ? "Message our team…" : "Ask the concierge…"}
          aria-label="Message"
          className="max-h-28 flex-1 resize-none rounded-xl border border-white/15 bg-black/40 px-3 py-2 text-sm text-white outline-none transition-colors placeholder:text-gray-500 focus:border-yellow-500"
        />
        <button
          type="submit"
          disabled={streaming || !input.trim()}
          aria-label="Send"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-yellow-500 text-black transition-colors hover:bg-yellow-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}

function BotCrest() {
  return (
    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-yellow-600 text-black">
      <Sparkles className="h-3.5 w-3.5" />
    </div>
  );
}

function AgentCrest() {
  return (
    <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-yellow-500/50 bg-black text-yellow-400">
      <Headset className="h-3.5 w-3.5" />
    </div>
  );
}

function TypingDots() {
  return (
    <div className="flex items-center gap-1 rounded-2xl rounded-tl-sm bg-white/[0.04] px-3.5 py-3">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-bounce rounded-full bg-yellow-500/70"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </div>
  );
}

function ProductCard({ product }: { product: ConciergeProduct }) {
  return (
    <a
      href={`/products/${product.slug}`}
      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-2 transition-colors hover:border-yellow-500/40"
    >
      <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded-md bg-black/40">
        {product.imageUrl ? (
          <Image
            src={product.imageUrl}
            alt={product.name}
            fill
            sizes="48px"
            className="object-cover"
          />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-medium text-white">{product.name}</p>
        <p className="text-xs text-yellow-400">{product.price}</p>
        <p className="mt-0.5 text-[10px] text-gray-500">
          {product.inStock ? "In stock" : "Currently unavailable"}
          {product.sizes.length ? ` · ${product.sizes.slice(0, 4).join(", ")}` : ""}
        </p>
      </div>
    </a>
  );
}
