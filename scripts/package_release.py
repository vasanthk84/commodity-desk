"""Package built UI, API and deployment assets without local credentials or data."""

import argparse
from pathlib import Path
import tarfile


ROOT = Path(__file__).resolve().parents[1]
REQUIRED = (
    "backend/app.py",
    "requirements.txt",
    "deploy/requirements-deploy.txt",
    "deploy/commodity-desk.service",
    "deploy/nginx-commodity-desk-api.conf",
    "deploy/nginx-commodity-desk-ui.conf",
    "dist/index.html",
)


def release_files(root):
    root = Path(root)
    files = {root / name for name in REQUIRED}
    for path in files:
        if not path.is_file():
            raise FileNotFoundError(path.relative_to(root))
    files.update((root / "backend").glob("*.py"))
    files.update(path for path in (root / "dist").rglob("*") if path.is_file())
    for path in files:
        if path.is_symlink() or not path.resolve().is_relative_to(root.resolve()):
            raise ValueError(f"Release file escapes the project: {path}")
    return sorted(files)


def package_release(output, root=ROOT):
    root = Path(root)
    files = release_files(root)
    with tarfile.open(output, "w:gz") as archive:
        for path in files:
            archive.add(path, arcname=path.relative_to(root).as_posix(), recursive=False)
    return len(files)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    print(f"Packaged {package_release(args.output)} release files into {args.output}")
