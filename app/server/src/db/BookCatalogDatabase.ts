import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { detectImageMime } from "../utils/DetectImageMime.js";
import { resolveDatabaseDir, resolveDatabaseFile } from "./DatabasePath.js";

export type bookCatalogEntry = {
  id: string;
  title: string;
  author: string;
  description: string;
  language: string;
  coverBase64: string;
  coverMime: string;
};

type catalogBookRow = bookCatalogEntry & {
  createdAt: number;
  updatedAt: number;
};

export const resolveBookCatalogDbPath = (): string => {
  return resolveDatabaseFile("catalog.sqlite", {
    overridePath: process.env.BOOK_CATALOG_DB_PATH,
    overrideDir: process.env.BOOK_CATALOG_DB_DIR
  });
};

let catalogDatabase: BookCatalogDatabase | null = null;

export const getBookCatalogDatabase = (): BookCatalogDatabase => {
  if (catalogDatabase) {
    return catalogDatabase;
  }

  const dbPath = resolveBookCatalogDbPath();
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  catalogDatabase = new BookCatalogDatabase(dbPath);
  return catalogDatabase;
};

const safeString = (value: string | undefined): string => (value ?? "").trim();

const readMetaTable = (db: Database.Database): Record<string, string> | null => {
  const metaTable = db.prepare(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'meta' LIMIT 1"
  ).get() as { name: string } | undefined;
  if (!metaTable) {
    return null;
  }

  const rows = db.prepare("SELECT key, value FROM meta").all() as Array<{
    key: string;
    value: string;
  }>;

  const meta: Record<string, string> = {};
  rows.forEach((row) => {
    meta[row.key] = row.value;
  });
  return meta;
};

export class BookCatalogDatabase {
  private db: Database.Database;
  private upsertBookStmt: Database.Statement;
  private listBooksStmt: Database.Statement;
  private getBookStmt: Database.Statement;
  private deleteBookStmt: Database.Statement;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.ensureSchema();

    this.upsertBookStmt = this.db.prepare(
      `
        INSERT INTO books (
          id,
          title,
          author,
          description,
          language,
          cover_base64,
          cover_mime,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id)
        DO UPDATE SET
          title = excluded.title,
          author = excluded.author,
          description = excluded.description,
          language = excluded.language,
          cover_base64 = excluded.cover_base64,
          cover_mime = excluded.cover_mime,
          updated_at = excluded.updated_at
      `
    );

    this.listBooksStmt = this.db.prepare(
      `
        SELECT id,
               title,
               author,
               description,
               language,
               cover_base64 as coverBase64,
               cover_mime as coverMime,
               created_at as createdAt,
               updated_at as updatedAt
        FROM books
        ORDER BY updated_at DESC, title ASC
      `
    );

    this.getBookStmt = this.db.prepare(
      `
        SELECT id,
               title,
               author,
               description,
               language,
               cover_base64 as coverBase64,
               cover_mime as coverMime,
               created_at as createdAt,
               updated_at as updatedAt
        FROM books
        WHERE id = ?
        LIMIT 1
      `
    );

    this.deleteBookStmt = this.db.prepare(
      `
        DELETE FROM books
        WHERE id = ?
      `
    );
  }

  private ensureSchema(): void {
    this.db.exec(
      `
        CREATE TABLE IF NOT EXISTS books (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          author TEXT NOT NULL,
          description TEXT NOT NULL,
          language TEXT NOT NULL,
          cover_base64 TEXT NOT NULL,
          cover_mime TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE INDEX IF NOT EXISTS books_updated_idx ON books(updated_at);
      `
    );
  }

  upsertBook(entry: bookCatalogEntry): void {
    const coverBase64 = safeString(entry.coverBase64);
    const coverMime =
      safeString(entry.coverMime) || detectImageMime(coverBase64) || "";

    const now = Date.now();
    this.upsertBookStmt.run(
      safeString(entry.id),
      safeString(entry.title),
      safeString(entry.author),
      safeString(entry.description),
      safeString(entry.language) || "pt-PT",
      coverBase64,
      coverMime,
      now,
      now
    );
  }

  listBooks(): bookCatalogEntry[] {
    const rows = this.listBooksStmt.all() as catalogBookRow[];
    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      author: row.author,
      description: row.description,
      language: row.language,
      coverBase64: row.coverBase64,
      coverMime: row.coverMime
    }));
  }

  getBook(id: string): bookCatalogEntry | null {
    const row = this.getBookStmt.get(id) as catalogBookRow | undefined;
    if (!row) {
      return null;
    }
    return {
      id: row.id,
      title: row.title,
      author: row.author,
      description: row.description,
      language: row.language,
      coverBase64: row.coverBase64,
      coverMime: row.coverMime
    };
  }

  deleteBook(id: string): boolean {
    const result = this.deleteBookStmt.run(safeString(id));
    return result.changes > 0;
  }

  syncFromBookDatabases(): void {
    const dbDir = resolveDatabaseDir(process.env.BOOK_DB_DIR);
    if (!fs.existsSync(dbDir)) {
      return;
    }

    const entries = fs.readdirSync(dbDir);
    for (const entry of entries) {
      if (!entry.endsWith(".sqlite")) {
        continue;
      }
      if (entry === "auth.sqlite" || entry === "catalog.sqlite") {
        continue;
      }
      if (entry.endsWith(".sentences.sqlite")) {
        continue;
      }

      const dbPath = path.resolve(dbDir, entry);
      let db: Database.Database | null = null;
      try {
        db = new Database(dbPath, { readonly: true });
        const meta = readMetaTable(db);
        if (!meta) {
          continue;
        }

        const id = safeString(meta.book_id);
        const title = safeString(meta.name);
        const author = safeString(meta.author);
        const description = safeString(meta.description);
        if (!id || !title) {
          continue;
        }

        const language = safeString(meta.language) || "pt-PT";
        const coverBase64 = safeString(meta.cover);
        const coverMime =
          safeString(meta.cover_mime) || detectImageMime(coverBase64) || "";

        this.upsertBook({
          id,
          title,
          author,
          description,
          language,
          coverBase64,
          coverMime
        });
      } catch {
        // ignore malformed databases
      } finally {
        if (db) {
          db.close();
        }
      }
    }
  }

  close(): void {
    this.db.close();
  }
}

export const closeBookCatalogDatabase = (): void => {
  if (!catalogDatabase) {
    return;
  }
  catalogDatabase.close();
  catalogDatabase = null;
};
