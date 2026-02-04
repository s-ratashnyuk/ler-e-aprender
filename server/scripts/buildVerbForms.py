#!/usr/bin/env python3
import argparse
import json
import site
import sys
from pathlib import Path
from typing import Any, Dict, List

site.addusersitepackages(sys.path)

try:
    import verbecc
    from verbecc import CompleteConjugator, LangCodeISO639_1 as Lang
    from verbecc.src.defs.types.data import verbs as verbs_module

    verbs_module.config.ENABLE_ML_PREDICTION = False
    _LANG = Lang.pt
except Exception as exc:
    raise SystemExit(
        f"verbecc is required and failed to import ({exc}). "
        "Install with: pip install verbecc"
    ) from exc


def read_json_objects(content: str) -> List[Dict[str, Any]]:
    decoder = json.JSONDecoder()
    idx = 0
    objects: List[Dict[str, Any]] = []
    while idx < len(content):
        while idx < len(content) and content[idx].isspace():
            idx += 1
        if idx >= len(content):
            break
        obj, next_idx = decoder.raw_decode(content, idx)
        objects.append(obj)
        idx = next_idx
    return objects


PRONOUN_INDEX = {
    "eu": 0,
    "tu": 1,
    "ele": 2,
    "ela": 2,
    "você": 2,
    "nós": 3,
    "eles": 4,
    "elas": 4,
    "vocês": 4,
    "vós": None,
}

PRONOUN_INDEX_IMPERATIVE = {
    "tu": 0,
    "ele": 1,
    "ela": 1,
    "você": 1,
    "nós": 2,
    "eles": 3,
    "elas": 3,
    "vocês": 3,
    "vós": None,
    "eu": None,
}

IRREGULAR_VERBS_PATH = Path(__file__).with_name("irregular_verbs.txt")


def load_irregular_lemmas(path: Path = IRREGULAR_VERBS_PATH) -> set[str]:
    try:
        content = path.read_text(encoding="utf-8")
    except FileNotFoundError as exc:
        raise SystemExit(f"Missing irregular verbs list: {path}") from exc

    irregular = set()
    for line in content.splitlines():
        lemma = line.strip()
        if not lemma or lemma.startswith("#"):
            continue
        irregular.add(lemma.casefold())
    return irregular


def normalize_conjugation_form(value: str) -> str:
    cleaned = value.strip()
    if not cleaned:
        return cleaned
    if cleaned.startswith("por "):
        cleaned = cleaned[4:]
    parts = cleaned.split()
    if parts and parts[-1].casefold() in PRONOUN_INDEX:
        parts = parts[:-1]
    return " ".join(parts).strip()


def find_key(mapping: Dict[Any, Any], desired: str) -> Any:
    for key in mapping.keys():
        value = getattr(key, "value", None)
        if value == desired or key == desired or str(key) == desired:
            return key
    return None


def build_forms(
    moods: Dict[Any, Any],
    mood_key: str,
    tense_key: str,
    skip_eu: bool = False,
) -> str:
    mood_enum = find_key(moods, mood_key)
    if mood_enum is None:
        return ""
    mood = moods.get(mood_enum, {})
    tense_enum = find_key(mood, tense_key) if isinstance(mood, dict) else None
    entries = mood.get(tense_enum, []) if isinstance(mood, dict) and tense_enum else []
    forms: List[str] = ["", "", "", ""] if skip_eu else ["", "", "", "", ""]
    index_map = PRONOUN_INDEX_IMPERATIVE if skip_eu else PRONOUN_INDEX
    for entry in entries:
        if not isinstance(entry, dict):
            continue
        pronoun = entry.get("pr")
        if hasattr(pronoun, "value"):
            pronoun = pronoun.value
        index = index_map.get(pronoun)
        if index is None:
            continue
        conjugations = entry.get("c")
        if not isinstance(conjugations, list) or not conjugations:
            continue
        value = conjugations[0]
        if not isinstance(value, str):
            continue
        value = normalize_conjugation_form(value)
        if value and not forms[index]:
            forms[index] = value

    if not all(forms):
        return ""
    return ", ".join(forms)


def build_rows(moods: Dict[str, Any]) -> List[Dict[str, str]]:
    rows: List[Dict[str, str]] = []

    present = build_forms(moods, "indicativo", "presente")
    if present:
        rows.append({"Tense": "Pres. do ind.", "Forms": present})

    preterite = build_forms(moods, "indicativo", "pretérito-perfeito")
    if preterite:
        rows.append({"Tense": "Pretérito perf.", "Forms": preterite})

    imperfect = build_forms(moods, "indicativo", "pretérito-imperfeito")
    if imperfect:
        rows.append({"Tense": "Pretérito imperf.", "Forms": imperfect})

    future = build_forms(moods, "indicativo", "futuro-do-presente")
    if future:
        rows.append({"Tense": "Fut.", "Forms": future})

    part_mood_key = find_key(moods, "particípio")
    participle_entries = []
    if part_mood_key is not None:
        part_mood = moods.get(part_mood_key, {})
        part_tense_key = find_key(part_mood, "particípio") if isinstance(part_mood, dict) else None
        if part_tense_key is not None:
            participle_entries = part_mood.get(part_tense_key, [])
    if participle_entries:
        first = participle_entries[0]
        if isinstance(first, dict) and isinstance(first.get("c"), list) and first["c"]:
            value = first["c"][0]
            if isinstance(value, str):
                rows.append({"Tense": "Part. pass.", "Forms": value})

    imperative = build_forms(moods, "imperativo", "afirmativo", skip_eu=True)
    if imperative:
        rows.append({"Tense": "Imperativo", "Forms": imperative})

    return rows


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--tagged-file", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    with open(args.tagged_file, "r", encoding="utf-8") as handle:
        content = handle.read()

    objects = read_json_objects(content)
    irregular_lemmas = load_irregular_lemmas()
    lemmas = set()
    for obj in objects:
        for sentence in obj.get("sentences", []):
            for token in sentence.get("tokens", []):
                if token.get("pos") != "verb":
                    continue
                lemma = token.get("lemma")
                if isinstance(lemma, str):
                    lemmas.add(lemma)

    cg = CompleteConjugator(lang=_LANG)
    results: List[Dict[str, Any]] = []
    for lemma in sorted(lemmas):
        try:
            conjugation = cg.conjugate(lemma, conjugate_pronouns=False)
        except Exception:
            continue
        if not conjugation:
            continue
        moods = conjugation.get_moods().get_data()
        rows = build_rows(moods)
        if not rows:
            continue
        is_irregular = lemma.casefold() in irregular_lemmas
        results.append(
            {
                "lemma": lemma,
                "isIrregular": is_irregular,
                "rows": rows,
            }
        )

    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(results, handle, ensure_ascii=False, indent=2)


if __name__ == "__main__":
    main()
