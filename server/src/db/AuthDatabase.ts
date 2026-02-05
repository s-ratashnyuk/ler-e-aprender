import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";

const AUTH_PBKDF2_ITERATIONS = 120_000;

export type authUser = {
  id: number;
  email: string;
};

type authUserRecord = {
  id: number;
  email: string;
  passwordHash: string;
  passwordSalt: string;
};

const resolveDefaultAuthDbPath = (): string => {
  const cwd = process.cwd();
  const baseDir = path.basename(cwd) === "server" ? cwd : path.resolve(cwd, "server");
  const dbDir = process.env.AUTH_DB_DIR ?? path.resolve(baseDir, "data");
  return process.env.AUTH_DB_PATH ?? path.resolve(dbDir, "auth.sqlite");
};

let authDatabase: AuthDatabase | null = null;

export const getAuthDatabase = (): AuthDatabase => {
  if (authDatabase) {
    return authDatabase;
  }

  const dbPath = resolveDefaultAuthDbPath();
  const dbDir = path.dirname(dbPath);
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  authDatabase = new AuthDatabase(dbPath);
  return authDatabase;
};

const hashClientPassword = (clientHash: string, salt: string): string => {
  return crypto
    .pbkdf2Sync(clientHash, salt, AUTH_PBKDF2_ITERATIONS, 64, "sha256")
    .toString("hex");
};

const timingSafeEqualHex = (left: string, right: string): boolean => {
  const leftBuf = Buffer.from(left, "hex");
  const rightBuf = Buffer.from(right, "hex");
  if (leftBuf.length !== rightBuf.length) {
    return false;
  }
  return crypto.timingSafeEqual(leftBuf, rightBuf);
};

export class AuthDatabase {
  private db: Database.Database;
  private insertUserStmt: Database.Statement;
  private findUserByEmailStmt: Database.Statement;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.ensureSchema();

    this.insertUserStmt = this.db.prepare(
      `
        INSERT INTO users (email, password_hash, password_salt, created_at)
        VALUES (?, ?, ?, ?)
      `
    );

    this.findUserByEmailStmt = this.db.prepare(
      `
        SELECT id, email, password_hash as passwordHash, password_salt as passwordSalt
        FROM users
        WHERE email = ?
        LIMIT 1
      `
    );
  }

  private ensureSchema(): void {
    this.db.exec(
      `
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT NOT NULL UNIQUE,
          password_hash TEXT NOT NULL,
          password_salt TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
      `
    );
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  createUser(email: string, clientPasswordHash: string): authUser {
    const normalizedEmail = this.normalizeEmail(email);
    const salt = crypto.randomBytes(16).toString("hex");
    const passwordHash = hashClientPassword(clientPasswordHash, salt);

    const result = this.insertUserStmt.run(normalizedEmail, passwordHash, salt, Date.now());
    return {
      id: Number(result.lastInsertRowid),
      email: normalizedEmail
    };
  }

  verifyUser(email: string, clientPasswordHash: string): authUser | null {
    const normalizedEmail = this.normalizeEmail(email);
    const row = this.findUserByEmailStmt.get(normalizedEmail) as authUserRecord | undefined;
    if (!row) {
      return null;
    }

    const expectedHash = hashClientPassword(clientPasswordHash, row.passwordSalt);
    if (!timingSafeEqualHex(expectedHash, row.passwordHash)) {
      return null;
    }

    return { id: row.id, email: row.email };
  }
}
