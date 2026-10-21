"""Parity: a small research engine for currency strategies.

The pieces, in the order data flows through them:

    data/        download and cache free market data
    strategies/  turn data into target weights (one file per idea, removable)
    backtest/    hold those weights, charge costs, credit carry
    metrics/     score the result against the S&P 500
    report.py    run everything and write one JSON document
    publish/     send that document to Supabase for the dashboard
"""

__version__ = "0.1.0"
