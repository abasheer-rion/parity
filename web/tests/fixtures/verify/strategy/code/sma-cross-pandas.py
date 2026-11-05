import pandas as pd
import numpy as np
import yfinance as yf

FAST = 20
SLOW = 50

df = yf.download("BTC-USD", start="2018-01-01")
df["fast"] = df["Close"].rolling(FAST).mean()
df["slow"] = df["Close"].rolling(window=SLOW).mean()
df["signal"] = np.where(df["fast"] > df["slow"], 1, 0)
df["position"] = df["signal"].shift(1)
df["returns"] = df["Close"].pct_change()
df["strategy"] = df["position"] * df["returns"]
print((1 + df["strategy"]).cumprod().iloc[-1])
