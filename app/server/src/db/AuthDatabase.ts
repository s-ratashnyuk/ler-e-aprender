import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { resolveDatabaseFile } from "./DatabasePath.js";

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

type authSessionRecord = {
  sessionId: string;
  userId: number;
  email: string;
  expiresAt: number;
};

export const resolveAuthDbPath = (): string => {
  return resolveDatabaseFile("auth.sqlite", {
    overridePath: process.env.AUTH_DB_PATH,
    overrideDir: process.env.AUTH_DB_DIR
  });
};

let authDatabase: AuthDatabase | null = null;

export const getAuthDatabase = (): AuthDatabase => {
  if (authDatabase) {
    return authDatabase;
  }

  const dbPath = resolveAuthDbPath();
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
  private insertSessionStmt: Database.Statement;
  private findSessionStmt: Database.Statement;
  private touchSessionStmt: Database.Statement;
  private deleteSessionStmt: Database.Statement;

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

    this.insertSessionStmt = this.db.prepare(
      `
        INSERT INTO sessions (id, user_id, created_at, last_seen_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `
    );

    this.findSessionStmt = this.db.prepare(
      `
        SELECT sessions.id as sessionId,
               sessions.user_id as userId,
               sessions.expires_at as expiresAt,
               users.email as email
        FROM sessions
        JOIN users ON users.id = sessions.user_id
        WHERE sessions.id = ?
        LIMIT 1
      `
    );

    this.touchSessionStmt = this.db.prepare(
      `
        UPDATE sessions
        SET expires_at = ?, last_seen_at = ?
        WHERE id = ?
      `
    );

    this.deleteSessionStmt = this.db.prepare(
      `
        DELETE FROM sessions
        WHERE id = ?
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

        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_id INTEGER NOT NULL,
          created_at INTEGER NOT NULL,
          last_seen_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        );

        CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);
        CREATE INDEX IF NOT EXISTS sessions_expires_at_idx ON sessions(expires_at);
      `
    );
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  getUserByEmail(email: string): authUser | null {
    const normalizedEmail = this.normalizeEmail(email);
    const row = this.findUserByEmailStmt.get(normalizedEmail) as authUserRecord | undefined;
    if (!row) {
      return null;
    }
    return { id: row.id, email: row.email };
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

  createOAuthUser(email: string): authUser {
    const normalizedEmail = this.normalizeEmail(email);
    const salt = crypto.randomBytes(16).toString("hex");
    const randomClientHash = crypto.randomBytes(32).toString("hex");
    const passwordHash = hashClientPassword(randomClientHash, salt);

    const result = this.insertUserStmt.run(normalizedEmail, passwordHash, salt, Date.now());
    return {
      id: Number(result.lastInsertRowid),
      email: normalizedEmail
    };
  }

  createSession(userId: number, ttlMs: number): string {
    const sessionId = crypto.randomBytes(32).toString("hex");
    const now = Date.now();
    const expiresAt = now + ttlMs;
    this.insertSessionStmt.run(sessionId, userId, now, now, expiresAt);
    return sessionId;
  }

  refreshSession(sessionId: string, ttlMs: number): authUser | null {
    const row = this.findSessionStmt.get(sessionId) as authSessionRecord | undefined;
    if (!row) {
      return null;
    }

    const now = Date.now();
    if (row.expiresAt <= now) {
      this.deleteSessionStmt.run(sessionId);
      return null;
    }

    const nextExpiresAt = now + ttlMs;
    this.touchSessionStmt.run(nextExpiresAt, now, sessionId);
    return {
      id: row.userId,
      email: row.email
    };
  }

  deleteSession(sessionId: string): void {
    this.deleteSessionStmt.run(sessionId);
  }

  close(): void {
    this.db.close();
  }
}

export const closeAuthDatabase = (): void => {
  if (!authDatabase) {
    return;
  }
  authDatabase.close();
  authDatabase = null;
};
