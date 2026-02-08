#!/usr/bin/env python3
import argparse
import json
import os
import time
import urllib.error
import urllib.request

try:
    import ijson as _ijson  # type: ignore
except Exception:
    _ijson = None


DEFAULT_URL = "http://192.168.137.3:8000/translate"
DEFAULT_INPUT = "scripts/wiktionary-articles.json"
DEFAULT_OUTPUT = "scripts/wiktionary-articles-ru.json"
DEFAULT_CACHE = "scripts/wiktionary-translate-cache.json"
DEFAULT_PROGRESS = "scripts/wiktionary-translate-progress.json"
MORPH_TERMS = {
    "first-person",
    "second-person",
    "third-person",
    "person",
    "singular",
    "plural",
    "present",
    "past",
    "future",
    "preterite",
    "imperfect",
    "imperative",
    "subjunctive",
    "indicative",
    "conditional",
    "participle",
    "gerund",
    "infinitive",
}


def load_cache(path):
    if not path or not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {}


def save_cache(path, cache):
    if not path:
        return
    tmp_path = path + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp_path, path)


def load_progress(path):
    if not path or not os.path.exists(path):
        return {"entries": 0, "sentences": 0}
    with open(path, "r", encoding="utf-8") as f:
        try:
            data = json.load(f)
        except json.JSONDecodeError:
            return {"entries": 0, "sentences": 0}
    entries = int(data.get("entries", 0) or 0)
    sentences = int(data.get("sentences", 0) or 0)
    return {"entries": max(entries, 0), "sentences": max(sentences, 0)}


def save_progress(path, entries_done, sentences_done):
    if not path:
        return
    tmp_path = path + ".tmp"
    with open(tmp_path, "w", encoding="utf-8") as f:
        json.dump(
            {"entries": entries_done, "sentences": sentences_done},
            f,
            ensure_ascii=False,
            indent=2,
        )
        f.write("\n")
    os.replace(tmp_path, path)


def extract_translation(payload):
    if isinstance(payload, dict):
        for key in (
            "translation",
            "translated_text",
            "TranslatedText",
            "Translation",
            "text",
            "Text",
        ):
            value = payload.get(key)
            if isinstance(value, str):
                return value
        if len(payload) == 1:
            value = next(iter(payload.values()))
            if isinstance(value, str):
                return value
    if isinstance(payload, str):
        return payload
    return None


