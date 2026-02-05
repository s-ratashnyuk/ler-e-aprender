import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";

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

export type cachedTranslation = {
  wordTranslation: string;
  usageExamplesJson: string;
};

const resolveDefaultDbDir = (): string => {
  const cwd = process.cwd();
  const base = path.basename(cwd);
  if (base === "server") {
    return path.resolve(cwd, "..", "..", "db");
  }
  if (base === "app") {
    return path.resolve(cwd, "..", "db");
  }
  return path.resolve(cwd, "db");
};

const dbCache = new Map<string, BookDatabase>();

export const getBookDatabase = (bookId: string): BookDatabase => {
  const existing = dbCache.get(bookId);
  if (existing) {
    return existing;
  }

  const dbDir = process.env.BOOK_DB_DIR ?? resolveDefaultDbDir();
  const dbPath = path.resolve(dbDir, `${bookId}.sqlite`);
  if (!fs.existsSync(dbPath)) {
    throw new Error(`Book database not found for ${bookId}. Expected: ${dbPath}`);
  }

  const instance = new BookDatabase(dbPath);
  dbCache.set(bookId, instance);
  return instance;
};

export class BookDatabase {
  private db: Database.Database;
  private findTokenBySpanStmt: Database.Statement;
  private findNearestTokenStmt: Database.Statement;
  private findVerbFormsStmt: Database.Statement;
  private findCachedTranslationStmt: Database.Statement;
  private upsertCachedTranslationStmt: Database.Statement;

  constructor(dbPath: string) {
    this.db = new Database(dbPath, { readonly: false });
    this.db.pragma("journal_mode = WAL");
    this.ensureSchema();

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

    this.findCachedTranslationStmt = this.db.prepare(
      `
        SELECT word_translation as wordTranslation,
               usage_examples_json as usageExamplesJson
        FROM translations
        WHERE token_id = ? AND context_hash = ? AND target_language = ?
        LIMIT 1
      `
    );

    this.upsertCachedTranslationStmt = this.db.prepare(
      `
        INSERT INTO translations (
          token_id,
          context_hash,
          context_sentence,
          target_language,
          word_translation,
          usage_examples_json,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(token_id, context_hash, target_language)
        DO UPDATE SET
          context_sentence = excluded.context_sentence,
          word_translation = excluded.word_translation,
          usage_examples_json = excluded.usage_examples_json,
          updated_at = excluded.updated_at
      `
    );
  }

  private ensureSchema(): void {
    const columns = this.db.prepare("PRAGMA table_info(translations)").all() as Array<{
      name: string;
    }>;
    const hasUsageExamples = columns.some((column) => column.name === "usage_examples_json");
    if (!hasUsageExamples) {
      this.db.exec("ALTER TABLE translations ADD COLUMN usage_examples_json TEXT NOT NULL DEFAULT '[]'");
    }
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

  getCachedTranslation(
    tokenId: number,
    contextHash: string,
    targetLanguage: string
  ): cachedTranslation | null {
    const row = this.findCachedTranslationStmt.get(
      tokenId,
      contextHash,
      targetLanguage
    ) as cachedTranslation | undefined;
    return row ?? null;
  }

  upsertCachedTranslation(
    tokenId: number,
    contextHash: string,
    contextSentence: string,
    targetLanguage: string,
    wordTranslation: string,
    usageExamplesJson: string
  ): void {
    this.upsertCachedTranslationStmt.run(
      tokenId,
      contextHash,
      contextSentence,
      targetLanguage,
      wordTranslation,
      usageExamplesJson,
      Date.now()
    );
  }
}

export const hashContext = (value: string): string => {
  return crypto.createHash("sha256").update(value, "utf8").digest("hex");
};
