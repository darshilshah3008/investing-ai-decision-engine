# dashboard.py
# Streamlit GUI for your SEC + Market Data engine
#
# Expected CSV files (created by sec_engine_full.py):
#   output/sec_revenue_screened.csv
#   output/sec_revenue_screened_with_pe.csv
#   output/final_screened_with_research.csv
#   output/watchlist_snapshot.csv
#   output/watchlist_signals.csv

import os
from pathlib import Path

import pandas as pd
import streamlit as st

# -----------------------------
# CONFIG
# -----------------------------
OUTPUT_DIR = Path("output")

st.set_page_config(
    page_title="SEC Revenue + Watchlist Dashboard",
    layout="wide",
    initial_sidebar_state="expanded",
)


# -----------------------------
# HELPERS
# -----------------------------
@st.cache_data
def load_csv(name: str) -> pd.DataFrame | None:
    path = OUTPUT_DIR / name
    if not path.exists():
        return None
    try:
        df = pd.read_csv(path)
        return df
    except Exception as e:
        st.error(f"Error reading {name}: {e}")
        return None


def calc_revenue_growth_cols(df: pd.DataFrame) -> pd.DataFrame:
    """
    Add simple QoQ and YoY-like growth flags based on Q1..Q4 columns.
    Assumes Q1 is latest quarter, Q4 is oldest.
    """
    required = {"Q1", "Q2", "Q3", "Q4"}
    if not required.issubset(df.columns):
        return df

    df = df.copy()
    for q in required:
        df[q] = pd.to_numeric(df[q], errors="coerce")

    df["QoQ_trend_strict_up"] = (df["Q1"] > df["Q2"]) & (df["Q2"] > df["Q3"]) & (df["Q3"] > df["Q4"])
    df["YoY_up_Q1_vs_Q4"] = df["Q1"] > df["Q4"]
    df["Rev_score_simple"] = (
        df["QoQ_trend_strict_up"].astype(int) * 2
        + df["YoY_up_Q1_vs_Q4"].astype(int)
    )
    return df


def color_recommendation(val: str):
    if isinstance(val, str):
        v = val.upper()
        if v == "BUY":
            color = "#0f9d58"   # green
        elif v == "SELL":
            color = "#db4437"   # red
        elif v == "HOLD":
            color = "#f4b400"   # yellow
        else:
            color = "#999999"
        return f"background-color: {color}; color: white; font-weight: 600;"
    return ""


# -----------------------------
# LOAD DATA
# -----------------------------
df_rev = load_csv("sec_revenue_screened.csv")  # Q1..Q4
df_rev_pe = load_csv("sec_revenue_screened_with_pe.csv")
df_final = load_csv("final_screened_with_research.csv")
df_watch = load_csv("watchlist_snapshot.csv")
df_signals = load_csv("watchlist_signals.csv")

# Merge a "master" df for screened tickers with valuations + research
df_screened = None
if df_rev_pe is not None:
    df_screened = df_rev_pe.copy()
elif df_rev is not None:
    df_screened = df_rev.copy()

if df_screened is not None:
    df_screened = calc_revenue_growth_cols(df_screened)

if df_final is not None and df_screened is not None:
    # Ensure ticker is uppercase in both
    df_final["ticker"] = df_final["ticker"].astype(str).str.upper()
    df_screened["ticker"] = df_screened["ticker"].astype(str).str.upper()
    # Keep df_screened as base, bring in any extra analyst / research cols
    extra_cols = [c for c in df_final.columns if c not in df_screened.columns]
    df_screened = df_screened.merge(
        df_final[["ticker"] + extra_cols],
        on="ticker",
        how="left",
    )

# -----------------------------
# SIDEBAR
# -----------------------------
st.sidebar.title("SEC Engine Dashboard")

st.sidebar.markdown("### Data Files Status")
files = {
    "sec_revenue_screened.csv": df_rev is not None,
    "sec_revenue_screened_with_pe.csv": df_rev_pe is not None,
    "final_screened_with_research.csv": df_final is not None,
    "watchlist_snapshot.csv": df_watch is not None,
    "watchlist_signals.csv": df_signals is not None,
}

