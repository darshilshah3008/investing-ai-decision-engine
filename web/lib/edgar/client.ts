// ─────────────────────────────────────────────────────────────────────
// SEC EDGAR HTTP client.
//
// All requests must:
// (1) include a real User-Agent with a contact email — SEC blocks
//     anonymous requests
// (2) stay under 10 req/s — we throttle to ~8 to leave headroom
// (3) be retried with backoff on 429 / 5xx
//
// This module is server-side only (called from Next.js API routes).
// EDGAR does not allow CORS from browsers — never import this from a
// client component.
// ─────────────────────────────────────────────────────────────────────

const REQUIRED_USER_AGENT_HINT = "<you@example.com>";

function getUserAgent(): string {
  const ua = process.env.SEC_USER_AGENT;
  if (!ua || ua.includes(REQUIRED_USER_AGENT_HINT)) {
    throw new Error(
      "SEC_USER_AGENT env var is unset or still has the placeholder. " +
        "Set it to something like 'Your Name <you@example.com>' before " +
        "calling EDGAR. SEC blocks requests without a valid contact email.",
    );
  }
  return ua;
}

// Token bucket: 8 tokens / second, refilled continuously.
class TokenBucket {
  private tokens: number;
  private lastRefill: number;
  constructor(
    private capacity: number,
    private refillPerMs: number,
  ) {
    this.tokens = capacity;
    this.lastRefill = Date.now();
  }
  async take(): Promise<void> {
    while (true) {
      const now = Date.now();
      const elapsed = now - this.lastRefill;
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillPerMs);
      this.lastRefill = now;
      if (this.tokens >= 1) {
        this.tokens -= 1;
        return;
      }
      const waitMs = (1 - this.tokens) / this.refillPerMs;
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }
}

const bucket = new TokenBucket(8, 8 / 1000); // 8 capacity, 8 / sec refill

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

export interface EdgarFetchOptions {
  retries?: number;
  cacheKey?: string;
}

const memoryCache = new Map<string, { ts: number; data: unknown }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24h for filings; they rarely change

export async function edgarFetchJson<T>(
  url: string,
  opts: EdgarFetchOptions = {},
): Promise<T> {
  const key = opts.cacheKey ?? url;
  const cached = memoryCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.data as T;
  }

  const retries = opts.retries ?? 4;
  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    await bucket.take();
    try {
      const resp = await fetch(url, {
        headers: {
          "User-Agent": getUserAgent(),
          Accept: "application/json",
          "Accept-Encoding": "gzip, deflate",
        },
      });
      if (resp.ok) {
        const data = (await resp.json()) as T;
        memoryCache.set(key, { ts: Date.now(), data });
        return data;
      }
      if (resp.status === 429 || (resp.status >= 500 && resp.status < 600)) {
        await sleep(500 * Math.pow(2, attempt));
        continue;
      }
      throw new Error(`EDGAR ${url} → HTTP ${resp.status}`);
    } catch (err) {
      lastErr = err;
      await sleep(500 * Math.pow(2, attempt));
    }
  }
  throw new Error(
    `EDGAR fetch failed after ${retries + 1} attempts for ${url}: ${String(lastErr)}`,
  );
}

export function cikPad(cik: string | number): string {
  return String(cik).padStart(10, "0");
}
