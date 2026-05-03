// Google News RSS — free, public, designed-for-syndication endpoint.
//
// Feed URL format:
//   https://news.google.com/rss/search?q={query}+stock&hl=en-US&gl=US&ceid=US:en
//
// We pull title + link + pubDate. We deliberately DON'T reproduce article
// bodies (copyright). Headlines link out to the original publisher.
//
// Per REQUIREMENTS.md §5B, this is "external context" — displayed
// alongside the verdict but never used in the math.

export interface NewsItem {
  title: string;
  url: string;
  source: string | null;
  publishedAt: string; // ISO timestamp
}

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 min — headlines don't change that fast
const cache = new Map<string, { ts: number; items: NewsItem[] }>();

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36";

/**
 * Quick-and-dirty XML parsing — Google News RSS has a stable, simple
 * shape so we extract by regex instead of pulling in xmldom.
 */
function parseRss(xml: string): NewsItem[] {
  const out: NewsItem[] = [];
  // Each <item> block.
  const itemRe = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;
  while ((match = itemRe.exec(xml))) {
    const block = match[1];
    const title = pickTag(block, "title");
    const link = pickTag(block, "link");
    const pubDate = pickTag(block, "pubDate");
    const source = pickTag(block, "source");
    if (!title || !link) continue;
    out.push({
      title: decodeHtml(title),
      url: link,
      source: source ? decodeHtml(source) : null,
      publishedAt: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
    });
  }
  return out;
}

function pickTag(block: string, tag: string): string | null {
  // Handles plain tags and CDATA wrapping
  const re = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`);
  const m = re.exec(block);
  return m ? m[1].trim() : null;
}

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&nbsp;": " ",
};

function decodeHtml(s: string): string {
  return s.replace(/&[a-z#0-9]+;/g, (m) => HTML_ENTITIES[m] ?? m);
}

/**
 * Fetch the latest news headlines for a ticker.
 * Returns at most `limit` items, newest first.
 */
export async function fetchNewsForTicker(
  ticker: string,
  companyName: string | null = null,
  limit = 8,
): Promise<NewsItem[]> {
  const cacheKey = `${ticker}|${companyName ?? ""}`;
  const hit = cache.get(cacheKey);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) {
    return hit.items.slice(0, limit);
  }

  // Query: "{TICKER} stock" plus optionally the company name in quotes.
  // Quoting helps disambiguate (e.g. "F" → Ford vs. random F-letter news).
  const queryParts = [ticker, "stock"];
  if (companyName) queryParts.push(`"${companyName}"`);
  const q = queryParts.join("+");
  const url =
    `https://news.google.com/rss/search?q=${encodeURIComponent(q)}` +
    `&hl=en-US&gl=US&ceid=US:en`;

  try {
    const resp = await fetch(url, {
      headers: {
        "User-Agent": UA,
        Accept: "application/rss+xml, application/xml, text/xml",
      },
      cache: "no-store",
    });
    if (!resp.ok) {
      console.warn(`[news] ${ticker}: HTTP ${resp.status}`);
      return [];
    }
    const xml = await resp.text();
    const items = parseRss(xml).slice(0, limit);
    cache.set(cacheKey, { ts: Date.now(), items });
    return items;
  } catch (err) {
    console.error(`[news] ${ticker} error:`, err);
    return [];
  }
}
