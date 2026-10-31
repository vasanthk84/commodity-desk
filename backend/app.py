"""Local read-only API for Commodity Desk."""

from datetime import datetime, timezone

from flask import Flask, jsonify, request

from backend.analysis import futures_read, option_read, setup_read
from backend.catalog import PRODUCTS, chain_window, discover
from backend.eia_data import report
from backend.kite_data import catalog, client, future_history, quote_batch
from backend.snapshots import compare_and_save

app = Flask(__name__)


def error_text(exc, source):
    name = type(exc).__name__
    if name == "TokenException":
        return f"{source} session expired. Run Kite Token Refresh in OI Analyzer, then retry."
    if name == "PermissionException":
        return f"{source} account or data permission is unavailable."
    if isinstance(exc, RuntimeError):
        return str(exc)
    return f"{source} is unavailable ({name}). Retry after checking the connection."


@app.get("/api/health")
def health():
    return jsonify(status="ok", service="commodity-desk", mode="read-only")


@app.get("/api/strip")
def strip():
    try:
        kite = client()
        rows = catalog(kite)
        found = {key: discover(rows, key) for key in PRODUCTS}
        symbols = ["MCX:" + item["future"]["tradingsymbol"] for item in found.values() if item["future"]]
        quotes = quote_batch(kite, symbols)
        result = []
        for key, item in found.items():
            future = item["future"]
            symbol = "MCX:" + future["tradingsymbol"] if future else None
            quote = quotes.get(symbol, {}) if symbol else {}
            result.append({"product": key, "label": item["label"], "symbol": symbol,
                           "expiry": str(future.get("expiry"))[:10] if future else None,
                           "price": quote.get("last_price"), "oi": quote.get("oi"),
                           "quote_at": str(quote.get("timestamp") or ""), "status": item["status"]})
        return jsonify(items=result, source="Kite Connect / MCX", as_of=datetime.now(timezone.utc).isoformat())
    except Exception as exc:
        return jsonify(error=error_text(exc, "Kite")), 503


@app.get("/api/overview")
def overview():
    product = request.args.get("product", "NG").upper()
    if product not in PRODUCTS:
        return jsonify(error="Choose a supported commodity"), 400
    forecast_text = request.args.get("forecast", "").strip()
    try:
        forecast = float(forecast_text) if forecast_text else None
        if forecast is not None and (abs(forecast) > 100000 or forecast != forecast):
            raise ValueError()
    except ValueError:
        return jsonify(error="Forecast must be a finite number"), 400
    payload = {"product": product, "label": PRODUCTS[product]["label"],
               "as_of": datetime.now(timezone.utc).isoformat(), "market": None,
               "market_error": None, "eia": None, "eia_error": None, "setup": None}
    kind = "gas" if product in ("NG", "NGM") else "crude" if product in ("CRUDE", "CRUDEM") else None
    if kind:
        try:
            payload["eia"] = report(kind, request.headers.get("X-EIA-Key", ""))
        except Exception as exc:
            payload["eia_error"] = error_text(exc, "EIA")
    try:
        kite = client()
        found = discover(catalog(kite), product)
        if not found["future"]:
            raise RuntimeError(found["status"])
        future = found["future"]
        future_symbol = "MCX:" + future["tradingsymbol"]
        future_quote = quote_batch(kite, [future_symbol]).get(future_symbol)
        if not future_quote:
            raise RuntimeError("Kite returned no quote for the selected MCX future")
        price = float(future_quote.get("last_price") or 0)
        chosen_expiry = request.args.get("expiry") or (found["option_expiries"][0] if found["option_expiries"] else "")
        if chosen_expiry not in found["option_expiries"]:
            chosen_expiry = found["option_expiries"][0] if found["option_expiries"] else ""
        selected, atm = chain_window(found["options"], chosen_expiry, price)
        symbols = ["MCX:" + row["tradingsymbol"] for row in selected]
        quotes = quote_batch(kite, symbols) if symbols else {}
        changes = compare_and_save(quotes)
        chain = []
        for row in selected:
            symbol = "MCX:" + row["tradingsymbol"]
            quote = quotes.get(symbol, {})
            baseline = changes.get(symbol, {})
            chain.append({"symbol": symbol, "strike": row.get("strike"), "type": row.get("instrument_type"),
                          "oi": quote.get("oi"), "oi_change": baseline.get("change"),
                          "baseline_at": baseline.get("baseline_at"), "last_price": quote.get("last_price"),
                          "volume": quote.get("volume"), "bid": (quote.get("depth", {}).get("buy") or [{}])[0].get("price"),
                          "ask": (quote.get("depth", {}).get("sell") or [{}])[0].get("price"),
                          "quote_at": str(quote.get("timestamp") or "")})
        try:
            history = future_history(kite, future["instrument_token"])
        except Exception:
            history = []
        future_read = futures_read(future_quote, history)
        option_summary = option_read(chain)
        payload["market"] = {"future": {"symbol": future_symbol, "expiry": str(future.get("expiry"))[:10],
                                                "lot_size": future.get("lot_size"), "last_price": price,
                                                "oi": future_quote.get("oi"), "volume": future_quote.get("volume"),
                                                "quote_at": str(future_quote.get("timestamp") or ""),
                                                "read": future_read},
                             "option_expiries": found["option_expiries"], "selected_expiry": chosen_expiry,
                             "atm": atm, "chain": chain, "options": option_summary,
                             "history": history, "source": "Kite Connect / MCX"}
        payload["setup"] = setup_read(future_read, option_summary, payload["eia"], forecast, product, chosen_expiry or None)
    except Exception as exc:
        payload["market_error"] = error_text(exc, "Kite")
        payload["setup"] = {"stance": "WAIT / REVIEW", "option_selling_side": None,
                            "reasons": [payload["market_error"]], "risk": "No trade read without live contract data."}
    return jsonify(payload)


if __name__ == "__main__":
    app.run(host="127.0.0.1", port=5004, debug=False)
