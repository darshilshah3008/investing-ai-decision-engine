import os
import time
import requests
import pandas as pd
import yfinance as yf

# ==========================
#   CONFIG
# ==========================
SEC_HEADERS = {
    "User-Agent": "darshil.shah@cnhind.com",  # SEC requires a real email
    "Accept-Encoding": "gzip, deflate",
}
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output")
WATCHLIST = [
    "GOOGL", "TSM", "MSFT", "NVDA", "BABA", "JNJ", "SONY", "WMT", "AMZN",
    "JD", "SERV", "AMD", "EH", "NICE", "QBTS", "GE"
]
MAX_TICKERS = None  # None = all SEC tickers

os.makedirs(OUTPUT_DIR, exist_ok=True)

# ==========================
#   LOGGING HELPER
# ==========================
def log(section, message):
    print(f"[{section}] {message}")

# ==========================
#   1. DOWNLOAD TICKERS
# ==========================
def download_all_tickers():
    log("SEC", "Downloading SEC master ticker list from company_tickers.json...")
    url = "https://www.sec.gov/files/company_tickers.json"
    resp = requests.get(url, headers=SEC_HEADERS, timeout=30)
    resp.raise_for_status()

    data = resp.json()
    rows = []
    for _, v in data.items():
        try:
            rows.append({
                "cik": str(v["cik_str"]).zfill(10),
                "ticker": v["ticker"].upper(),
                "name": v["title"]
            })
        except KeyError:
            continue

    df = pd.DataFrame(rows)
    if MAX_TICKERS is not None:
        log("SEC", f"Limiting to first {MAX_TICKERS} tickers for testing.")
        df = df.head(MAX_TICKERS)

    out_path = os.path.join(OUTPUT_DIR, "sec_all_tickers.csv")
    df.to_csv(out_path, index=False)
    log("SEC", f"Saved SEC ticker list → {len(df)} tickers to {out_path}")
    return df

# ==========================
#   2. DOWNLOAD QUARTERLY REVENUE
# ==========================
def fetch_quarterly_revenue(cik):
    """
    Returns last 4 quarterly revenue values (latest first) for given CIK.
    """
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"
    try:
        resp = requests.get(url, headers=SEC_HEADERS, timeout=30)
        if resp.status_code != 200:
            return None

        data = resp.json()
        facts = data.get("facts", {}).get("us-gaap", {})

        rev_obj = (
            facts.get("Revenues")
            or facts.get("RevenueFromContractWithCustomerExcludingAssessedTax")
            or facts.get("SalesRevenueNet")
        )
        if not rev_obj:
            return None

        units = rev_obj.get("units", {}).get("USD", [])
        if not units:
            return None

        df = pd.DataFrame(units)
        # Require these columns
        if not {"end", "form", "val"}.issubset(df.columns):
            return None

        # Sort latest first, focus on 10-Q / 10-K
        df = df.sort_values("end", ascending=False)
        df = df[df["form"].isin(["10-Q", "10-K"])]
        df = df.head(4)
        if df.empty:
            return None

        return df["val"].tolist()

    except Exception:
        return None

# ==========================
#   3. REVENUE SCREENER
# ==========================
def screen_revenue_growth(df_tickers):
    """
    Keep companies with:
      - Q1 > Q2 > Q3 > Q4 (last 4 quarters, latest first)
      - Q1 > Q4 (approx YoY up)
    """
    log("SCREEN", "Starting revenue growth screening (Q/Q + YoY)...")

    results = []
    total = len(df_tickers)
    if total == 0:
        log("SCREEN", "No tickers to screen.")
        return pd.DataFrame()

    for idx, row in df_tickers.iterrows():
        if idx % 250 == 0:
            log("SCREEN", f"Progress: {idx}/{total} tickers...")

        cik = row["cik"]
        ticker = row["ticker"]
        name = row["name"]

        rev = fetch_quarterly_revenue(cik)
        time.sleep(0.20)  # be gentle to SEC

        if not rev or len(rev) < 4:
            continue

        try:
            Q1, Q2, Q3, Q4 = map(float, rev[:4])  # latest first
        except (TypeError, ValueError):
            continue

        if (Q1 > Q2 > Q3 > Q4) and (Q1 > Q4):
            log("SCREEN", f"PASS: {ticker} → Q1={Q1:.2f}, Q4={Q4:.2f}")
            results.append({
                "ticker": ticker,
                "cik": cik,
                "name": name,
                "Q1": Q1, "Q2": Q2, "Q3": Q3, "Q4": Q4
            })

    df_res = pd.DataFrame(results)
    out_path = os.path.join(OUTPUT_DIR, "sec_revenue_screened.csv")
    df_res.to_csv(out_path, index=False)
    log("SCREEN", f"Revenue screening complete → {len(df_res)} companies passed ({out_path})")
    return df_res

# ==========================
#   4. MARKET DATA (YFINANCE)
# ==========================
def _get_yf_info_safe(ticker):
    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        price = info.get("currentPrice") or info.get("regularMarketPrice")
        return price, info.get("marketCap"), info.get("trailingPE")
    except Exception:
        return None, None, None