for fname, ok in files.items():
    icon = "✅" if ok else "⚠️"
    st.sidebar.write(f"{icon} {fname}")

st.sidebar.markdown("---")

# Global filters (mostly for watchlist / screened lists)
sector_filter = None
if df_watch is not None and "sector" in df_watch.columns:
    sectors = sorted([s for s in df_watch["sector"].dropna().unique()])
    sector_filter = st.sidebar.multiselect("Filter by sector (watchlist)", sectors)

rec_filter = None
if df_signals is not None and "final_recommendation" in df_signals.columns:
    recs = sorted(df_signals["final_recommendation"].dropna().unique())
    rec_filter = st.sidebar.multiselect("Filter by recommendation", recs)

st.sidebar.markdown("---")
st.sidebar.caption("Tip: Re-run `sec_engine_full.py` to refresh these CSVs.")

# -----------------------------
# MAIN LAYOUT
# -----------------------------
st.title("📊 SEC + Watchlist Investment Dashboard")

st.markdown(
    """
This dashboard visualizes the output of your **SEC + Market Data Engine**:

- **Revenue screen** from SEC company filings  
- **Valuation metrics** from Yahoo Finance  
- **Watchlist snapshots** and **Buy/Hold/Sell signals**  
"""
)

tabs = st.tabs(
    [
        "🏁 Overview",
        "📈 Screened Revenue Growers",
        "🧾 Watchlist & Signals",
        "🔍 Ticker Detail",
    ]
)

# -----------------------------
# TAB 1 — OVERVIEW
# -----------------------------
with tabs[0]:
    st.subheader("High-Level Summary")

    col1, col2, col3, col4 = st.columns(4)

    total_screened = len(df_screened) if df_screened is not None else 0
    total_watch = len(df_watch) if df_watch is not None else 0
    total_signals = len(df_signals) if df_signals is not None else 0

    with col1:
        st.metric("Revenue Screened Companies", value=total_screened)

    with col2:
        st.metric("Watchlist Size", value=total_watch)

    with col3:
        st.metric("Signals Generated", value=total_signals)

    with col4:
        if df_screened is not None:
            pe_non_null = df_screened["trailing_PE"].dropna()
            avg_pe = round(pe_non_null.mean(), 1) if not pe_non_null.empty else "N/A"
        else:
            avg_pe = "N/A"
        st.metric("Avg. Trailing P/E (screened)", value=avg_pe)

    st.markdown("---")

    col_a, col_b = st.columns(2)

    # Recommendation distribution
    with col_a:
        st.markdown("#### Recommendation Distribution (Watchlist)")
        if df_signals is not None and "final_recommendation" in df_signals.columns:
            rec_counts = df_signals["final_recommendation"].value_counts().reset_index()
            rec_counts.columns = ["Recommendation", "Count"]
            st.bar_chart(data=rec_counts, x="Recommendation", y="Count", use_container_width=True)
        else:
            st.info("No `watchlist_signals.csv` loaded yet.")

    # Sector breakdown
    with col_b:
        st.markdown("#### Sector Breakdown (Watchlist)")
        if df_watch is not None and "sector" in df_watch.columns:
            sec_counts = df_watch["sector"].fillna("Unknown").value_counts().reset_index()
            sec_counts.columns = ["Sector", "Count"]
            st.bar_chart(data=sec_counts, x="Sector", y="Count", use_container_width=True)
        else:
            st.info("No sector data available in watchlist.")

