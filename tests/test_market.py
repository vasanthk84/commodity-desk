import unittest
import os
from datetime import date, datetime, timedelta
from unittest.mock import patch
from zoneinfo import ZoneInfo

from backend.analysis import futures_read, option_read, setup_read
from backend.catalog import chain_window, discover, product_for
from backend.eia_data import report


class MarketTests(unittest.TestCase):
    def test_product_roots_keep_mini_and_other_gold_separate(self):
        self.assertEqual(product_for({"name": "NATGASMINI", "tradingsymbol": "NATGASMINI..."}), "NGM")
        self.assertEqual(product_for({"name": "NATURALGAS", "tradingsymbol": "NATURALGAS..."}), "NG")
        self.assertEqual(product_for({"name": "CRUDEOILM", "tradingsymbol": "CRUDEOILM..."}), "CRUDEM")
        self.assertEqual(product_for({"name": "GOLDM", "tradingsymbol": "GOLDM..."}), "GOLDM")
        self.assertIsNone(product_for({"name": "GOLDPETAL", "tradingsymbol": "GOLDPETAL..."}))
        self.assertEqual(product_for({"name": "", "tradingsymbol": "GOLD26DECFUT"}), "GOLD")
        self.assertEqual(product_for({"name": "", "tradingsymbol": "GOLDM26DECFUT"}), "GOLDM")
        self.assertIsNone(product_for({"name": "", "tradingsymbol": "GOLDPETAL26DECFUT"}))

    def test_contract_discovery_uses_live_future_and_matching_option_expiry(self):
        tomorrow = date.today() + timedelta(days=1)
        later = tomorrow + timedelta(days=30)
        rows = [
            {"name": "NATURALGAS", "tradingsymbol": "F1", "segment": "MCX-FUT", "expiry": later},
            {"name": "NATURALGAS", "tradingsymbol": "F0", "segment": "MCX-FUT", "expiry": tomorrow},
            {"name": "NATURALGAS", "tradingsymbol": "C1", "segment": "MCX-OPT", "instrument_type": "CE", "strike": 100, "expiry": tomorrow},
            {"name": "NATURALGAS", "tradingsymbol": "P1", "segment": "MCX-OPT", "instrument_type": "PE", "strike": 110, "expiry": tomorrow},
        ]
        found = discover(rows, "NG", today=date.today())
        self.assertEqual(found["future"]["tradingsymbol"], "F0")
        selected, atm = chain_window(found["options"], tomorrow.isoformat(), 104)
        self.assertEqual(len(selected), 2)
        self.assertEqual(atm, 100)

    def test_eia_change_is_difference_of_stock_levels(self):
        class Response:
            def raise_for_status(self): pass
            def json(self):
                return {"response": {"data": [{"period": "2026-10-09", "value": "3567"},
                                               {"period": "2026-10-02", "value": "3500"},
                                               {"period": "2026-09-25", "value": "3415"}]}}
        with patch("backend.eia_data.requests.get", return_value=Response()):
            value = report("gas", "test-key")
        self.assertEqual(value["actual"], 67)
        self.assertEqual(value["previous"], 85)
        self.assertNotIn("forecast", value)

    def test_eia_uses_private_server_key_without_browser_header(self):
        class Response:
            def raise_for_status(self): pass
            def json(self):
                return {"response": {"data": [{"period": "2026-10-09", "value": "3567"},
                                               {"period": "2026-10-02", "value": "3500"}]}}

        with patch.dict(os.environ, {"EIA_API_KEY": ""}), \
             patch("backend.eia_data.dotenv_values", return_value={"EIA_API_KEY": "private-test-key"}), \
             patch("backend.eia_data.requests.get", return_value=Response()) as get:
            value = report("gas")
        self.assertEqual(value["status"], "ok")
        self.assertEqual(get.call_args.kwargs["params"]["api_key"], "private-test-key")

    def test_trade_side_waits_without_fresh_quote_or_liquidity(self):
        now = datetime.now(ZoneInfo("Asia/Kolkata"))
        quote = {"last_price": 105, "ohlc": {"close": 100}, "oi": 120,
                 "timestamp": now.isoformat()}
        history = [{"date": (now.date() - timedelta(days=1)).isoformat(), "oi": 100}]
        read = futures_read(quote, history)
        self.assertEqual(read["direction"], "bullish")
        chain = [{"type": kind, "strike": strike, "oi": 100, "oi_change": 5,
                  "bid": 1, "ask": 2, "volume": 10}
                 for kind in ("CE", "PE") for strike in (100, 110)]
        options = option_read(chain)
        eia = {"status": "ok", "week_ending": date.today().isoformat(), "actual": -5}
        aligned = setup_read(read, options, eia, 1, "NG")
        self.assertEqual(aligned["option_selling_side"], "Defined-risk put credit spread to review")
        stale = setup_read({**read, "fresh": False}, options, eia, 1, "NG")
        self.assertIsNone(stale["option_selling_side"])
        no_quotes = option_read([{**row, "bid": 0} for row in chain])
        self.assertIsNone(setup_read(read, no_quotes, eia, 1, "NG")["option_selling_side"])


if __name__ == "__main__":
    unittest.main()
