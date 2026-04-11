from __future__ import annotations

import argparse
from pathlib import Path

from app.ml.evaluate import compare_models, print_comparison


def _build_arg_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Train MailFort AI phishing detection models")
    parser.add_argument(
        "--dataset",
        type=Path,
        default=None,
        help="Optional path to processed dataset file (emails.json or dataset.jsonl)",
    )
    parser.add_argument(
        "--skip-bert",
        action="store_true",
        help="Train only logistic regression baseline",
    )
    return parser


def main() -> None:
    args = _build_arg_parser().parse_args()
    metrics = compare_models(dataset_path=args.dataset, train_bert=not args.skip_bert)
    print_comparison(metrics)


if __name__ == "__main__":
    main()
