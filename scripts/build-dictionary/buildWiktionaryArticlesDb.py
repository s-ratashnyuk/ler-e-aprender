#!/usr/bin/env python3
import json
import os
import sqlite3
import sys
import time


def load_entries(src_path: str):
    with open(src_path, "r", encoding="utf-8") as src:
        return json.load(src)


def create_schema(conn: sqlite3.Connection):
    conn.executescript(
        """
        PRAGMA journal_mode = WAL;
        CREATE TABLE IF NOT EXISTS wiktionary_articles (
          key TEXT PRIMARY KEY,
          word TEXT NOT NULL,
          pos TEXT NOT NULL,
          translations_json TEXT NOT NULL,
          source TEXT NOT NULL DEFAULT 'wiktionary',
          updated_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_wiktionary_articles_word_pos
        ON wiktionary_articles (word, pos);
        """
    )


def insert_entries(conn: sqlite3.Connection, entries: dict):
    now_ms = int(time.time() * 1000)
    insert_sql = """
        INSERT INTO wiktionary_articles (
          key,
          word,
          pos,
          translations_json,
          source,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
    """
    batch = []
    cursor = conn.cursor()
    for key, entry in entries.items():
        word = entry.get("word") or ""
        pos = entry.get("pos") or ""
        translations = entry.get("translations") or []
        batch.append((key, word, pos, json.dumps(translations, ensure_ascii=False), "wiktionary", now_ms))
        if len(batch) >= 5000:
            cursor.executemany(insert_sql, batch)
            batch.clear()
    if batch:
        cursor.executemany(insert_sql, batch)


def main():
    src_path = sys.argv[1] if len(sys.argv) > 1 else "dict/pt/wiktionary-articles.json"
    dst_path = sys.argv[2] if len(sys.argv) > 2 else "db/wiktionary-articles.sqlite"

    entries = load_entries(src_path)
    os.makedirs(os.path.dirname(dst_path), exist_ok=True)

    if os.path.exists(dst_path):
        os.remove(dst_path)

    conn = sqlite3.connect(dst_path)
    try:
        create_schema(conn)
        with conn:
            insert_entries(conn, entries)
    finally:
        conn.close()

    print(f"Wrote {len(entries)} entries to {dst_path}")


if __name__ == "__main__":
    sys.exit(main())
