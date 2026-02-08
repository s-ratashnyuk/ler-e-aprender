import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { resolveDatabaseDir } from "./DatabasePath.js";

export type sentenceTranslationRecord = {
  sentenceIndex: number;
  rawStart: number;
  rawEnd: number;
  start: number;
  end: number;
  text: string;
  hash: string;
  translation: string;
};

const dbCache = new Map<string, SentenceTranslationsDatabase>();

export const resolveSentenceTranslationsDbPath = (bookId: string): string => {
  const dbDir = resolveDatabaseDir(process.env.BOOK_DB_DIR);
  return path.resolve(dbDir, `${bookId}.sentences.sqlite`);
};

export const getSentenceTranslationsDatabase = (
  bookId: string
): SentenceTranslationsDatabase | null => {
  const existing = dbCache.get(bookId);
  if (existing) {
    return existing;
  }

  const dbPath = resolveSentenceTranslationsDbPath(bookId);
  if (!fs.existsSync(dbPath)) {
    return null;
  }

  const instance = new SentenceTranslationsDatabase(dbPath);
  dbCache.set(bookId, instance);
  return instance;
};

export const closeSentenceTranslationsDatabase = (bookId: string): boolean => {
  const existing = dbCache.get(bookId);
  if (!existing) {
    return false;
  }
  existing.close();
  dbCache.delete(bookId);
  return true;
};

export const closeAllSentenceTranslationsDatabases = (): void => {
  for (const database of dbCache.values()) {
    database.close();
  }
  dbCache.clear();
};

export const hashSentenceText = (value: string): string => {
  return crypto.createHash("sha1").update(value, "utf8").digest("hex");
};

export class SentenceTranslationsDatabase {
  private db: Database.Database;
  private findBySpanStmt: Database.Statement;
  private findByHashStmt: Database.Statement;
  private findByTextStmt: Database.Statement;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { readonly: true });
    this.db.pragma("journal_mode = WAL");

    this.findBySpanStmt = this.db.prepare(
      `
        SELECT
          sentence_index as sentenceIndex,
          raw_start as rawStart,
          raw_end as rawEnd,
          start,
          end,
          text,
          hash,
          translation
        FROM sentences
        WHERE start <= ? AND end >= ?
        ORDER BY (end - start) ASC
        LIMIT 1
      `
    );

    this.findByHashStmt = this.db.prepare(
      `
        SELECT
          sentence_index as sentenceIndex,
          raw_start as rawStart,
          raw_end as rawEnd,
          start,
          end,
          text,
          hash,
          translation
        FROM sentences
        WHERE hash = ?
        LIMIT 1
      `
    );

    this.findByTextStmt = this.db.prepare(
      `
        SELECT
          sentence_index as sentenceIndex,
          raw_start as rawStart,
          raw_end as rawEnd,
          start,
          end,
          text,
          hash,
          translation
        FROM sentences
        WHERE text = ?
        LIMIT 1
      `
    );
  }

  findBySpan(start: number, end: number): sentenceTranslationRecord | null {
    const row = this.findBySpanStmt.get(start, end) as sentenceTranslationRecord | undefined;
    return row ?? null;
  }

  findByHash(hash: string): sentenceTranslationRecord | null {
    const row = this.findByHashStmt.get(hash) as sentenceTranslationRecord | undefined;
    return row ?? null;
  }

  findByText(text: string): sentenceTranslationRecord | null {
    const row = this.findByTextStmt.get(text) as sentenceTranslationRecord | undefined;
    return row ?? null;
  }

  close(): void {
    this.db.close();
  }
}
