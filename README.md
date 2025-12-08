# 📘 Investing AI Engine

An automated, rule-based equity research engine that analyzes **SEC financial filings** and **market valuation data** to generate **Buy / Hold / Sell** signals for a predefined stock watchlist.

The goal of this project is to help investors **systematically evaluate companies** using transparent, explainable logic — not black-box machine learning.

---

## 🚀 How This Engine Is Used

This engine is designed to be run as a **batch research tool**.

### Typical Usage Flow

1. **Run the engine**
   ```bash
   python src/sec_engine_full.py
   ```

2. The engine:
   - Downloads SEC-listed companies
   - Screens them for strong revenue growth
   - Pulls market valuation data
   - Evaluates your watchlist
   - Generates Buy / Hold / Sell signals

3. You review the output CSV files inside the `output/` directory and use them
   as **decision-support input** for your investment research.

This engine does **not execute trades**.  
It produces **research signals**, not financial advice.

---

## 🧠 How the Engine Makes Decisions

All decisions are **rules-based and explainable**.  
Each stock is evaluated through multiple stages.

---

## 🔍 Step-by-Step Decision Logic

### 1️⃣ SEC Revenue Growth Screening

The engine analyzes the **last 4 quarters of revenue** from SEC XBRL filings:

✅ Conditions to PASS the revenue screen:
- Each quarter shows sequential growth  
  *(Q1 > Q2 > Q3 > Q4, latest first)*
- Latest quarter revenue is higher than the same quarter last year  

Stocks passing this screen receive a **green revenue flag**.

---

### 2️⃣ Market & Valuation Analysis

For screened stocks and watchlist tickers, the engine retrieves:
- Price
- Market capitalization
- Trailing P/E
- Forward P/E
- PEG ratio
- Beta
- Sector & industry

The engine categorizes valuation as:
- **Cheap** (P/E < 12)
- **Reasonable** (P/E 12–25)
- **Expensive** (P/E 25–40)
- **Very Expensive** (P/E > 40)

It also checks if **forward P/E improves relative to trailing P/E**, which may
indicate expected earnings growth.

---

### 3️⃣ Watchlist Evaluation

The watchlist is defined **directly in the code** and represents the stocks you
actively care about.

For each watchlist ticker, the engine determines:
- Whether it passed the SEC revenue screen
- Its valuation profile
- Its market risk characteristics

---

### 4️⃣ Buy / Hold / Sell Classification

Each stock receives a final classification using the following logic:

---

#### ✅ BUY
A stock is marked **BUY** when:
- Revenue growth is strong **AND**
- Valuation is cheap or reasonable  
**OR**
- Forward earnings expectations are improving  

---

#### ⚖️ HOLD
A stock is marked **HOLD** when:
- Revenue growth exists but valuation is stretched
- Signals are mixed
- Company quality is strong but price is high

---

#### ❌ SELL
A stock is marked **SELL** when:
- It is highly speculative (no earnings, no revenue growth)
- Valuation is extremely high with weak fundamentals
- There are no supporting signals from revenue or valuation

---

### 🔍 Key Principle
**No single metric determines the outcome.**  
The engine combines revenue trends and valuation context to avoid false signals.

---

## 📁 Repository Structure

```
investing-ai-engine/
│
├── src/
│   ├── sec_engine_full.py   # Main screening & decision engine
│   └── utils.py             # Logging & path helpers
│
├── output/
│   ├── sec_all_tickers.csv
│   ├── sec_revenue_screened.csv
│   ├── sec_revenue_screened_with_pe.csv
│   ├── final_screened_with_research.csv
│   ├── watchlist_snapshot.csv
│   └── watchlist_signals.csv
│
├── README.md
├── requirements.txt
├── LICENSE
└── .gitignore
```

---

## 📊 Key Output File

```
output/watchlist_signals.csv
```

This file contains:
- Ticker
- Sector & industry
- Revenue flag (green / neutral)
- Valuation metrics
- Final Buy / Hold / Sell signal

This is the **primary file you review** for decision support.

---

## ⚠️ Important Notes

- This engine is **rule-based**, not machine learning
- Logic is intentionally simple, transparent, and auditable
- Designed for **research and education**
- Not investment advice

---

## 📜 License

MIT License

---

🚀 **Use this engine as a systematic research assistant — not a trading system.**
