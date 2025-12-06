# ===========================================================
#  dashboard.py — Clean, improved Streamlit dashboard
#  Reads output/ CSVs created by sec_engine_full.py
# ===========================================================

import os
from pathlib import Path
import pandas as pd
import streamlit as st

# ===========================================================
# CONFIG
# ===========================================================
OUTPUT_DIR = Path("output")

st.set_page_config(
    page_title="SEC Revenue + Watchlist Dashboard",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ===========================================================
# HELPERS
# ===========================================================
@st.cache_data
def load_csv(name: str) -> pd.DataFrame | None:
    path = OUTPUT_DIR / name
    if not path.exists():
        return None
    try:
        df = pd.read_csv(path)

        # Clean up common formatting issues
        df.columns = df.columns.str.strip()
        for col in df.columns:
            if df[col].dtype == "object":
                df[col] = df[col].astype(str).str.strip()

        return df
    except Exception as e:
        st.error(f"Error reading {name}: {e}")
        return None


def calc_revenue_growth_cols(df: pd.DataFrame) -> pd.DataFrame:
    """Compute strict QoQ and YoY flags for Q1..Q4 revenue."""
    required = {"Q1", "Q2", "Q3", "Q4"}
    if not required.issubset(df.columns):
        return df

    df = df.copy()
    for q in required:
        df[q] = pd.to_numeric(df[q], errors="coerce")

    df["QoQ_strict_up"] = (df["Q1"] > df["Q2"]) & (df["Q2"] > df["Q3"]) & (df["Q3"] > df["Q4"])
    df["YoY_up"] = df["Q1"] > df["Q4"]
    df["RevScore"] = df["QoQ_strict_up"].astype(int) * 2 + df["YoY_up"].astype(int)

    return df


def style_recommendation(val):
    if isinstance(val, str):
        v = val.upper()
        colors = {
            "BUY": "#0f9d58",
            "HOLD": "#f4b400",
            "SELL": "#db4437",
        }
        if v in colors:
            return f"background-color:{colors[v]};color:white;font-weight:600;"
    return ""

# ===========================================================
# LOAD CSVs
# ===========================================================

df_rev = load_csv("sec_revenue_screened.csv")
df_rev_pe = load_csv("sec_revenue_screened_with_pe.csv")
df_final = load_csv("final_screened_with_research.csv")
df_watch = load_csv("watchlist_snapshot.csv")
df_signals = load_csv("watchlist_signals.csv")

# ===========================================================
# PREPARE SCREENED DATASET
# ===========================================================

df_screened = None
if df_rev_pe is not None:
    df_screened = df_rev_pe.copy()
elif df_rev is not None:
    df_screened = df_rev.copy()

if df_screened is not None:
    df_screened = calc_revenue_growth_cols(df_screened)

# Merge analyst data
if df_final is not None and df_screened is not None:
    df_final["ticker"] = df_final["ticker"].str.upper()
    df_screened["ticker"] = df_screened["ticker"].str.upper()
    extra_cols = [c for c in df_final.columns if c not in df_screened.columns]
    df_screened = df_screened.merge(
        df_final[["ticker"] + extra_cols],
        on="ticker",
        how="left",
    )

# ===========================================================
# SIDEBAR — FILTERS
# ===========================================================

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
    icon = "✅" if ok else "❌"
    st.sidebar.write(f"{icon} {fname}")

st.sidebar.markdown("---")

# Sector filter (watchlist)
sector_filter = None
if df_watch is not None and "sector" in df_watch.columns:
    sectors = sorted(df_watch["sector"].dropna().unique())
    sector_filter = st.sidebar.multiselect("Filter by sector", sectors)

# Recommendation filter
rec_filter = None
if df_signals is not None and "final_recommendation" in df_signals.columns:
    recs = sorted(df_signals["final_recommendation"].dropna().unique())
    rec_filter = st.sidebar.multiselect("Filter by recommendation", recs)

st.sidebar.markdown("---")
st.sidebar.caption("To update data, re-run sec_engine_full.py")

# ===========================================================
# MAIN UI
# ===========================================================

st.title("📊 SEC + Watchlist Dashboard")

tabs = st.tabs(["🏁 Overview", "📈 Screened Revenue Growers", "🧾 Watchlist & Signals", "🔍 Ticker Detail"])

# ===========================================================
# TAB 1 — OVERVIEW
# ===========================================================
with tabs[0]:

    st.subheader("High-Level Summary")

    col1, col2, col3, col4 = st.columns(4)

    total_screened = len(df_screened) if df_screened is not None else 0
    total_watch = len(df_watch) if df_watch is not None else 0
    total_signals = len(df_signals) if df_signals is not None else 0

    with col1:
        st.metric("Revenue Screened", total_screened)

    with col2:
        st.metric("Watchlist Size", total_watch)

    with col3:
        st.metric("Signals Generated", total_signals)

    with col4:
        if df_screened is not None:
            avg_pe = df_screened["trailing_PE"].dropna().mean()
            st.metric("Avg P/E", f"{avg_pe:.1f}")
        else:
            st.metric("Avg P/E", "N/A")

    st.markdown("---")

    colA, colB = st.columns(2)

    # Recommendation distribution
    with colA:
        st.markdown("#### Recommendation Distribution")
        if df_signals is not None:
            rec_counts = df_signals["final_recommendation"].value_counts().reset_index()
            rec_counts.columns = ["Recommendation", "Count"]
            st.bar_chart(rec_counts.set_index("Recommendation"))
        else:
            st.info("No signals file loaded.")

    with colB:
        st.markdown("#### Sector Breakdown (Watchlist)")
        if df_watch is not None:
            sec_counts = df_watch["sector"].value_counts().reset_index()
            sec_counts.columns = ["Sector", "Count"]
            st.bar_chart(sec_counts.set_index("Sector"))
        else:
            st.info("No watchlist file loaded.")

# ===========================================================
# TAB 2 — SCREENED REVENUE GROWERS
# ===========================================================
with tabs[1]:
    st.subheader("Strong Revenue Trend Companies (SEC Screened)")

    if df_screened is None:
        st.warning("No screened data found.")
    else:
        df_view = df_screened.copy()

        # Filters
        min_pe, max_pe = st.slider(
            "P/E Range",
            min_value=0.0,
            max_value=float(df_view["trailing_PE"].dropna().max() or 50),
            value=(0.0, float(df_view["trailing_PE"].dropna().max() or 50)),
            step=0.5,
        )

        only_qoq = st.checkbox("Only strict Q/Q up")
        only_yoy = st.checkbox("Only YoY up (Q1 > Q4)")

        # Apply filters
        df_view["trailing_PE"] = pd.to_numeric(df_view["trailing_PE"], errors="coerce")
        df_view = df_view[
            (df_view["trailing_PE"].isna()) |
            ((df_view["trailing_PE"] >= min_pe) & (df_view["trailing_PE"] <= max_pe))
        ]

        if only_qoq:
            df_view = df_view[df_view["QoQ_strict_up"]]

        if only_yoy:
            df_view = df_view[df_view["YoY_up"]]

        cols = ["ticker", "name", "Q1", "Q2", "Q3", "Q4", "trailing_PE", "market_cap"]
        existing = [c for c in cols if c in df_view.columns]
        st.dataframe(df_view[existing], use_container_width=True)

# ===========================================================
# TAB 3 — WATCHLIST & SIGNALS
# ===========================================================
with tabs[2]:

    st.subheader("Watchlist & Signals")

    col1, col2 = st.columns(2)

    # Watchlist
    with col1:
        st.markdown("#### Watchlist Snapshot")

        if df_watch is not None:
            df_w = df_watch.copy()
            if sector_filter:
                df_w = df_w[df_w["sector"].isin(sector_filter)]
            st.dataframe(df_w, use_container_width=True)
        else:
            st.info("No watchlist data.")

    # Signals
    with col2:
        st.markdown("#### Buy / Hold / Sell Signals")

        if df_signals is not None:
            df_s = df_signals.copy()
            if rec_filter:
                df_s = df_s[df_s["final_recommendation"].isin(rec_filter)]
            if sector_filter:
                df_s = df_s[df_s["sector"].isin(sector_filter)]

            key_cols = [
                "ticker", "name", "sector", "industry", "price",
                "trailing_PE", "forward_PE", "rev_flag", "beta",
                "final_recommendation",
            ]
            cols = [c for c in key_cols if c in df_s.columns]

            st.dataframe(
                df_s[cols].style.applymap(style_recommendation, subset=["final_recommendation"]),
                use_container_width=True,
            )
        else:
            st.info("No signals data.")

# ===========================================================
# TAB 4 — TICKER DETAIL
# ===========================================================
with tabs[3]:

    st.subheader("Ticker Detail")

    tickers_available = []
    if df_signals is not None:
        tickers_available = sorted(df_signals["ticker"].unique())
    elif df_screened is not None:
        tickers_available = sorted(df_screened["ticker"].unique())

    if not tickers_available:
        st.info("No tickers available.")
    else:
        selected = st.selectbox("Choose ticker", tickers_available)

        sig_row = df_signals[df_signals["ticker"] == selected] if df_signals is not None else None
        scr_row = df_screened[df_screened["ticker"] == selected] if df_screened is not None else None
        watch_row = df_watch[df_watch["ticker"] == selected] if df_watch is not None else None

        colA, colB = st.columns(2)

        # SNAPSHOT
        with colA:
            st.markdown("#### Snapshot")
            r = None
            for dfc in [sig_row, watch_row, scr_row]:
                if dfc is not None and not dfc.empty:
                    r = dfc.iloc[0]
                    break

            if r is not None:
                st.write(f"**Ticker:** {selected}")
                st.write(f"**Name:** {r.get('name')}")
                st.write(f"**Sector:** {r.get('sector')}")
                st.write(f"**Industry:** {r.get('industry')}")
                st.write(f"**Price:** {r.get('price')}")
                st.write(f"**P/E:** {r.get('trailing_PE')}")
            else:
                st.info("No data for this ticker.")

        # RECOMMENDATION
        with colB:
            st.markdown("#### Recommendation")
            if sig_row is not None and not sig_row.empty:
                rec = sig_row.iloc[0].get("final_recommendation")
                rev_flag = sig_row.iloc[0].get("rev_flag")
                st.write(f"**Recommendation:** {rec}")
                st.write(f"**Revenue Flag:** {rev_flag}")

                if rec == "BUY":
                    st.success("Strong Buy Signal")
                elif rec == "HOLD":
                    st.warning("Hold Signal")
                elif rec == "SELL":
                    st.error("Sell Signal")

        # REVENUE BAR CHART
        st.markdown("---")
        st.markdown("#### SEC Revenue (Last 4 Quarters)")

        if scr_row is not None and not scr_row.empty:
            r = scr_row.iloc[0]
            if all(q in scr_row.columns for q in ["Q1", "Q2", "Q3", "Q4"]):
                rev_df = pd.DataFrame({
                    "Quarter": ["Q4", "Q3", "Q2", "Q1"],
                    "Revenue": [r["Q4"], r["Q3"], r["Q2"], r["Q1"]],
                }).set_index("Quarter")
                st.bar_chart(rev_df)
            else:
                st.info("No Q1–Q4 data available.")
