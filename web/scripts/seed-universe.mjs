#!/usr/bin/env node
// Universe seeder.
//
// Runs the engine on a list of tickers and writes results to the
// `universe/{ticker}` Firestore collection. Resumable — skips tickers
// already seeded today.
//
// Usage:
//   node scripts/seed-universe.mjs              # default: S&P 500 subset
//   node scripts/seed-universe.mjs --all        # full ~12K SEC tickers
//   node scripts/seed-universe.mjs --limit=100  # cap to first N tickers
//   node scripts/seed-universe.mjs --batch=50   # how many to run before logging progress
//
// Required env: SEC_USER_AGENT, FIREBASE_SERVICE_ACCOUNT_JSON
// Reads from .env.local automatically when run from the web/ directory.

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// Load .env.local manually (no dotenv dep needed).
try {
  const envPath = resolve(process.cwd(), ".env.local");
  const raw = readFileSync(envPath, "utf-8");
  for (const line of raw.split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) {
      const [, k, v] = m;
      let val = v.trim();
      if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
      if (!process.env[k]) process.env[k] = val;
    }
  }
} catch {
  /* .env.local missing — env vars must be passed explicitly */
}

// CLI args
const argv = process.argv.slice(2);
const args = {
  all: argv.includes("--all"),
  limit: Number(argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 0) || null,
  batch: Number(argv.find((a) => a.startsWith("--batch="))?.split("=")[1] ?? 25),
  force: argv.includes("--force"),
};

// S&P 500 (snapshot — refresh periodically). Used as the default seed
// list because it's the highest-leverage subset of US equities.
const SP500 = [
  "AAPL","MSFT","NVDA","GOOGL","GOOG","AMZN","META","TSLA","BRK.B","UNH",
  "JPM","V","XOM","JNJ","PG","MA","AVGO","HD","CVX","MRK",
  "LLY","PEP","ABBV","KO","COST","ADBE","WMT","BAC","TMO","CRM",
  "MCD","CSCO","ACN","ABT","NFLX","DHR","WFC","LIN","DIS","TXN",
  "NEE","PM","RTX","CMCSA","NKE","UNP","INTC","ORCL","UPS","BMY",
  "QCOM","IBM","HON","COP","LOW","SBUX","INTU","CAT","MS","BA",
  "AMD","DE","T","SPGI","AMGN","BLK","SCHW","GE","MDT","ELV",
  "AXP","GS","BKNG","ISRG","TJX","PLD","ADP","C","SYK","NOW",
  "GILD","LMT","MMC","MDLZ","CB","ADI","TMUS","REGN","ZTS","VRTX",
  "CI","ETN","SO","BDX","CME","SLB","BSX","PYPL","DUK","EQIX",
  "AON","APD","ITW","NSC","HUM","ICE","CL","TGT","FCX","CSX",
  "EOG","FDX","PNC","WM","SHW","NOC","HCA","MO","USB","GD",
  "EMR","COF","FISV","PXD","ATVI","MMM","ROP","KLAC","ORLY","MAR",
  "GM","MNST","SRE","PSA","SNPS","CDNS","APH","NXPI","AJG","STZ",
  "TFC","MRVL","CTAS","CCI","MCO","MSI","TT","FTNT","ADM","KMB",
  "AZO","MCK","HLT","TRV","ECL","DXCM","HSY","WELL","KMI","LRCX",
  "NEM","KHC","TEL","WMB","PCAR","WBD","DLR","D","AEP","SYY",
  "DG","PSX","O","ADSK","DHI","AIG","MET","PAYX","CTSH","TDG",
  "VLO","BIIB","MNS","KR","CNC","WBA","MSCI","BK","STT","ALL",
  "AMP","SPG","LEN","HES","RSG","XEL","CMG","HAL","FAST","JCI",
  "CMI","NUE","WEC","ED","CNP","KEYS","BAX","ROST","YUM","ANET",
  "AME","HPQ","NDAQ","ICE","IDXX","IQV","COR","MTD","FANG","DD",
  "PEG","TRGP","DVN","WTW","BKR","AWK","RMD","FE","ETR","DLTR",
  "VRSK","HIG","EFX","EQR","PCG","PWR","PPL","CTRA","WAT","RJF",
  "EXC","CHTR","DAL","ZBH","TSN","CDW","ON","CTVA","LH","PPG",
  "AVB","WST","ABC","ALGN","BRO","FITB","ROK","KEY","HBAN","STX",
  "CFG","STE","TROW","AEE","DOV","HOLX","TYL","STLD","AKAM","WY",
  "NTRS","ATO","ZS","MKC","CMS","COO","K","PFG","SBNY","FE",
  "CINF","BBY","WAB","MOH","PHM","RCL","WRB","SWKS","CBRE","ARE",
  "SIVB","ULTA","TER","ENPH","DRI","WTRG","DTE","HSIC","ANSS","WBA",
  "CAG","BR","DGX","MAA","FSLR","ALB","ESS","MOS","CF","GPC",
  "BG","TYL","ETSY","KMX","FFIV","STX","ZION","CTLT","MTB","JKHY",
  "PKG","NTAP","HWM","INVH","DPZ","CLX","CINF","INCY","UDR","TXT",
  "CFG","CTRA","CE","BBWI","ABMD","NRG","NEM","TPR","KIM","WAT",
  "OMC","HRL","PNW","RHI","SJM","DLTR","NLOK","SEE","NVR","RE",
  "CHRW","BIO","NWL","BWA","FOX","FOXA","HAS","NWS","NWSA","WHR",
  "EMN","ALK","XRAY","FRT","RL","HII","NDSN","JNPR","LKQ","CPB",
  "PARA","WYNN","IPG","UAA","UA","DXC","HOG","MGM","LUMN","GPS",
  "GME","M","KSS","IPGP","NCLH","CCL","AAL","WBA","AMC","DISH",
  "BBBY","NLOK","FLR","HPE","CAH","BIO","WHR","PVH","OMC","COTY",
  "TFX","KMX","AOS","BWA","BRO","LDOS","ARES","NVR","INVH","KEYS",
  "BLDR","CHRW","SBAC","PFG","MAS","WST","AMCR","CTLT","ZBRA","INVH",
];

