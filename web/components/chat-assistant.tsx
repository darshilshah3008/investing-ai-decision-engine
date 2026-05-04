"use client";

// ChatAssistant — floating button + modal that lets Pro users chat with
// Claude about their portfolio.
//
// Two context modes:
//   - "verdict"   — current stock page; sends ticker
//   - "portfolio" — watchlist page; sends watchlist ID
//
// Hidden entirely for non-Pro users (no floating button shown). Server-side
// enforces the same gate at /api/chat (defense in depth).

import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/firebase/auth-context";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

type ContextSpec =
  | { kind: "verdict"; ticker: string; companyName?: string }
  | { kind: "portfolio"; watchlistId: string; watchlistName?: string };

interface Props {
  context: ContextSpec;
}

export function ChatAssistant({ context }: Props) {
  const { user, tier, configured } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll on new message
  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  // Reset chat when context changes (different ticker/watchlist)
  useEffect(() => {
    setMessages([]);
    setError(null);
    setInput("");
  }, [
    context.kind,
    context.kind === "verdict" ? context.ticker : "",
    context.kind === "portfolio" ? context.watchlistId : "",
  ]);

  if (!configured) return null;
  if (!user) return null; // Hide for unauthenticated visitors

  const isPro = tier === "pro";
  if (!isPro) return null; // Hide button entirely for free users — discovery happens via /pricing

  const placeholder =
    context.kind === "verdict"
      ? `Ask about ${context.ticker}'s analysis...`
      : `Ask about ${context.watchlistName ?? "your portfolio"}...`;

  const suggestedPrompts =
    context.kind === "verdict"
      ? [
          `Why does ${context.ticker} score what it does?`,
          "What are the biggest risks here?",
          "Explain the Piotroski score in plain terms",
        ]
      : [
          "What's my biggest concentration risk?",
          "Which holdings have the weakest engine score?",
          "How would trimming my lowest-scored position affect the total?",
        ];

  const send = async (textOverride?: string) => {
    if (!user) return;
    const text = (textOverride ?? input).trim();
    if (!text || sending) return;
    if (!isPro) {
      setError("Chat is a Pro tier feature.");
      return;
    }

    const userMsg: ChatMessage = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setSending(true);
    setError(null);

    try {
      const token = await user.getIdToken();
      const apiContext =
        context.kind === "verdict"
          ? { kind: "verdict" as const, ticker: context.ticker }
          : { kind: "portfolio" as const, watchlistId: context.watchlistId };

      const resp = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ messages: next, context: apiContext }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error ?? `HTTP ${resp.status}`);
      }
      setMessages((m) => [
        ...m,
        { role: "assistant", content: data.reply ?? "(empty response)" },
      ]);
    } catch (e) {
      setError(String(e instanceof Error ? e.message : e));
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={
          "fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full shadow-lg flex items-center justify-center transition-transform " +
          (open
            ? "bg-surface-container-highest text-on-surface scale-95"
            : "bg-primary text-on-primary hover:scale-105")
        }
        title={open ? "Close chat" : "Ask the engine assistant"}
      >
        <span className="material-symbols-outlined">
          {open ? "close" : "smart_toy"}
        </span>
      </button>

      {/* Modal */}
      {open && (
        <div className="fixed bottom-24 right-6 z-40 w-[400px] max-w-[calc(100vw-3rem)] h-[560px] max-h-[calc(100vh-8rem)] bg-surface-container border border-outline-variant rounded-xl shadow-2xl flex flex-col overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 bg-surface-container-high border-b border-outline-variant flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-[20px]">
                smart_toy
              </span>
              <div>
                <p className="font-h2 text-sm text-on-surface">Engine assistant</p>
                <p className="text-[10px] text-on-surface-variant">
                  Explains your data · won't predict prices or give buy/sell advice
                </p>
              </div>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="material-symbols-outlined text-on-surface-variant hover:text-on-surface text-[20px]"
              aria-label="Close"
            >
              close
            </button>
          </div>

          {/* Message list */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="space-y-3">
                    <p className="text-sm text-on-surface-variant">
                      Ask anything about{" "}
                      <span className="text-on-surface font-medium">
                        {context.kind === "verdict"
                          ? context.companyName ?? context.ticker
                          : context.watchlistName ?? "your portfolio"}
                      </span>
                      . The assistant has access to all the engine's scores and
                      your portfolio data — but won't predict prices or give
                      buy/sell advice.
                    </p>
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-on-surface-variant uppercase tracking-wider">
                        Try asking
                      </p>
                      {suggestedPrompts.map((p) => (
                        <button
                          key={p}
                          onClick={() => send(p)}
                          className="block w-full text-left text-xs px-3 py-2 bg-surface-container-low border border-outline-variant rounded-lg hover:border-primary/50 hover:bg-surface-container-high transition-colors"
                        >
                          {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) => (
                  <Bubble key={i} message={m} />
                ))}

                {sending && (
                  <div className="flex items-center gap-2 text-on-surface-variant text-sm py-1">
                    <span className="material-symbols-outlined text-[16px] animate-spin">
                      progress_activity
                    </span>
                    Thinking…
                  </div>
                )}

                {error && (
                  <div className="bg-tertiary/10 border border-tertiary/30 text-tertiary text-xs px-3 py-2 rounded">
                    {error}
                  </div>
                )}
              </div>

              {/* Input */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
                className="border-t border-outline-variant p-3 flex items-center gap-2"
              >
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={placeholder}
                  disabled={sending}
                  className="flex-1 bg-surface-container-low border border-outline-variant rounded-lg px-3 py-2 text-sm text-on-surface placeholder:text-outline focus:outline-none focus:border-primary disabled:opacity-50"
                />
                <button
                  type="submit"
                  disabled={sending || !input.trim()}
                  className="bg-primary text-on-primary rounded-lg w-10 h-10 flex items-center justify-center disabled:opacity-40 hover:brightness-110 transition-all"
                  aria-label="Send"
                >
                  <span className="material-symbols-outlined text-[18px]">send</span>
                </button>
              </form>

          <div className="px-3 py-1.5 bg-surface-container-lowest text-[9px] text-on-surface-variant text-center border-t border-outline-variant">
            AI can make mistakes — verify critical numbers against the source
            filings. Not investment advice.
          </div>
        </div>
      )}
    </>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return (
    <div className={"flex " + (isUser ? "justify-end" : "justify-start")}>
      <div
        className={
          "max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap leading-relaxed " +
          (isUser
            ? "bg-primary-container/30 text-on-surface border border-primary/40"
            : "bg-surface-container-low text-on-surface border border-outline-variant")
        }
      >
        {message.content}
      </div>
    </div>
  );
}