def add_market_data(df_screened):
    if df_screened.empty:
        log("YF", "No screened companies → skipping market data.")
        return df_screened

    log("YF", f"Adding market data for {len(df_screened)} screened tickers...")
    rows = []
    for idx, (_, row) in enumerate(df_screened.iterrows()):
        if idx % 50 == 0:
            log("YF", f"Progress: {idx}/{len(df_screened)} tickers")

        price, cap, pe = _get_yf_info_safe(row["ticker"])
        r = row.copy()
        r["price"] = price
        r["market_cap"] = cap
        r["trailing_PE"] = pe
        rows.append(r)

        time.sleep(0.10)  # be nice to Yahoo

    df = pd.DataFrame(rows)
    out_path = os.path.join(OUTPUT_DIR, "sec_revenue_screened_with_pe.csv")
    df.to_csv(out_path, index=False)
    log("YF", f"Market data added and saved to {out_path}")
    return df

# ==========================
#   5. MERGE ANALYST RESEARCH (OPTIONAL)
# ==========================
def merge_external_research(df):
    """
    If external_research.csv exists, merge on 'ticker'.
    Expected columns example:
      ticker,zacks_rating_num,bloomberg_rating_num,consensus_rating_num,consensus_pt,...
    """
    log("ANALYST", "Looking for external_research.csv to merge...")
    path = os.path.join(OUTPUT_DIR, "external_research.csv")

    if os.path.exists(path):
        df_ext = pd.read_csv(path)
        df_ext["ticker"] = df_ext["ticker"].str.upper()
        df_final = df.merge(df_ext, on="ticker", how="left")
        log("ANALYST", f"external_research.csv found → merged for {len(df_ext)} tickers.")
    else:
        df_final = df
        log("ANALYST", "No external_research.csv found → skipping analyst merge.")

    out_path = os.path.join(OUTPUT_DIR, "final_screened_with_research.csv")
    df_final.to_csv(out_path, index=False)
    log("ANALYST", f"Saved final_screened_with_research.csv → {out_path}")
    return df_final

# ==========================
#   6. WATCHLIST SNAPSHOT
# ==========================
def fetch_watchlist_snapshot(tickers):
    log("WATCHLIST", f"Fetching snapshot for {len(tickers)} watchlist tickers (Yahoo Finance)...")

    rows = []
    for idx, t in enumerate(tickers):
        log("WATCHLIST", f"Fetching {idx+1}/{len(tickers)} → {t}")
        try:
            info = yf.Ticker(t).info or {}
        except Exception:
            info = {}

        rows.append({
            "ticker": t.upper(),
            "name": info.get("longName"),
            "sector": info.get("sector"),
            "industry": info.get("industry"),
            "price": info.get("currentPrice") or info.get("regularMarketPrice"),
            "market_cap": info.get("marketCap"),
            "trailing_PE": info.get("trailingPE"),
            "forward_PE": info.get("forwardPE"),
            "peg_ratio": info.get("pegRatio"),
            "beta": info.get("beta")
        })
        time.sleep(0.10)

    df = pd.DataFrame(rows)
    out_path = os.path.join(OUTPUT_DIR, "watchlist_snapshot.csv")
    df.to_csv(out_path, index=False)
    log("WATCHLIST", f"Watchlist snapshot saved to {out_path}")
    return df

# ==========================
#   7. ANALYST BIAS (OPTIONAL)
# ==========================
def compute_analyst_bias(row):
    """
    Combine numeric analyst ratings into a bias:
      +1 ≈ bullish, 0 ≈ neutral, -1 ≈ bearish.
    Uses columns if present: zacks_rating_num, bloomberg_rating_num, consensus_rating_num
    """
    scores = []
    for col in ["zacks_rating_num", "bloomberg_rating_num", "consensus_rating_num"]:
        if col in row and pd.notna(row[col]):
            try:
                val = float(row[col])  # 1=Strong Buy, 3=Hold, 5=Strong Sell
                score = (3.0 - val) / 2.0  # 1→+1, 3→0, 5→-1
                scores.append(score)
            except Exception:
                continue

    if not scores:
        return 0.0
    return float(sum(scores) / len(scores))

