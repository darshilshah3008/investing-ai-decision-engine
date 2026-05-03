// Anthropic Claude API client.
//
// Server-side only. Reads ANTHROPIC_API_KEY from env. Used by the chat
// assistant route to ask Claude questions about the user's portfolio.

import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

export function getAnthropic(): Anthropic | null {
  if (cached) return cached;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  cached = new Anthropic({ apiKey: key });
  return cached;
}

/** Default model — Claude Haiku 4.5: fast, cheap, plenty smart for explanations. */
export const CHAT_MODEL = "claude-haiku-4-5-20251001";

/** Max output tokens per chat reply — keeps responses tight + bounds cost. */
export const CHAT_MAX_TOKENS = 800;
