import unittest
from datetime import date, datetime, timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

from backend.app import app


class ApiTests(unittest.TestCase):
    def test_eia_stays_visible_when_kite_token_expires(self):
        eia = {"status": "ok", "week_ending": "2026-10-23", "actual": 80, "previous": 77, "unit": "Bcf"}
        with patch("backend.app.report", return_value=eia), patch("backend.app.client", side_effect=RuntimeError("Kite session expired")):
            response = app.test_client().get("/api/overview?product=NG")
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["eia"]["actual"], 80)
        self.assertIsNone(body["market"])
        self.assertEqual(body["setup"]["stance"], "WAIT / REVIEW")

    def test_live_fixture_returns_contract_chain_and_defined_risk_side(self):
        today = date.today()
        expiry = today + timedelta(days=20)
        product = "NATURALGAS"
        future = {"name": product, "tradingsymbol": "NATURALGAS26NOVFUT", "segment": "MCX",
                  "instrument_type": "FUT", "expiry": expiry, "instrument_token": 1, "lot_size": 1250}
        options = [{"name": product, "tradingsymbol": f"NATURALGAS26NOV{strike}{kind}",
                    "segment": "MCX-OPT", "instrument_type": kind, "strike": strike, "expiry": expiry}
                   for kind in ("CE", "PE") for strike in (100, 110)]
        now = datetime.now(ZoneInfo("Asia/Kolkata")).isoformat()
        future_quote = {"last_price": 105, "ohlc": {"close": 100}, "oi": 120,
                        "timestamp": now, "volume": 100}

        def fake_quotes(_kite, symbols):
            if len(symbols) == 1 and symbols[0].endswith("FUT"):
                return {symbols[0]: future_quote}
            return {symbol: {"oi": 100, "volume": 10, "last_price": 4,
                             "depth": {"buy": [{"price": 3}], "sell": [{"price": 5}]}, "timestamp": now}
                    for symbol in symbols}

        history = [{"date": (today - timedelta(days=1)).isoformat(), "oi": 100}]
        eia = {"status": "ok", "week_ending": today.isoformat(), "actual": -5, "unit": "Bcf"}
        changes = {"MCX:" + row["tradingsymbol"]: {"change": 5, "baseline_at": now} for row in options}
        with patch("backend.app.client", return_value=object()), patch("backend.app.catalog", return_value=[future, *options]), \
             patch("backend.app.quote_batch", side_effect=fake_quotes), patch("backend.app.future_history", return_value=history), \
             patch("backend.app.report", return_value=eia), patch("backend.app.compare_and_save", return_value=changes):
            response = app.test_client().get("/api/overview?product=NG&forecast=1")
        self.assertEqual(response.status_code, 200)
        body = response.get_json()
        self.assertEqual(body["market"]["future"]["symbol"], "MCX:NATURALGAS26NOVFUT")
        self.assertEqual(len(body["market"]["chain"]), 4)
        self.assertEqual(body["setup"]["option_selling_side"], "Defined-risk put credit spread to review")


if __name__ == "__main__":
    unittest.main()
