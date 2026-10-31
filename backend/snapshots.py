"""Local snapshot baseline for option OI changes; no order or account data."""

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

DB = Path(__file__).resolve().parents[1] / "data" / "oi_snapshots.sqlite3"


def compare_and_save(quotes):
    DB.parent.mkdir(parents=True, exist_ok=True)
    output = {}
    stamp = datetime.now(timezone.utc).isoformat()
    with sqlite3.connect(DB) as connection:
        connection.execute("CREATE TABLE IF NOT EXISTS oi_snapshots (symbol TEXT PRIMARY KEY, oi REAL NOT NULL, observed_at TEXT NOT NULL)")
        for symbol, quote in quotes.items():
            oi = quote.get("oi")
            if oi is None:
                continue
            previous = connection.execute("SELECT oi, observed_at FROM oi_snapshots WHERE symbol=?", (symbol,)).fetchone()
            output[symbol] = {"change": float(oi) - previous[0] if previous else None, "baseline_at": previous[1] if previous else None}
            connection.execute("INSERT INTO oi_snapshots(symbol,oi,observed_at) VALUES(?,?,?) ON CONFLICT(symbol) DO UPDATE SET oi=excluded.oi, observed_at=excluded.observed_at", (symbol, float(oi), stamp))
    return output