const BATCH_SIZE = args.batch;
const TICKER_LIMIT = args.limit;
const RUN_FULL_UNIVERSE = args.all;

async function main() {
  if (!process.env.SEC_USER_AGENT) {
    console.error("Missing SEC_USER_AGENT");
    process.exit(1);
  }
  if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    console.error("Missing FIREBASE_SERVICE_ACCOUNT_JSON");
    process.exit(1);
  }

  const { initializeApp, cert, getApps } = await import("firebase-admin/app");
  const { getFirestore } = await import("firebase-admin/firestore");

  // Init Firebase admin
  if (!getApps().length) {
    const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    initializeApp({ credential: cert(sa), projectId: sa.project_id });
  }
  const db = getFirestore();

  // Determine ticker list
  let tickers;
  if (RUN_FULL_UNIVERSE) {
    console.log("Fetching full SEC ticker master...");
    const { fetchTickerMaster } = await loadEdgarTickers();
    const all = await fetchTickerMaster();
    tickers = all.map((t) => t.ticker);
    console.log(`Loaded ${tickers.length} tickers from SEC`);
  } else {
    tickers = Array.from(new Set(SP500));
    console.log(`Using S&P 500 list (${tickers.length} unique tickers)`);
  }

  if (TICKER_LIMIT) {
    tickers = tickers.slice(0, TICKER_LIMIT);
    console.log(`Limited to first ${TICKER_LIMIT}`);
  }

  // Skip tickers already seeded today (resumability)
  const today = new Date().toISOString().slice(0, 10);
  const skipSet = new Set();
  if (!args.force) {
    console.log("Checking which tickers were already seeded today...");
    const existing = await db.collection("universe").select("computedAt").get();
    for (const doc of existing.docs) {
      const ts = doc.data().computedAt;
      if (ts && new Date(ts).toISOString().slice(0, 10) === today) {
        skipSet.add(doc.id);
      }
    }
    console.log(`${skipSet.size} already seeded today, will skip those`);
  }

  const todo = tickers.filter((t) => !skipSet.has(t));
  console.log(`${todo.length} tickers to process`);

  const { computeVerdict } = await loadClassifier();
  const { fetchSnapshot } = await loadYahoo();

  let success = 0;
  let failed = 0;
  const start = Date.now();

  for (let i = 0; i < todo.length; i++) {
    const ticker = todo[i];
    try {
      const snap = await fetchSnapshot(ticker).catch(() => ({
        ticker,
        price: null,
        marketCap: null,
      }));
      const v = await computeVerdict({
        ticker,
        currentPrice: snap.price,
        marketCap: snap.marketCap,
      });
      await db
        .collection("universe")
        .doc(ticker.toUpperCase())
        .set({
          ticker: v.ticker,
          companyName: v.companyName,
          cik: v.cik,
          verdict: v.verdict,
          totalScore: v.totalScore,
          price: v.marketSnapshot.price,
          marketCap: v.marketSnapshot.marketCap,
          sector: null,
          computedAt: Date.now(),
        });
      success++;
    } catch (err) {
      failed++;
      console.error(
        `  [FAIL] ${ticker}: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if ((i + 1) % BATCH_SIZE === 0) {
      const elapsed = (Date.now() - start) / 1000;
      const rate = (i + 1) / elapsed;
      const remaining = todo.length - (i + 1);
      const etaMin = Math.round(remaining / rate / 60);
      console.log(
        `[${i + 1}/${todo.length}] ${success} ok, ${failed} failed · ${rate.toFixed(1)}/s · ETA ~${etaMin}m`,
      );
    }
  }

  const elapsedMin = ((Date.now() - start) / 1000 / 60).toFixed(1);
  console.log(
    `\nDone. ${success} ok, ${failed} failed in ${elapsedMin}m total.`,
  );
}

// Dynamic loaders for the engine modules (TS files) — uses tsx if
// installed, else falls back to a runtime-only pure-JS path.
async function loadClassifier() {
  return await import(
    pathToFileURL(resolve(process.cwd(), "lib/analysis/classifier.ts")).href
  );
}
async function loadYahoo() {
  return await import(
    pathToFileURL(resolve(process.cwd(), "lib/market/yahoo.ts")).href
  );
}
async function loadEdgarTickers() {
  return await import(
    pathToFileURL(resolve(process.cwd(), "lib/edgar/tickers.ts")).href
  );
}

main().catch((err) => {
  console.error("FATAL:", err);
  process.exit(1);
});
