"""Resolve live MCX futures and option contracts from Kite's daily instrument dump."""

from datetime import date, datetime
from zoneinfo import ZoneInfo

PRODUCTS = {
    "NG": {"label": "Natural Gas", "aliases": ("NATURALGAS",)},
    "NGM": {"label": "Natural Gas Mini", "aliases": ("NATGASMINI", "NATURALGASMINI")},
    "CRUDE": {"label": "Crude Oil", "aliases": ("CRUDEOIL",)},
    "CRUDEM": {"label": "Crude Oil Mini", "aliases": ("CRUDEOILM", "CRUDEOILMINI")},
    "GOLD": {"label": "Gold", "aliases": ("GOLD",)},
    "GOLDM": {"label": "Gold Mini", "aliases": ("GOLDM", "GOLDMINI")},
}


def expiry_day(value):
    if isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return date.min


def root_name(row):
    return str(row.get("name") or "").upper().replace(" ", "").replace("-", "")


def product_for(row):
    name = root_name(row)
    symbol = str(row.get("tradingsymbol") or "").upper()
    for key in ("NGM", "NG", "CRUDEM", "CRUDE", "GOLDM", "GOLD"):
        if any(name == alias for alias in PRODUCTS[key]["aliases"]):
            return key
    for key in ("NGM", "NG", "CRUDEM", "CRUDE", "GOLDM", "GOLD"):
        if any(symbol.startswith(alias) and symbol[len(alias):len(alias) + 1].isdigit()
               for alias in PRODUCTS[key]["aliases"]):
            return key
    return None


def is_future(row):
    segment = str(row.get("segment") or "").upper()
    symbol = str(row.get("tradingsymbol") or "").upper()
    return segment == "MCX-FUT" or (segment == "MCX" and symbol.endswith("FUT"))


def is_option(row):
    segment = str(row.get("segment") or "").upper()
    kind = str(row.get("instrument_type") or "").upper()
    return segment == "MCX-OPT" or (segment == "MCX" and kind in ("CE", "PE"))


def discover(rows, key, today=None):
    if key not in PRODUCTS:
        raise ValueError("Unknown commodity")
    today = today or datetime.now(ZoneInfo("Asia/Kolkata")).date()
    found = [row for row in rows if product_for(row) == key and expiry_day(row.get("expiry")) >= today]
    futures = sorted((row for row in found if is_future(row)), key=lambda row: expiry_day(row.get("expiry")))
    options = [row for row in found if is_option(row)]
    if not futures:
        return {"product": key, "label": PRODUCTS[key]["label"], "future": None, "option_expiries": [], "options": [], "status": "No live MCX future found in Kite's instrument list"}
    expiries = sorted({expiry_day(row.get("expiry")) for row in options})
    return {"product": key, "label": PRODUCTS[key]["label"], "future": futures[0], "option_expiries": [d.isoformat() for d in expiries], "options": options, "status": "ok"}


def chain_window(options, expiry, future_price, width=10):
    rows = [row for row in options if expiry_day(row.get("expiry")).isoformat() == expiry and str(row.get("instrument_type") or "").upper() in ("CE", "PE")]
    strikes = sorted({float(row.get("strike") or 0) for row in rows if float(row.get("strike") or 0) > 0})
    if not strikes:
        return [], None
    nearest = min(range(len(strikes)), key=lambda index: abs(strikes[index] - future_price))
    chosen = set(strikes[max(0, nearest - width):nearest + width + 1])
    return [row for row in rows if float(row.get("strike") or 0) in chosen], strikes[nearest]
