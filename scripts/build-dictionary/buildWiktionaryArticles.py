#!/usr/bin/env python3
import json
import os
import sys


def build_entries(src_path: str):
    entries = {}
    with open(src_path, "r", encoding="utf-8") as src:
        for line_no, line in enumerate(src, 1):
            line = line.strip()
            if not line:
                continue
            try:
                data = json.loads(line)
            except json.JSONDecodeError:
                continue

            word = data.get("word")
            pos = data.get("pos")
            if not word or not pos:
                continue

            key = f"{word}-{pos}"
            entry = entries.get(key)
            if entry is None:
                entry = {"word": word, "pos": pos, "translations": []}
                entries[key] = entry

            senses = data.get("senses") or []
            for sense in senses:
                gloss_list = sense.get("glosses") or sense.get("raw_glosses") or []
                gloss_joined = " ".join(g for g in gloss_list if g)
                glosses = {"english": gloss_joined} if gloss_joined else None
                examples_out = []
                for ex in sense.get("examples") or []:
                    examples_out.append(
                        {
                            "english": ex.get("english") or ex.get("translation") or "",
                            "text": ex.get("text") or "",
                            "translation": ex.get("translation") or ex.get("english") or "",
                        }
                    )

                if not glosses and not examples_out:
                    continue

                entry["translations"].append(
                    {
                        "glosses": glosses,
                        "examples": examples_out,
                    }
                )

    return entries


def main():
    src_path = sys.argv[1] if len(sys.argv) > 1 else "scripts/kaikki.org-dictionary-Portuguese.jsonl"
    dst_path = sys.argv[2] if len(sys.argv) > 2 else "scripts/wiktionary-articles.json"

    entries = build_entries(src_path)
    os.makedirs(os.path.dirname(dst_path), exist_ok=True)
    with open(dst_path, "w", encoding="utf-8") as dst:
        json.dump(entries, dst, ensure_ascii=False, indent=2)
        dst.write("\n")

    print(f"Wrote {len(entries)} entries to {dst_path}")


if __name__ == "__main__":
    sys.exit(main())
