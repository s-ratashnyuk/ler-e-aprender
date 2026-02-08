import fs from "node:fs";
import Database from "better-sqlite3";
import { resolveDatabaseFile } from "./DatabasePath.js";

export type wiktionaryExample = {
  text: string;
  english: string;
  russian: string;
  translation?: string;
};

export type wiktionaryTranslation = {
  glosses: {
    english: string;
    russian: string;
  };
  examples: wiktionaryExample[];
};

export type wiktionaryArticle = {
  word: string;
  pos: string;
  translations: wiktionaryTranslation[];
  source: string;
  updatedAt: number;
};

const DEFAULT_DB_FILE = "wiktionary-articles.sqlite";
const dbCache = new Map<string, WiktionaryArticlesDatabase>();

export const resolveWiktionaryArticlesDbPath = (): string => {
  return resolveDatabaseFile(DEFAULT_DB_FILE, {
    overridePath: process.env.WIKTIONARY_DB_PATH,
    overrideDir: process.env.WIKTIONARY_DB_DIR
  });
};

export const getWiktionaryArticlesDatabase = (): WiktionaryArticlesDatabase | null => {
  const dbPath = resolveWiktionaryArticlesDbPath();
  const cached = dbCache.get(dbPath);
  if (cached) {
    return cached;
  }

  if (!fs.existsSync(dbPath)) {
    return null;
  }

  const instance = new WiktionaryArticlesDatabase(dbPath);
  dbCache.set(dbPath, instance);
  return instance;
};

export const closeWiktionaryArticlesDatabase = (): void => {
  for (const database of dbCache.values()) {
    database.close();
  }
  dbCache.clear();
};

export class WiktionaryArticlesDatabase {
  private db: Database.Database;
  private findByKeyStmt: Database.Statement;
  private upsertArticleStmt: Database.Statement;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { readonly: false });
    this.db.pragma("journal_mode = WAL");
    this.ensureSchema();

    this.findByKeyStmt = this.db.prepare(
      `
        SELECT
          key,
          word,
          pos,
          translations_json as translationsJson,
          source,
          updated_at as updatedAt
        FROM wiktionary_articles
        WHERE key = ?
        LIMIT 1
      `
    );

    this.upsertArticleStmt = this.db.prepare(
      `
        INSERT INTO wiktionary_articles (
          key,
          word,
          pos,
          translations_json,
          source,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(key)
        DO UPDATE SET
          word = excluded.word,
          pos = excluded.pos,
          translations_json = excluded.translations_json,
          source = excluded.source,
          updated_at = excluded.updated_at
      `
    );
  }

  private ensureSchema(): void {
    this.db.exec(
      `
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
      `
    );
  }

  findByKey(key: string): wiktionaryArticle | null {
    const row = this.findByKeyStmt.get(key) as
      | {
          key: string;
          word: string;
          pos: string;
          translationsJson: string;
          source: string;
          updatedAt: number;
        }
      | undefined;
    if (!row) {
      return null;
    }

    let translations: wiktionaryTranslation[] = [];
    try {
      const parsed = JSON.parse(row.translationsJson) as wiktionaryTranslation[];
      if (Array.isArray(parsed)) {
        translations = parsed;
      }
    } catch {
      translations = [];
    }

    return {
      word: row.word,
      pos: row.pos,
      translations,
      source: row.source,
      updatedAt: row.updatedAt
    };
  }

  upsertArticle(entry: {
    key: string;
    word: string;
    pos: string;
    translations: wiktionaryTranslation[];
    source: string;
    updatedAt: number;
  }): void {
    this.upsertArticleStmt.run(
      entry.key,
      entry.word,
      entry.pos,
      JSON.stringify(entry.translations),
      entry.source,
      entry.updatedAt
    );
  }

  close(): void {
    this.db.close();
  }
}
