"""MailFort AI — Entry point.

Usage:
    # Start the API server
    uvicorn app:app --port 8000 --reload

    # Or run the preprocessing pipeline
    python main.py --run-phase1 [--download-enron]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

# Ensure the project root is on sys.path so `preprocessing` can be found
PROJECT_ROOT = Path(__file__).resolve().parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="MailFort AI runner")
    parser.add_argument(
        "--run-phase1",
        action="store_true",
        help="Run dataset collection and preprocessing pipeline",
    )
    parser.add_argument(
        "--download-enron",
        action="store_true",
        help="Download and extract Enron email dataset",
    )
    return parser


def main() -> None:
    args = _build_arg_parser().parse_args()

    if args.run_phase1:
        from preprocessing.preprocess_pipeline import run_phase1

        summary = run_phase1(
            project_root=PROJECT_ROOT,
            download_enron=args.download_enron,
        )
        print(summary)
    else:
        print("MailFort AI v1.0.0")
        print("  Start server  :  uvicorn app:app --port 8000 --reload")
        print("  Preprocess    :  python main.py --run-phase1")


if __name__ == "__main__":
    main()
