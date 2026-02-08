import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { resolveDatabaseDir } from "./DatabasePath.js";

export type tokenRecord = {
  id: number;
  sentenceId: string;
  tokenId: string;
  begin: number;
  end: number;
  form: string;
  surface: string;
  lemma: string;
  pos: string;
  tag: string;
  ctag: string;
  mood: string;
  tense: string;
  person: string;
  gen: string;
  num: string;
};

export type verbFormRow = {
  Tense: string;
  Forms: string;
};

export type bookDetails = {
  id: string;
  name: string;
  author: string;
  description: string;
  cover: string;
  content: string;
  language: string;
};

const dbCache = new Map<string, BookDatabase>();

export const resolveBookDbDir = (): string => {
  return resolveDatabaseDir(process.env.BOOK_DB_DIR);
};

export const resolveBookDbPath = (bookId: string): string => {
  return path.resolve(resolveBookDbDir(), `${bookId}.sqlite`);
};

export const getBookDatabase = (bookId: string): BookDatabase => {
  const existing = dbCache.get(bookId);
  if (existing) {
    return existing;
  }

  const dbPath = resolveBookDbPath(bookId);
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Book database not found for ${bookId}.`);
  }

  const instance = new BookDatabase(dbPath);
  dbCache.set(bookId, instance);
  return instance;
};

export const closeBookDatabase = (bookId: string): boolean => {
  const existing = dbCache.get(bookId);
  if (!existing) {
    return false;
  }
  existing.close();
  dbCache.delete(bookId);
  return true;
};

export const closeAllBookDatabases = (): void => {
  for (const database of dbCache.values()) {
    database.close();
  }
  dbCache.clear();
};

export class BookDatabase {
  private db: Database.Database;
  private findTokenBySpanStmt: Database.Statement;
  private findNearestTokenStmt: Database.Statement;
  private findVerbFormsStmt: Database.Statement;
  private listMetaStmt: Database.Statement;
  private getMetaValueStmt: Database.Statement;
  private getContentSliceStmt: Database.Statement;
  private getContentLengthStmt: Database.Statement;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { readonly: false });
    this.db.pragma("journal_mode = WAL");

    this.findTokenBySpanStmt = this.db.prepare(
      `
        SELECT
          id,
          sentence_id as sentenceId,
          token_id as tokenId,
          begin,
          end,
          form,
          surface,
          lemma,
          pos,
          tag,
          ctag,
          mood,
          tense,
          person,
          gen,
          num
        FROM tokens
        WHERE begin <= ? AND end >= ?
        ORDER BY (end - begin) DESC, begin ASC
        LIMIT 1
      `
    );

    this.findNearestTokenStmt = this.db.prepare(
      `
        SELECT
          id,
          sentence_id as sentenceId,
          token_id as tokenId,
          begin,
          end,
          form,
          surface,
          lemma,
          pos,
          tag,
          ctag,
          mood,
          tense,
          person,
          gen,
          num
        FROM tokens
        ORDER BY ABS(begin - ?) + ABS(end - ?) ASC
        LIMIT 1
      `
    );

    this.findVerbFormsStmt = this.db.prepare(
      `
        SELECT tense_label as Tense, forms as Forms, is_irregular as isIrregular
        FROM verb_forms
        WHERE lemma = ?
      `
    );

    this.listMetaStmt = this.db.prepare(
      `
        SELECT key, value
        FROM meta
      `
    );

    this.getMetaValueStmt = this.db.prepare(
      `
        SELECT value
        FROM meta
        WHERE key = ?
        LIMIT 1
      `
    );

    this.getContentSliceStmt = this.db.prepare(
      `
        SELECT substr(value, ?, ?) as slice
        FROM meta
        WHERE key = 'content'
        LIMIT 1
      `
    );

    this.getContentLengthStmt = this.db.prepare(
      `
        SELECT length(value) as length
        FROM meta
        WHERE key = 'content'
        LIMIT 1
      `
    );
  }

  findTokenBySpan(start: number, end: number): tokenRecord | null {
    const row = this.findTokenBySpanStmt.get(start, end) as tokenRecord | undefined;
    if (row) {
      return row;
    }

    const fallback = this.findNearestTokenStmt.get(start, end) as tokenRecord | undefined;
    return fallback ?? null;
  }

  getVerbForms(lemma: string): { rows: verbFormRow[]; isIrregular: boolean } {
    const rows = this.findVerbFormsStmt.all(lemma) as Array<verbFormRow & { isIrregular: number }>;
    if (rows.length === 0) {
      return { rows: [], isIrregular: false };
    }

    const isIrregular = rows.some((row) => row.isIrregular === 1);
    const normalizedRows: verbFormRow[] = rows.map((row) => ({
      Tense: row.Tense,
      Forms: row.Forms
    }));

    const order = new Map<string, number>([
      ["Pres. do ind.", 0],
      ["Pretérito perf.", 1],
      ["Pretérito imperf.", 2],
      ["Pretérito mais-que-perfeito", 3],
      ["Fut.", 4],
      ["Part. pass.", 5],
      ["Imperativo", 6]
    ]);
    normalizedRows.sort((a, b) => (order.get(a.Tense) ?? 99) - (order.get(b.Tense) ?? 99));

    return { rows: normalizedRows, isIrregular };
  }

  getBookDetails(): bookDetails {
    const rows = this.listMetaStmt.all() as Array<{ key: string; value: string }>;
    const meta = new Map<string, string>();
    rows.forEach((row) => {
      meta.set(row.key, row.value);
    });

    return {
      id: meta.get("book_id") ?? "",
      name: meta.get("name") ?? "",
      author: meta.get("author") ?? "",
      description: meta.get("description") ?? "",
      cover: meta.get("cover") ?? "",
      content: meta.get("content") ?? "",
      language: meta.get("language") ?? "pt-PT"
    };
  }

  getMetaValue(key: string): string | null {
    const row = this.getMetaValueStmt.get(key) as { value?: string } | undefined;
    return row?.value ?? null;
  }

  getContentLength(): number {
    const row = this.getContentLengthStmt.get() as { length?: number } | undefined;
    const lengthValue = row?.length ?? 0;
    return Number.isFinite(lengthValue) ? lengthValue : 0;
  }

  getContentSlice(offset: number, length: number): string {
    const safeOffset = Math.max(0, offset);
    const safeLength = Math.max(0, length);
    const row = this.getContentSliceStmt.get(safeOffset + 1, safeLength) as { slice?: string } | undefined;
    return row?.slice ?? "";
  }

  close(): void {
    this.db.close();
  }
}

export const hashContext = (value: string): string => {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
};
