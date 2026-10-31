"""OI Analyzer's refreshed Kite token takes priority over Stock Basket's copy."""

import os
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

from backend import kite_data
from kiteconnect.exceptions import PermissionException, TokenException


class KiteSourceTests(unittest.TestCase):
    def setUp(self):
        self.original_validation = kite_data._validated.copy()
        kite_data._validated.update(token="", at=0.0)

    def tearDown(self):
        kite_data._validated.update(self.original_validation)

    def test_prefers_matching_oi_token_and_reads_each_refresh(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            oi = root / "oi.env"
            stock = root / "stock.env"
            oi.write_text("KITE_API_KEY=same-key\nKITE_ACCESS_TOKEN=first-oi-token\n", encoding="utf-8")
            stock.write_text(
                f"KITE_API_KEY=same-key\nKITE_ACCESS_TOKEN=old-stock-token\nOI_ANALYZER_ENV_PATH={oi.as_posix()}\n",
                encoding="utf-8",
            )
            with patch.dict(os.environ, {"KITE_SOURCE_ENV": str(stock)}, clear=True), patch.object(kite_data, "KiteConnect") as factory:
                self.assertEqual(kite_data.credential_candidates()[0][0], "OI Analyzer")
                kite_data.client()
                self.assertEqual(factory.return_value.set_access_token.call_args.args[0], "first-oi-token")
                oi.write_text("KITE_API_KEY=same-key\nKITE_ACCESS_TOKEN=renewed-oi-token\n", encoding="utf-8")
                kite_data.client()
                self.assertEqual(factory.return_value.set_access_token.call_args.args[0], "renewed-oi-token")
                self.assertEqual(factory.return_value.profile.call_count, 2)

    def test_rejects_different_oi_api_key_and_uses_stock_token(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            oi = root / "oi.env"
            stock = root / "stock.env"
            oi.write_text("KITE_API_KEY=other-key\nKITE_ACCESS_TOKEN=unrelated-token\n", encoding="utf-8")
            stock.write_text(
                f"KITE_API_KEY=same-key\nKITE_ACCESS_TOKEN=stock-token\nOI_ANALYZER_ENV_PATH={oi.as_posix()}\n",
                encoding="utf-8",
            )
            with patch.dict(os.environ, {"KITE_SOURCE_ENV": str(stock)}, clear=True):
                self.assertEqual(kite_data.credential_candidates(), [("Stock Basket", "same-key", "stock-token")])

    def test_permission_denial_is_not_reported_as_token_expiry(self):
        candidates = [("OI Analyzer", "same-key", "renewed-token"),
                      ("Stock Basket", "same-key", "old-token")]
        with patch.object(kite_data, "credential_candidates", return_value=candidates), \
             patch.object(kite_data, "KiteConnect") as factory:
            factory.return_value.profile.side_effect = [
                PermissionException("Insufficient permission for that call."),
                TokenException("Incorrect api_key or access_token"),
            ]
            with self.assertRaisesRegex(RuntimeError, "Kite denied this app's access"):
                kite_data.client()


if __name__ == "__main__":
    unittest.main()