def translate_text(text, url, cache, timeout, max_retries, sleep_s):
    if not text:
        return text
    if text in cache:
        return cache[text]

    payload = {
        "Text": text,
        "SourceLanguage": "eng_Latn",
        "TargetLanguage": "rus_Cyrl",
    }
    data = json.dumps(payload).encode("utf-8")

    last_error = None
    for attempt in range(max_retries):
        try:
            req = urllib.request.Request(
                url,
                data=data,
                headers={"Content-Type": "application/json"},
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                raw = resp.read()
            try:
                payload = json.loads(raw.decode("utf-8"))
            except json.JSONDecodeError:
                payload = raw.decode("utf-8", errors="replace")
            translated = extract_translation(payload)
            if translated is None:
                translated = text
            cache[text] = translated
            if sleep_s > 0:
                time.sleep(sleep_s)
            return translated
        except (urllib.error.URLError, TimeoutError, ValueError) as exc:
            last_error = exc
            time.sleep(min(2 ** attempt, 5))

    if last_error:
        raise last_error
    return text


def is_inflection_gloss(gloss_text):
    if not gloss_text:
        return False
    gloss_lower = gloss_text.lower()
    if "inflection of " in gloss_lower:
        return True
    if " of " not in gloss_lower:
        return False
    return any(term in gloss_lower for term in MORPH_TERMS)


def trim_output_for_resume(path):
    if not os.path.exists(path):
        return False
    with open(path, "rb+") as f:
        f.seek(0, os.SEEK_END)
        size = f.tell()
        if size == 0:
            return False

        def last_non_ws():
            i = size - 1
            while i >= 0:
                f.seek(i)
                ch = f.read(1)
                if ch not in b" \n\r\t":
                    return i, ch
                i -= 1
            return -1, None

        pos, ch = last_non_ws()
        if pos < 0:
            f.truncate(0)
            return False
        if ch == b"}":
            f.truncate(pos)
            size = pos
            if size <= 0:
                return False
            i = size - 1
            while i >= 0:
                f.seek(i)
                ch = f.read(1)
                if ch not in b" \n\r\t":
                    return ch != b"{"
                i -= 1
            return False
        return ch != b"{"


def translate_entry(entry, url, cache, timeout, max_retries, sleep_s):
    translations = entry.get("translations") or []
    is_verb = entry.get("pos") == "verb"
    for tr in translations:
        glosses = tr.get("glosses")
        if is_verb and isinstance(glosses, dict) and is_inflection_gloss(glosses.get("english", "")):
            continue
        if isinstance(glosses, dict) and "english" in glosses:
            glosses["russian"] = translate_text(
                glosses.get("english", ""),
                url,
                cache,
                timeout,
                max_retries,
                sleep_s,
            )
        examples = tr.get("examples") or []
        for ex in examples:
            if "english" in ex:
                ex["russian"] = translate_text(
                    ex.get("english", ""),
                    url,
                    cache,
                    timeout,
                    max_retries,
                    sleep_s,
                )


def count_entry_sentences(entry):
    total = 0
    translations = entry.get("translations") or []
    is_verb = entry.get("pos") == "verb"
    for tr in translations:
        glosses = tr.get("glosses")
        if is_verb and isinstance(glosses, dict) and is_inflection_gloss(glosses.get("english", "")):
            continue
        if isinstance(glosses, dict) and glosses.get("english"):
            total += 1
        examples = tr.get("examples") or []
        for ex in examples:
            if ex.get("english"):
                total += 1
    return total


def iter_entries(input_path, data=None):
    if data is not None:
        for key, value in data.items():
            yield key, value
        return

    if _ijson is None:
        with open(input_path, "r", encoding="utf-8") as f:
            data = json.load(f)
        for key, value in data.items():
            yield key, value
        return

    with open(input_path, "r", encoding="utf-8") as f:
        for key, value in _ijson.kvitems(f, ""):
            yield key, value


def count_total_sentences(input_path, data=None):
    total = 0
    for _, entry in iter_entries(input_path, data=data):
        total += count_entry_sentences(entry)
    return total


def main():
    parser = argparse.ArgumentParser(
        description="Translate all english fields in wiktionary-articles.json to Russian."
    )
    parser.add_argument("--input", default=DEFAULT_INPUT)
    parser.add_argument("--output", default=DEFAULT_OUTPUT)
    parser.add_argument("--cache", default=DEFAULT_CACHE)
    parser.add_argument("--progress-file", default=DEFAULT_PROGRESS)
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--timeout", type=float, default=30.0)
    parser.add_argument("--retries", type=int, default=3)
    parser.add_argument("--sleep", type=float, default=0.0)
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--flush-every", type=int, default=500)
    parser.add_argument("--progress-every", type=int, default=1000)
    parser.add_argument("--no-count", action="store_true")
    parser.add_argument("--count-only", action="store_true")
    parser.add_argument("--resume", action="store_true")
    parser.add_argument("--skip-entries", type=int, default=0)
    args = parser.parse_args()

    cache = load_cache(args.cache)
    progress = load_progress(args.progress_file) if args.resume else {"entries": 0, "sentences": 0}
    entries_done = progress.get("entries", 0)
    sentences_done = progress.get("sentences", 0)
    skip_entries = args.skip_entries if args.skip_entries > 0 else (entries_done if args.resume else 0)
    if args.skip_entries > 0 and args.resume:
        sentences_done = 0

    data = None
    if _ijson is None:
        with open(args.input, "r", encoding="utf-8") as f:
            data = json.load(f)

    if args.count_only:
        total_sentences = count_total_sentences(args.input, data=data)
        if args.resume and sentences_done:
            remaining = max(total_sentences - sentences_done, 0)
            print(f"Total sentences to translate: {total_sentences} (remaining: {remaining})")
        else:
            print(f"Total sentences to translate: {total_sentences}")
        return
    if not args.no_count:
        total_sentences = count_total_sentences(args.input, data=data)
        if args.resume and sentences_done:
            remaining = max(total_sentences - sentences_done, 0)
            print(f"Total sentences to translate: {total_sentences} (remaining: {remaining})")
        else:
            print(f"Total sentences to translate: {total_sentences}")

    processed_run = 0
    processed_total = skip_entries
    processed_sentences = sentences_done
    start_ts = time.time()
    if args.resume and skip_entries > 0:
        has_entries = trim_output_for_resume(args.output)
        if not os.path.exists(args.output):
            print(f"Resume requested but {args.output} not found; starting new output.")
            has_entries = False
        out = open(args.output, "a", encoding="utf-8")
        if not os.path.exists(args.output) or os.path.getsize(args.output) == 0:
            out.write("{\n")
            has_entries = False
        first = not has_entries
    else:
        out = open(args.output, "w", encoding="utf-8")
        out.write("{\n")
        first = True
    with out:
        for idx, (key, entry) in enumerate(iter_entries(args.input, data=data), start=1):
            if skip_entries and idx <= skip_entries:
                continue
            sentences_in_entry = count_entry_sentences(entry)
            translate_entry(
                entry,
                args.url,
                cache,
                args.timeout,
                args.retries,
                args.sleep,
            )
            if not first:
                out.write(",\n")
            out.write(json.dumps(key, ensure_ascii=False))
            out.write(": ")
            out.write(json.dumps(entry, ensure_ascii=False))
            first = False

            processed_run += 1
            processed_total += 1
            processed_sentences += sentences_in_entry
            if args.flush_every > 0 and processed_total % args.flush_every == 0:
                save_cache(args.cache, cache)
                save_progress(args.progress_file, processed_total, processed_sentences)
                out.flush()
            if args.progress_every > 0 and processed_total % args.progress_every == 0:
                elapsed = max(time.time() - start_ts, 0.001)
                rate = processed_run / elapsed
                print(
                    f"Processed {processed_total} entries ({rate:.1f}/s)",
                    flush=True,
                )
            if args.limit and processed_run >= args.limit:
                break
        out.write("\n}\n")

    save_cache(args.cache, cache)
    save_progress(args.progress_file, processed_total, processed_sentences)
    print(f"Wrote {processed_run} entries to {args.output} (total {processed_total})")


if __name__ == "__main__":
    main()
