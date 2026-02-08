#!/usr/bin/env python3
import argparse
import os
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(
        description="Rebuild dict/pt/wiktionary-articles.json from the Kaikki source."
    )
    parser.add_argument(
        "--source-jsonl",
        default="scripts/kaikki.org-dictionary-Portuguese.jsonl",
        help="Path to the Kaikki Portuguese JSONL file.",
    )
    parser.add_argument(
        "--intermediate",
        default="scripts/wiktionary-articles.json",
        help="Intermediate English-only JSON output.",
    )
    parser.add_argument(
        "--output",
        default="dict/pt/wiktionary-articles.json",
        help="Final JSON output with Russian translations.",
    )
    parser.add_argument(
        "--url",
        default=None,
        help="Translation service URL (passed to translateWiktionaryArticles.py).",
    )
    args = parser.parse_args()

    os.makedirs(os.path.dirname(args.intermediate), exist_ok=True)
    os.makedirs(os.path.dirname(args.output), exist_ok=True)

    build_cmd = [
        sys.executable,
        "scripts/buildWiktionaryArticles.py",
        args.source_jsonl,
        args.intermediate,
    ]
    translate_cmd = [
        sys.executable,
        "scripts/translateWiktionaryArticles.py",
        "--input",
        args.intermediate,
        "--output",
        args.output,
    ]
    if args.url:
        translate_cmd.extend(["--url", args.url])

    subprocess.check_call(build_cmd)
    subprocess.check_call(translate_cmd)


if __name__ == "__main__":
    sys.exit(main())
