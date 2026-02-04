#!/usr/bin/env python3
import argparse
import random
import sqlite3
import sys
from pathlib import Path

SCRIPT_DIR = Path(__file__).resolve().parent
sys.path.insert(0, str(SCRIPT_DIR))

try:
    from buildVerbForms import build_rows
    from verbecc import CompleteConjugator, LangCodeISO639_1 as Lang
    from verbecc.src.defs.types.data import verbs as verbs_module
except Exception as exc:
    raise SystemExit(
        f"Missing dependencies ({exc}). "
        "Run with the server/scripts/venv python."
    ) from exc

verbs_module.config.ENABLE_ML_PREDICTION = False

REQUIRED_TENSES = [
    "Pres. do ind.",
    "Pretérito perf.",
    "Pretérito imperf.",
    "Pretérito mais-que-perfeito",
    "Fut.",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Verify verb_forms against verbecc.")
    parser.add_argument(
        "--db-path",
        default=str(Path("server/data/book-1.sqlite")),
        help="Path to the SQLite DB.",
    )
    parser.add_argument(
        "--count",
        type=int,
        default=10,
        help="Number of random verbs to check.",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Random seed for deterministic sampling.",
    )
    return parser.parse_args()


def expected_forms(cg: CompleteConjugator, lemma: str) -> dict[str, str]:
    conjugation = cg.conjugate(lemma, conjugate_pronouns=False)
    if not conjugation:
        return {}
    moods = conjugation.get_moods().get_data()
    rows = build_rows(moods)
    return {row["Tense"]: row["Forms"] for row in rows}


def main() -> None:
    args = parse_args()
    db_path = Path(args.db_path)
    if not db_path.exists():
        raise SystemExit(f"Database not found: {db_path}")

    rng = random.Random(args.seed)

    conn = sqlite3.connect(str(db_path))
    cur = conn.cursor()
    cur.execute("SELECT DISTINCT lemma FROM verb_forms")
    lemmas = [row[0] for row in cur.fetchall() if isinstance(row[0], str)]

    cg = CompleteConjugator(lang=Lang.pt)

    eligible: list[str] = []
    for lemma in lemmas:
        expected = expected_forms(cg, lemma)
        if all(tense in expected for tense in REQUIRED_TENSES):
            eligible.append(lemma)

    if len(eligible) < args.count:
        raise SystemExit(
            f"Only {len(eligible)} verbs have all required tenses; "
            f"cannot sample {args.count}."
        )

    sample = rng.sample(eligible, args.count)
    failures: list[str] = []

    for lemma in sample:
        cur.execute(
            "SELECT tense_label, forms FROM verb_forms WHERE lemma = ?",
            (lemma,),
        )
        db_rows = {row[0]: row[1] for row in cur.fetchall()}
        expected = expected_forms(cg, lemma)
        for tense in REQUIRED_TENSES:
            db_form = db_rows.get(tense)
            expected_form = expected.get(tense)
            if expected_form is None:
                failures.append(f"{lemma} missing expected tense: {tense}")
                continue
            if db_form is None:
                failures.append(f"{lemma} missing DB tense: {tense}")
                continue
            if db_form != expected_form:
                failures.append(
                    f"{lemma} {tense} mismatch: db='{db_form}' expected='{expected_form}'"
                )

    conn.close()

    if failures:
        print("Verb forms check failed:")
        for failure in failures:
            print(f"- {failure}")
        raise SystemExit(1)

    print(
        f"Verb forms check passed for {args.count} verbs: "
        f"{', '.join(sample)}"
    )


if __name__ == "__main__":
    main()