# ==========================
#   8. BUY / HOLD / SELL CLASSIFIER
# ==========================
def classify_watchlist_signals(watchlist_df, final_screened_df):
    log("CLASSIFIER", "Combining revenue, valuation, and analyst data to classify watchlist...")

    wl = watchlist_df.copy()
    wl["ticker"] = wl["ticker"].str.upper()

    screened = final_screened_df.copy()
    screened["ticker"] = screened["ticker"].str.upper()

    # Revenue flag for tickers that passed your SEC screen
    rev_green = set(screened["ticker"].unique())
    wl["rev_flag"] = wl["ticker"].apply(lambda t: "green" if t in rev_green else "neutral")

    # Bring analyst columns (if any) from screened df
    analyst_cols = [c for c in screened.columns if c.startswith(("zacks_", "bloomberg_", "jpm_", "ms_", "consensus_"))]
    if analyst_cols:
        wl = wl.merge(
            screened[["ticker"] + analyst_cols].drop_duplicates("ticker"),
            on="ticker",
            how="left"
        )

    def classify_row(row):
        tpe = row.get("trailing_PE")
        fpe = row.get("forward_PE")
        rev = row.get("rev_flag", "neutral")
        sector = row.get("sector", "")
        analyst_bias = compute_analyst_bias(row) if analyst_cols else 0.0

        # Normalize
        tpe_v = None if pd.isna(tpe) else float(tpe)
        fpe_v = None if pd.isna(fpe) else float(fpe)

        # Pure speculative: no earnings, no analyst, no revenue pass
        if tpe_v is None and fpe_v is None and rev != "green" and abs(analyst_bias) < 0.1:
            log("CLASSIFIER", f"{row['ticker']} → SELL (speculative, no earnings/analysts/revenue flag)")
            return "SELL"

        rev_positive = (rev == "green")

        # Valuation buckets
        val = "unknown"
        if tpe_v is not None:
            if tpe_v < 12:
                val = "cheap"
            elif tpe_v < 25:
                val = "reasonable"
            elif tpe_v < 40:
                val = "expensive"
            else:
                val = "very_expensive"

        growth_val_positive = False
        if tpe_v is not None and fpe_v is not None:
            if fpe_v <= tpe_v and tpe_v <= 35:
                growth_val_positive = True
            if tpe_v < 20 and fpe_v < 18:
                growth_val_positive = True

        bullish_analyst = analyst_bias > 0.25
        bearish_analyst = analyst_bias < -0.25

        # Core decision logic
        # 1) Strong revenue + OK valuation → BUY
        if rev_positive:
            if (val in ["cheap", "reasonable"]) or growth_val_positive or bullish_analyst:
                log("CLASSIFIER", f"{row['ticker']} → BUY (rev strong + decent valuation/analysts)")
                return "BUY"
            log("CLASSIFIER", f"{row['ticker']} → HOLD (rev strong but valuation rich)")
            return "HOLD"

        # 2) No revenue flag, but cheap / reasonable with growth or bullish analysts → BUY
        if val == "cheap":
            if growth_val_positive or bullish_analyst:
                log("CLASSIFIER", f"{row['ticker']} → BUY (cheap + growth/analysts)")
                return "BUY"
            log("CLASSIFIER", f"{row['ticker']} → HOLD (cheap but no strong growth/analysts)")
            return "HOLD"

        if val == "reasonable":
            if growth_val_positive or bullish_analyst:
                log("CLASSIFIER", f"{row['ticker']} → BUY (reasonable + growth/analysts)")
                return "BUY"
            log("CLASSIFIER", f"{row['ticker']} → HOLD (reasonable valuation)")
            return "HOLD"

        # 3) Expensive / very expensive
        if val == "expensive":
            if growth_val_positive or bullish_analyst:
                log("CLASSIFIER", f"{row['ticker']} → HOLD (expensive but supported)")
                return "HOLD"
            log("CLASSIFIER", f"{row['ticker']} → HOLD (expensive, neutral)")
            return "HOLD"

        if val == "very_expensive":
            if sector in ["Technology", "Communication Services"] and (growth_val_positive or bullish_analyst):
                log("CLASSIFIER", f"{row['ticker']} → HOLD (high quality tech/comm, very expensive)")
                return "HOLD"
            if bearish_analyst:
                log("CLASSIFIER", f"{row['ticker']} → SELL (very expensive + bearish analysts)")
                return "SELL"
            log("CLASSIFIER", f"{row['ticker']} → HOLD (very expensive, no strong signals)")
            return "HOLD"

        # 4) Fallback: if analysts clearly bearish and nothing else strong → SELL
        if bearish_analyst and not rev_positive:
            log("CLASSIFIER", f"{row['ticker']} → SELL (bearish analysts, no revenue flag)")
            return "SELL"

        log("CLASSIFIER", f"{row['ticker']} → HOLD (fallback case)")
        return "HOLD"

    wl["final_recommendation"] = wl.apply(classify_row, axis=1)

    out_cols = [c for c in wl.columns
                if c in ["ticker", "name", "sector", "industry", "price",
                         "trailing_PE", "forward_PE", "rev_flag", "beta",
                         "final_recommendation"]
                or c.startswith(("zacks_", "bloomberg_", "jpm_", "ms_", "consensus_"))]

    out_df = wl[out_cols]
    out_path = os.path.join(OUTPUT_DIR, "watchlist_signals.csv")
    out_df.to_csv(out_path, index=False)
    log("CLASSIFIER", f"Saved Buy/Hold/Sell signals to {out_path}")
    return out_df

# ==========================
#   MAIN ENGINE
# ==========================
if __name__ == "__main__":
    print("\n=========== SEC + MARKET DATA ENGINE STARTED ===========\n")

    df_tickers = download_all_tickers()
    df_screened = screen_revenue_growth(df_tickers)
    df_market = add_market_data(df_screened)
    df_final = merge_external_research(df_market)
    df_watch = fetch_watchlist_snapshot(WATCHLIST)
    classify_watchlist_signals(df_watch, df_final)

    print("\n=========== ENGINE COMPLETED SUCCESSFULLY ===========\n")
