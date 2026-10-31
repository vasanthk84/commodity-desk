"""Read-only Kite access. Credentials stay in the existing server-side env file."""

import os
import hmac
import time
from datetime import datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from dotenv import dotenv_values
from kiteconnect import KiteConnect

DEFAULT_SOURCE = Path(r"D:\stock-basket\.env")
_catalog = {"at": 0.0, "rows": []}
_validated = {"token": "", "at": 0.0}
IST = ZoneInfo("Asia/Kolkata")


def credential_candidates():
    source = Path(os.environ.get("KITE_SOURCE_ENV") or DEFAULT_SOURCE)
    values = dotenv_values(source) if source.is_file() else {}
    api_key = os.environ.get("KITE_API_KEY") or values.get("KITE_API_KEY")
    token = os.environ.get("KITE_ACCESS_TOKEN") or values.get("KITE_ACCESS_TOKEN")
    candidates = []
    oi_source = os.environ.get("OI_ANALYZER_ENV_PATH") or values.get("OI_ANALYZER_ENV_PATH") or ""
    oi_path = Path(oi_source) if oi_source else None
    if oi_path and not oi_path.is_absolute():
        oi_path = source.parent / oi_path
    if oi_path and oi_path.is_file():
        oi = dotenv_values(oi_path)
        if api_key and oi.get("KITE_API_KEY") and hmac.compare_digest(oi["KITE_API_KEY"], api_key) and oi.get("KITE_ACCESS_TOKEN"):
            candidates.append(("OI Analyzer", api_key, oi["KITE_ACCESS_TOKEN"]))
    if api_key and token and (not candidates or candidates[0][2] != token):
        candidates.append(("Stock Basket", api_key, token))
    if not candidates:
        raise RuntimeError("Kite credentials are unavailable. Check the OI Analyzer token source and Stock Basket environment.")
    return candidates


def client():
    for _, key, token in credential_candidates():
        kite = KiteConnect(api_key=key)
        kite.set_access_token(token)
        if _validated["token"] == token and time.monotonic() - _validated["at"] < 600:
            return kite
        try:
            kite.profile()
            _validated.update(token=token, at=time.monotonic())
            return kite
        except Exception:
            continue
    raise RuntimeError("Kite session expired. Run Kite Token Refresh in OI Analyzer, then retry.")


def catalog(kite):
    if _catalog["rows"] and time.monotonic() - _catalog["at"] < 12 * 3600:
        return _catalog["rows"]
    rows = kite.instruments("MCX")
    if not rows:
        raise RuntimeError("Kite returned no MCX instruments")
    _catalog.update(at=time.monotonic(), rows=rows)
    return rows


def future_history(kite, token):
    end = datetime.now(IST)
    start = end - timedelta(days=21)
    candles = kite.historical_data(token, start, end, "day", oi=True)
    return [
        {"date": str(row.get("date"))[:10], "close": row.get("close"), "oi": row.get("oi"), "volume": row.get("volume")}
        for row in candles[-12:]
    ]


def quote_batch(kite, symbols):
    result = {}
    for start in range(0, len(symbols), 400):
        result.update(kite.quote(symbols[start:start + 400]))
    return result
