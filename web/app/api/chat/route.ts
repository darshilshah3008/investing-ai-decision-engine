// POST /api/chat
//
// Pro-tier chat assistant. Takes a message + page context, looks up the
// user's actual portfolio / verdict data from Firestore (so the LLM
// can never hallucinate user-specific numbers), and sends it to Claude
// Haiku with strict guardrails.
//
// Body shape:
//   {
//     messages: [{ role: "user" | "assistant", content: string }, ...],
//     context: { kind: "verdict", ticker: "AAPL" }
//             | { kind: "portfolio", watchlistId: "wl_..." }
//   }

import { computeVerdict } from "@/lib/analysis/classifier";
import type { VerdictDoc } from "@/lib/analysis/types";
import { CHAT_MAX_TOKENS, CHAT_MODEL, getAnthropic } from "@/lib/anthropic/client";
import {
  type ChatContext,
  buildSystemPrompt,
} from "@/lib/anthropic/system-prompt";
import { verifyAuth } from "@/lib/firebase/admin";
import { getCachedVerdict, getWatchlist } from "@/lib/firebase/verdicts";
import { getUserTier } from "@/lib/firebase/users";
import { fetchSnapshot } from "@/lib/market/yahoo";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface RequestBody {
  messages: ChatMessage[];
  context:
    | { kind: "verdict"; ticker: string }
    | { kind: "portfolio"; watchlistId: string };
}

const MAX_HISTORY = 12; // last N messages — bounds token cost

async function loadVerdict(ticker: string): Promise<VerdictDoc | null> {
  const cached = await getCachedVerdict(ticker);
  if (cached) return cached;
  try {
    const snap = await fetchSnapshot(ticker);
    return await computeVerdict({
      ticker,
      currentPrice: snap.price,
      marketCap: snap.marketCap,
      dividendYield: snap.dividendYield,
      forwardPE: snap.forwardPE,
      trailingPE: snap.trailingPE,
      beta: snap.beta,
      sector: snap.sector,
      industry: snap.industry,
      fiftyTwoWeekHigh: snap.fiftyTwoWeekHigh,
      fiftyTwoWeekLow: snap.fiftyTwoWeekLow,
      fiftyDayAverage: snap.fiftyDayAverage,
      twoHundredDayAverage: snap.twoHundredDayAverage,
      regularMarketChangePct: snap.regularMarketChangePct,
      businessSummary: snap.businessSummary,
    });
  } catch (err) {
    console.error(`[chat] verdict load failed for ${ticker}:`, err);
    return null;
  }
}

export async function POST(req: NextRequest) {
  // Auth: must be signed in
  const uid = await verifyAuth(req.headers.get("Authorization"));
  if (!uid) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Tier check: chat is a Pro feature
  const tier = await getUserTier(uid);
  if (tier !== "pro") {
    return NextResponse.json(
      {
        error: "Chat assistant is a Pro tier feature",
        upgradeUrl: "/pricing",
      },
      { status: 403 },
    );
  }

  // Validate body
  let body: RequestBody;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return NextResponse.json({ error: "Messages array required" }, { status: 400 });
  }

  // Anthropic SDK must be configured
  const anthropic = getAnthropic();
  if (!anthropic) {
    return NextResponse.json(
      {
        error:
          "Chat is not configured on this server. Admin needs to set ANTHROPIC_API_KEY.",
      },
      { status: 503 },
    );
  }

  // Build the page context — fetch the actual data server-side so the
  // model never sees user-controlled fundamentals.
  let chatContext: ChatContext;
  try {
    if (body.context.kind === "verdict") {
      const ticker = body.context.ticker.toUpperCase();
      if (!/^[A-Z.\-]{1,8}$/.test(ticker)) {
        return NextResponse.json({ error: "Invalid ticker" }, { status: 400 });
      }
      const verdict = await loadVerdict(ticker);
      if (!verdict) {
        return NextResponse.json(
          { error: `Could not load verdict for ${ticker}` },
          { status: 500 },
        );
      }
      chatContext = { kind: "verdict", stock: verdict };
    } else if (body.context.kind === "portfolio") {
      const wl = await getWatchlist(uid, body.context.watchlistId);
      if (!wl) {
        return NextResponse.json({ error: "Watchlist not found" }, { status: 404 });
      }
      // Load each position's verdict in parallel
      const positions = await Promise.all(
        wl.tickers.map(async (t) => {
          const v = await loadVerdict(t);
          return {
            ticker: t,
            weight: wl.weights?.[t] ?? 0,
            costBasis: wl.costBasis?.[t] ?? null,
            verdict: v,
          };
        }),
      );
      chatContext = {
        kind: "portfolio",
        portfolio: {
          name: wl.name,
          portfolioTotal: wl.portfolioTotal ?? null,
          positions,
        },
      };
    } else {
      return NextResponse.json({ error: "Invalid context kind" }, { status: 400 });
    }
  } catch (err) {
    console.error("[chat] context build failed:", err);
    return NextResponse.json(
      { error: "Failed to load context" },
      { status: 500 },
    );
  }

  // Trim message history to bound token cost
  const trimmed = body.messages.slice(-MAX_HISTORY);

  // Call Claude
  try {
    const systemPrompt = buildSystemPrompt(chatContext);
    const response = await anthropic.messages.create({
      model: CHAT_MODEL,
      max_tokens: CHAT_MAX_TOKENS,
      system: systemPrompt,
      messages: trimmed.map((m) => ({
        role: m.role,
        content: m.content,
      })),
    });

    // Extract text content (Claude returns blocks; we use the text ones).
    // Avoid a strict type predicate — the SDK's TextBlock has a citations
    // field whose shape changes between versions; just narrow at use site.
    const text = response.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .filter(Boolean)
      .join("\n")
      .trim();

    return NextResponse.json({
      reply: text,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[chat] Anthropic error:", msg);
    return NextResponse.json(
      { error: `Chat request failed: ${msg}` },
      { status: 500 },
    );
  }
}
