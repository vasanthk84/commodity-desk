"""Official weekly inventory levels and derived stock changes."""

import os
import time
from datetime import date, timedelta
from pathlib import Path

import requests
from dotenv import dotenv_values

SERIES = {
    "gas": ("natural-gas/stor/wkly", "NW2_EPG0_SWO_R48_BCF", 1, "Bcf"),
    "crude": ("petroleum/stoc/wstk", "WCESTUS1", 1000, "million bbl"),
}
_cache = {}
ENV_FILE = Path(__file__).resolve().parents[1] / ".env"


def report(kind, supplied_key=""):
    if kind not in SERIES:
        return None
    key = supplied_key.strip() or os.environ.get("EIA_API_KEY") or dotenv_values(ENV_FILE).get("EIA_API_KEY") or ""
    if not key:
        return {"status": "key_missing", "message": "No EIA key is configured. Save one in Settings or in the server's private .env file."}
    cached = _cache.get((kind, key))
    if cached and time.monotonic() - cached[0] < 600:
        return cached[1]
    route, series, scale, unit = SERIES[kind]
    response = requests.get(
        f"https://api.eia.gov/v2/{route}/data/",
        params={"api_key": key, "frequency": "weekly", "data[0]": "value", "facets[series][]": series,
                "start": (date.today() - timedelta(days=50)).isoformat(), "sort[0][column]": "period",
                "sort[0][direction]": "desc", "length": "4"},
        timeout=15,
    )
    response.raise_for_status()
    rows = response.json().get("response", {}).get("data", [])
    if len(rows) < 2:
        return {"status": "unavailable", "message": "EIA has not published two weekly stock values yet."}
    current, prior = rows[0], rows[1]
    actual = round((float(current["value"]) - float(prior["value"])) / scale, 3)
    previous = round((float(prior["value"]) - float(rows[2]["value"])) / scale, 3) if len(rows) > 2 else None
    result = {"status": "ok", "kind": kind, "week_ending": current["period"], "actual": actual,
              "previous": previous, "unit": unit, "source": f"https://api.eia.gov/v2/{route}/data/",
              "schedule": "https://ir.eia.gov/ngs/schedule.html" if kind == "gas" else "https://www.eia.gov/petroleum/supply/weekly/schedule.php",
              "note": "A stock change is a supply-demand balance proxy, not a direct demand measurement. The EIA API may lag release by up to two hours."}
    _cache[(kind, key)] = (time.monotonic(), result)
    return result
