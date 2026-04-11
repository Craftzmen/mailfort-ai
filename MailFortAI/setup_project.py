from __future__ import annotations

from pathlib import Path


DIRECTORIES = [
    "data/raw/enron",
    "data/raw/phishing",
    "data/cache",
    "data/processed",
    "app/threat_intel",
    "app/pipeline",
    "preprocessing",
    "models",
    "utils",
    "tests",
    "reports",
]


def create_project_structure(project_root: Path) -> None:
    for relative_dir in DIRECTORIES:
        (project_root / relative_dir).mkdir(parents=True, exist_ok=True)


if __name__ == "__main__":
    root = Path(__file__).resolve().parent
    create_project_structure(root)
    print("MailFort AI folder structure initialized.")
