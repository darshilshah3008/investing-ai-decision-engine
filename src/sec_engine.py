import requests
import pandas as pd
import time
import yfinance as yf
import os

# ==========================
#   CONFIG
# ==========================
SEC_HEADERS = {
    # Use a real email here – SEC requires a valid User-Agent
    "User-Agent": "darshil.shah@cnhind.com",
    "Accept-Encoding": "gzip, deflate",
}

OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output")
WATCHLIST = [
    "GOOGL", "TSM", "MSFT", "NVDA", "BABA", "JNJ", "SONY", "WMT", "AMZN",
    "JD", "SERV", "AMD", "EH", "NICE", "QBTS", "GE"
]

# Limit how many tickers you screen for revenue.
# None = use all tickers from SEC (can be slow ~30+ min).
# Set e.g. MAX_TICKERS = 1000 if you want faster runs while testing.
MAX_TICKERS = None

os.makedirs(OUTPUT_DIR, exist_ok=True)


# ==========================
#   1. DOWNLOAD TICKERS
# ==========================
def download_all_tickers():
    """
    Downloads the SEC master ticker list from company_tickers.json.

    JSON format from SEC:
      {
        "0": {"cik_str": 320193, "ticker": "AAPL", "title": "APPLE INC"},
        "1": {...},
        ...
      }
    """
    print("Downloading SEC master ticker list...")

    url = "https://www.sec.gov/files/company_tickers.json"
    resp = requests.get(url, headers=SEC_HEADERS, timeout=20)
    resp.raise_for_status()

    data = resp.json()  # dict: key -> {cik_str, ticker, title}

    rows = []
    for _, v in data.items():
        try:
            rows.append({
                "cik": str(v["cik_str"]).zfill(10),
                "ticker": v["ticker"].upper(),
                "name": v["title"]
            })
        except KeyError:
            # Skip any malformed entries
            continue

    df = pd.DataFrame(rows)

    # Optionally limit number of tickers for faster test runs
    if MAX_TICKERS is not None:
        df = df.head(MAX_TICKERS)

    df.to_csv(f"{OUTPUT_DIR}/sec_all_tickers.csv", index=False)

    print(f"Saved SEC ticker list → {len(df)} tickers")
    return df


# ==========================
#   2. DOWNLOAD QUARTERLY REVENUE
# ==========================
def fetch_quarterly_revenue(cik):
    """
    Returns last 4 quarters of revenue values (latest first) for given CIK.
    Returns None if no usable revenue data.
    """
    url = f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik}.json"

    try:
        resp = requests.get(url, headers=SEC_HEADERS, timeout=20)
        if resp.status_code != 200:
            return None

        data = resp.json()
        facts = data.get("facts", {}).get("us-gaap", {})

        # Try a few different common revenue tags
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
        # Guard against missing columns
        if not {"end", "form", "val"}.issubset(df.columns):
            return None

        # Sort latest first
        df = df.sort_values("end", ascending=False)

        # Only 10-Q / 10-K
        df = df[df["form"].isin(["10-Q", "10-K"])]

        # Take last 4
        df = df.head(4)
        if df.empty:
            return None

        return df["val"].tolist()

    except Exception:
        # Any problem → treat as no data
        return None


# ==========================
#   3. REVENUE SCREENER
# ==========================
def screen_revenue_growth(df):
    """
    Filters companies that meet the rule:
    - Last 3 quarters UP: Q1 > Q2 > Q3 > Q4
    - Last quarter YoY UP (approx): Q1 > Q4
    Saves sec_revenue_screened.csv
    """
    print("Screening revenue growth patterns...")
    results = []

    total = len(df)
    if total == 0:
        print("No tickers to screen.")
        return pd.DataFrame()

    for idx, row in df.iterrows():
        # Debug/progress every 100 tickers
        if idx % 100 == 0:
            print(f"  [DEBUG] Processed {idx} / {total} tickers...")

        cik = row["cik"]
        ticker = row["ticker"]
        name = row["name"]

        rev = fetch_quarterly_revenue(cik)
        # Courtesy delay to avoid hammering SEC
        time.sleep(0.20)

        if not rev or len(rev) < 4:
            continue

        Q1, Q2, Q3, Q4 = rev[:4]  # latest first

        try:
            Q1, Q2, Q3, Q4 = float(Q1), float(Q2), float(Q3), float(Q4)
        except (TypeError, ValueError):
            continue

        if (Q1 > Q2 > Q3 > Q4) and (Q1 > Q4):
            results.append({
                "ticker": ticker,
                "cik": cik,
                "name": name,
                "Q1": Q1, "Q2": Q2, "Q3": Q3, "Q4": Q4
            })

    df_res = pd.DataFrame(results)
    df_res.to_csv(f"{OUTPUT_DIR}/sec_revenue_screened.csv", index=False)
    print(f"Found {len(df_res)} revenue-strong companies.")
    return df_res