# -----------------------------
# TAB 2 — SCREENED REVENUE GROWERS
# -----------------------------
with tabs[1]:
    st.subheader("Companies with Strong Revenue Trend (SEC Screen)")

    if df_screened is None:
        st.warning("No screened data found. Run your SEC engine first.")
    else:
        # Filters
        st.markdown("##### Filters")
        col1, col2, col3 = st.columns(3)

        with col1:
            min_pe, max_pe = st.slider(
                "Trailing P/E range",
                min_value=0.0,
                max_value=float(df_screened["trailing_PE"].dropna().max() or 50),
                value=(0.0, float(df_screened["trailing_PE"].dropna().max() or 50)),
                step=0.5,
            )

        with col2:
            only_strict_qoq = st.checkbox("Strict Q/Q up only (Q1>Q2>Q3>Q4)", value=False)

        with col3:
            only_yoy_up = st.checkbox("Q1 > Q4 (YoY up)", value=False)

        df_view = df_screened.copy()

        # Apply filters
        if "trailing_PE" in df_view.columns:
            df_view["trailing_PE"] = pd.to_numeric(df_view["trailing_PE"], errors="coerce")
            df_view = df_view[
                (df_view["trailing_PE"].isna())
                | ((df_view["trailing_PE"] >= min_pe) & (df_view["trailing_PE"] <= max_pe))
            ]

        if only_strict_qoq and "QoQ_trend_strict_up" in df_view.columns:
            df_view = df_view[df_view["QoQ_trend_strict_up"]]

        if only_yoy_up and "YoY_up_Q1_vs_Q4" in df_view.columns:
            df_view = df_view[df_view["YoY_up_Q1_vs_Q4"]]

        st.markdown("##### Screened Companies")
        basic_cols = ["ticker", "name", "Q1", "Q2", "Q3", "Q4", "trailing_PE", "market_cap"]
        existing = [c for c in basic_cols if c in df_view.columns]
        st.dataframe(df_view[existing].sort_values("Q1", ascending=False), use_container_width=True)

# -----------------------------
# TAB 3 — WATCHLIST & SIGNALS
# -----------------------------
with tabs[2]:
    st.subheader("Watchlist Snapshot & Signals")

    col1, col2 = st.columns(2)

    with col1:
        st.markdown("#### Watchlist Snapshot (Raw)")

        if df_watch is not None:
            df_w = df_watch.copy()

            # Apply sector filter
            if sector_filter:
                df_w = df_w[df_w["sector"].isin(sector_filter)]

            st.dataframe(df_w, use_container_width=True)
        else:
            st.info("No `watchlist_snapshot.csv` loaded yet.")

    with col2:
        st.markdown("#### Buy / Hold / Sell Signals")

        if df_signals is not None:
            df_s = df_signals.copy()

            # Apply filters
            if rec_filter:
                df_s = df_s[df_s["final_recommendation"].isin(rec_filter)]
            if sector_filter and "sector" in df_s.columns:
                df_s = df_s[df_s["sector"].isin(sector_filter)]

            # Arrange key cols
            key_cols = [
                "ticker",
                "name",
                "sector",
                "industry",
                "price",
                "trailing_PE",
                "forward_PE",
                "rev_flag",
                "beta",
                "final_recommendation",
            ]
            existing = [c for c in key_cols if c in df_s.columns]
            df_s_view = df_s[existing].sort_values("final_recommendation")

            st.dataframe(
                df_s_view.style.applymap(
                    color_recommendation, subset=["final_recommendation"]
                ),
                use_container_width=True,
            )
        else:
            st.info("No `watchlist_signals.csv` loaded yet.")

