"""Explain observable OI and price patterns; never create an order."""

from datetime import date, datetime, timezone
from zoneinfo import ZoneInfo

IST = ZoneInfo("Asia/Kolkata")


def timestamp_age_minutes(raw):
    if not raw:
        return None
    try:
        value = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
        if value.tzinfo is None:
            value = value.replace(tzinfo=IST)
        return max(0, (datetime.now(timezone.utc) - value.astimezone(timezone.utc)).total_seconds() / 60)
    except ValueError:
        return None


def futures_read(quote, history):
    price = quote.get("last_price")
    prior_close = (quote.get("ohlc") or {}).get("close")
    prior_oi = next((row.get("oi") for row in reversed(history) if row.get("oi") is not None and row.get("date") < datetime.now(IST).date().isoformat()), None)
    oi = quote.get("oi")
    price_change = (float(price) - float(prior_close)) / float(prior_close) * 100 if price and prior_close else None
    oi_change = (float(oi) - float(prior_oi)) / float(prior_oi) * 100 if oi is not None and prior_oi else None
    if price_change is None or oi_change is None or abs(price_change) < 0.15 or abs(oi_change) < 0.5:
        pattern = "Mixed / too small to classify"
        direction = "mixed"
    elif price_change > 0 and oi_change > 0:
        pattern, direction = "Price up + OI up: fresh long participation", "bullish"
    elif price_change < 0 and oi_change > 0:
        pattern, direction = "Price down + OI up: fresh short participation", "bearish"
    elif price_change > 0:
        pattern, direction = "Price up + OI down: short covering", "mixed"
    else:
        pattern, direction = "Price down + OI down: long unwinding", "mixed"
    age = timestamp_age_minutes(quote.get("timestamp"))
    return {"price_change_pct": price_change, "oi_change_pct": oi_change, "prior_oi": prior_oi,
            "pattern": pattern, "direction": direction, "quote_age_minutes": age,
            "fresh": age is not None and age <= 15}


def option_read(chain):
    calls = [row for row in chain if row["type"] == "CE"]
    puts = [row for row in chain if row["type"] == "PE"]
    call_oi = sum(row["oi"] or 0 for row in calls)
    put_oi = sum(row["oi"] or 0 for row in puts)
    wall = lambda rows: max(rows, key=lambda row: row["oi"] or 0)["strike"] if rows else None
    tradable_calls = sum(1 for row in calls if row["bid"] and row["ask"] and row["volume"])
    tradable_puts = sum(1 for row in puts if row["bid"] and row["ask"] and row["volume"])
    return {"call_oi": call_oi, "put_oi": put_oi, "pcr": round(put_oi / call_oi, 2) if call_oi else None,
            "call_wall": wall(calls), "put_wall": wall(puts), "tradable_calls": tradable_calls, "tradable_puts": tradable_puts,
            "has_baseline": any(row["oi_change"] is not None for row in chain),
            "note": "Option OI change is measured since the previous app refresh, not from yesterday's close. PCR and walls are descriptive."}


def setup_read(futures, chain, eia, forecast, product, expiry=None):
    reasons = []
    if not futures["fresh"]:
        reasons.append("Last quote is over 15 minutes old or missing. Wait for a new MCX quote before evaluating a setup.")
    if not chain["has_baseline"]:
        reasons.append("Refresh again later to establish an option OI change baseline.")
    if chain["tradable_calls"] < 2 or chain["tradable_puts"] < 2:
        reasons.append("Fewer than two strikes on each side have bid/ask and volume; check liquidity.")
    if product != "GOLD" and product != "GOLDM":
        if not eia or eia.get("status") != "ok":
            reasons.append("EIA inventory context is unavailable.")
        elif (datetime.now(IST).date() - date.fromisoformat(eia["week_ending"])).days > 14:
            reasons.append("The latest EIA inventory release is too old for this setup.")
        if forecast is None:
            reasons.append("Enter a market consensus forecast to compare with the EIA release.")
    else:
        reasons.append("Gold needs rates, USD and macro context; this desk has no complete gold driver feed.")
    if expiry and (date.fromisoformat(expiry) - datetime.now(IST).date()).days <= 2:
        reasons.append("Option expiry is within two days; review exercise and futures exposure.")
    direction = futures["direction"]
    if direction == "mixed":
        reasons.append("Futures price and OI do not show a clear fresh buildup.")
    if eia and eia.get("status") == "ok" and forecast is not None and product not in ("GOLD", "GOLDM"):
        surprise = eia["actual"] - forecast
        if abs(surprise) < 0.1:
            reasons.append("Inventory result is close to consensus.")
        elif direction == "bullish" and surprise > 0 or direction == "bearish" and surprise < 0:
            reasons.append("Inventory surprise and OI price read disagree; investigate the reaction.")
    if reasons:
        return {"stance": "WAIT / REVIEW", "option_selling_side": None, "reasons": reasons,
                "risk": "Do not sell an uncovered option. Any paper idea must define max loss, margin, expiry and event gap risk."}
    side = "Defined-risk put credit spread to review" if direction == "bullish" else "Defined-risk call credit spread to review"
    return {"stance": "CONDITIONS ALIGNED", "option_selling_side": side,
            "reasons": [futures["pattern"], "Check nearby OI walls and bid/ask liquidity before planning a spread."],
            "risk": "This is a conditional research read, not a probability forecast or order. Define max loss, margin, expiry and event gap risk."}