# ==========================
#   4. ADD MARKET DATA (YFINANCE)
# ==========================
def _get_yf_info_safe(ticker):
    """
    Safely retrieve price, market cap, and trailing P/E from yfinance.
    """
    price = None
    market_cap = None
    trailing_pe = None

    try:
        t = yf.Ticker(ticker)
        info = t.info or {}
        price = info.get("currentPrice") or info.get("regularMarketPrice")
        market_cap = info.get("marketCap")
        trailing_pe = info.get("trailingPE")

        # Optional: fallback via fast_info if price missing
        if price is None:
            try:
                fi = t.fast_info
                price = fi.get("lastPrice") or fi.get("regularMarketPrice")
            except Exception:
                pass
    except Exception:
        # Leave as None if anything fails
        pass

    return price, market_cap, trailing_pe


def add_market_data(df):
    """
    Adds price, P/E, market cap via Yahoo Finance to the screened companies.
    Saves sec_revenue_screened_with_pe.csv
    """
    if df.empty:
        print("No screened companies to add market data for.")
        return df

    print("Adding market data (P/E, price, market cap)...")
    all_rows = []

    total = len(df)
    for idx, (_, row) in enumerate(df.iterrows()):
        ticker = row["ticker"]
        if idx % 50 == 0:
            print(f"  [DEBUG] YF progress: {idx} / {total} tickers...")

        price, market_cap, trailing_pe = _get_yf_info_safe(ticker)

        r = row.copy()
        r["price"] = price
        r["market_cap"] = market_cap
        r["trailing_PE"] = trailing_pe

        all_rows.append(r)

        # Small delay to be nice to Yahoo
        time.sleep(0.1)

    df2 = pd.DataFrame(all_rows)
    df2.to_csv(f"{OUTPUT_DIR}/sec_revenue_screened_with_pe.csv", index=False)
    return df2


# ==========================
#   5. MERGE ANALYST RESEARCH (OPTIONAL)
# ==========================
def merge_external_research(df):
    """
    If external_research.csv exists in OUTPUT_DIR, merge it on 'ticker'.
    Saves final_screened_with_research.csv
    """
    print("Merging external_research.csv (if present)...")
    ext_path = f"{OUTPUT_DIR}/external_research.csv"

    if os.path.exists(ext_path):
        df_ext = pd.read_csv(ext_path)
        df_final = df.merge(df_ext, on="ticker", how="left")
        print("  external_research.csv found and merged.")
    else:
        df_final = df
        print("  external_research.csv not found, skipping merge.")

    df_final.to_csv(f"{OUTPUT_DIR}/final_screened_with_research.csv", index=False)
    return df_final


# ==========================
#   6. WATCHLIST SNAPSHOT
# ==========================
def fetch_watchlist_snapshot(tickers):
    """
    Simple snapshot of a manual ticker watchlist using yfinance.
    Saves watchlist_snapshot.csv
    """
    print("Fetching watchlist snapshot...")

    rows = []

    for idx, t in enumerate(tickers):
        print(f"  [DEBUG] Watchlist {idx+1}/{len(tickers)}: {t}")
        try:
            yf_t = yf.Ticker(t)
            info = yf_t.info or {}
        except Exception:
            info = {}

        rows.append({
            "ticker": t,
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

        time.sleep(0.1)

    df = pd.DataFrame(rows)
    df.to_csv(f"{OUTPUT_DIR}/watchlist_snapshot.csv", index=False)
    return df


# ==========================
#   MAIN ENGINE
# ==========================
if __name__ == "__main__":
    print("=== SEC + MARKET DATA ENGINE STARTED ===")

    # 1) All SEC tickers (optionally limited by MAX_TICKERS)
    df_tickers = download_all_tickers()

    # 2) Filter by revenue-growth pattern
    df_screened = screen_revenue_growth(df_tickers)

    # 3) Add Yahoo Finance market data (if any screened)
    df_market = add_market_data(df_screened)

    # 4) Optionally merge your own research
    df_final = merge_external_research(df_market)

    # 5) Always fetch watchlist snapshot
    df_watch = fetch_watchlist_snapshot(WATCHLIST)

    print("=== ENGINE COMPLETED SUCCESSFULLY ===")