# -----------------------------
# TAB 4 — TICKER DETAIL
# -----------------------------
with tabs[3]:
    st.subheader("Single Ticker Drilldown")

    # Build a list of tickers from watchlist_signals (preferred), else from screened
    tickers_available = []
    ticker_source = "signals"

    if df_signals is not None and "ticker" in df_signals.columns:
        tickers_available = sorted(df_signals["ticker"].astype(str).str.upper().unique())
    elif df_screened is not None and "ticker" in df_screened.columns:
        tickers_available = sorted(df_screened["ticker"].astype(str).str.upper().unique())
        ticker_source = "screened"

    if not tickers_available:
        st.info("No tickers available. Run the engine first.")
    else:
        selected_ticker = st.selectbox("Choose a ticker", tickers_available)

        # Pull data from different sources
        sig_row = None
        scr_row = None
        watch_row = None

        if df_signals is not None:
            sig_row = df_signals[df_signals["ticker"].astype(str).str.upper() == selected_ticker]
        if df_screened is not None:
            scr_row = df_screened[df_screened["ticker"].astype(str).str.upper() == selected_ticker]
        if df_watch is not None:
            watch_row = df_watch[df_watch["ticker"].astype(str).str.upper() == selected_ticker]

        col_top1, col_top2, col_top3 = st.columns(3)

        # Basic snapshot
        with col_top1:
            st.markdown("##### Snapshot")
            name = None
            sector = None
            industry = None
            price = None
            pe = None

            for df_candidate in [sig_row, watch_row, scr_row]:
                if df_candidate is not None and not df_candidate.empty:
                    r = df_candidate.iloc[0]
                    name = name or r.get("name")
                    sector = sector or r.get("sector")
                    industry = industry or r.get("industry")
                    price = price or r.get("price")
                    pe = pe or r.get("trailing_PE")

            st.write(f"**Ticker:** {selected_ticker}")
            if name:
                st.write(f"**Name:** {name}")
            if sector:
                st.write(f"**Sector:** {sector}")
            if industry:
                st.write(f"**Industry:** {industry}")
            if price:
                st.write(f"**Price:** {price}")
            if pe:
                st.write(f"**Trailing P/E:** {pe}")

        # Recommendation
        with col_top2:
            st.markdown("##### Recommendation & Flags")

            rec = None
            rev_flag = None
            beta = None

            if sig_row is not None and not sig_row.empty:
                r = sig_row.iloc[0]
                rec = r.get("final_recommendation")
                rev_flag = r.get("rev_flag")
                beta = r.get("beta")

            if rec:
                st.write(f"**Final Recommendation:** {rec}")
            if rev_flag:
                st.write(f"**Revenue Flag:** {rev_flag}")
            if beta is not None:
                st.write(f"**Beta:** {beta}")

            if rec:
                if str(rec).upper() == "BUY":
                    st.success("Engine tilt: **BUY** — strong combination of growth/valuation/analyst data.")
                elif str(rec).upper() == "HOLD":
                    st.info("Engine tilt: **HOLD** — reasonable, but not a screaming bargain.")
                elif str(rec).upper() == "SELL":
                    st.error("Engine tilt: **SELL** — higher risk or weak supporting data.")
                else:
                    st.warning("Engine tilt: Signal available but classification is non-standard.")

        # Revenue chart
        with col_top3:
            st.markdown("##### Revenue (Last 4 Quarters, SEC)")
            if scr_row is not None and not scr_row.empty and all(
                q in scr_row.columns for q in ["Q1", "Q2", "Q3", "Q4"]
            ):
                r = scr_row.iloc[0]
                rev_data = pd.DataFrame(
                    {
                        "Quarter": ["Q4 (oldest)", "Q3", "Q2", "Q1 (latest)"],
                        "Revenue": [
                            r["Q4"],
                            r["Q3"],
                            r["Q2"],
                            r["Q1"],
                        ],
                    }
                )
                rev_data = rev_data.set_index("Quarter")
                st.bar_chart(rev_data, use_container_width=True)
            else:
                st.info("No SEC revenue data found for this ticker in the screened set.")

        st.markdown("---")

        # Optional: show raw rows
        with st.expander("Show raw data rows for this ticker"):
            st.write("**Signals row:**")
            if sig_row is not None and not sig_row.empty:
                st.dataframe(sig_row, use_container_width=True)
            else:
                st.caption("No signal row.")

            st.write("**Screened SEC row:**")
            if scr_row is not None and not scr_row.empty:
                st.dataframe(scr_row, use_container_width=True)
            else:
                st.caption("No screened row.")

            st.write("**Watchlist snapshot row:**")
            if watch_row is not None and not watch_row.empty:
                st.dataframe(watch_row, use_container_width=True)
            else:
                st.caption("No watchlist row.")
