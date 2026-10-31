"""Keep release archives limited to app code and built assets."""

from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

from scripts.package_release import REQUIRED, release_files


class PackageTests(unittest.TestCase):
    def test_release_excludes_credentials_runtime_data_and_tests(self):
        with TemporaryDirectory() as directory:
            root = Path(directory)
            for name in REQUIRED + ("backend/catalog.py", "dist/assets/app.js"):
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("placeholder", encoding="utf-8")
            for name in (".env", "backend/.env", "data/oi_snapshots.sqlite3", "tests/test_api.py"):
                path = root / name
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text("private", encoding="utf-8")

            names = {path.relative_to(root).as_posix() for path in release_files(root)}
            self.assertIn("backend/catalog.py", names)
            self.assertIn("dist/assets/app.js", names)
            self.assertNotIn(".env", names)
            self.assertNotIn("backend/.env", names)
            self.assertNotIn("data/oi_snapshots.sqlite3", names)
            self.assertNotIn("tests/test_api.py", names)


if __name__ == "__main__":
    unittest.main()
