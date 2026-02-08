import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { getBookCatalogDatabase } from "../db/BookCatalogDatabase.js";
import { resolveDatabaseDir } from "../db/DatabasePath.js";
import { resolveSentenceTranslationsDbPath } from "../db/SentenceTranslationDatabase.js";
import { detectImageMime } from "./DetectImageMime.js";

type freelingToken = {
  id: string;
  begin: string | number;
  end: string | number;
  form: string;
  lemma: string;
  tag?: string;
  ctag?: string;
  pos?: string;
  mood?: string;
  tense?: string;
  person?: string;
  gen?: string;
  num?: string;
};

type freelingSentence = {
  id: string;
  tokens: freelingToken[];
};

type verbFormsFileEntry = {
  lemma: string;
  isIrregular: boolean;
  rows: Array<{ Tense: string; Forms: string }>;
};

type sentenceTranslationEntry = {
  index: number;
  rawStart: number;
  rawEnd: number;
  start: number;
  end: number;
  text: string;
  hash: string;
  translation: string;
};

type sentenceTranslationsPayload = {
  meta?: Record<string, string>;
  sentences: sentenceTranslationEntry[];
};

type parsedLemmasPayload = {
  sentences: freelingSentence[];
  verbForms?: verbFormsFileEntry[];
};

export type bookUploadPayload = {
  id: string;
  name: string;
  author: string;
  description: string;
  language: string;
  cover: string;
  content: string;
  parsedLemmas: parsedLemmasPayload;
  sentenceTranslations?: sentenceTranslationsPayload;
};

type parseResult =
  | { payload: bookUploadPayload }
  | { error: string };

type ingestResult = {
  dbPath: string;
  sentenceCount: number;
  tokenCount: number;
  verbFormCount: number;
  sentenceTranslationCount: number;
  sentenceTranslationDbPath?: string;
};

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === "object";
};

const isString = (value: unknown): value is string => typeof value === "string";
const isNumber = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const isStringOrNumber = (value: unknown): value is string | number =>
  typeof value === "string" || typeof value === "number";

const parseToken = (value: unknown): freelingToken | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = value.id;
  const begin = value.begin;
  const end = value.end;
  const form = value.form;
  const lemma = value.lemma;

  if (!isString(id) || !isStringOrNumber(begin) || !isStringOrNumber(end) || !isString(form) || !isString(lemma)) {
    return null;
  }

  const token: freelingToken = {
    id,
    begin,
    end,
    form,
    lemma
  };

  const optionalKeys: Array<keyof Omit<freelingToken, "id" | "begin" | "end" | "form" | "lemma">> = [
    "tag",
    "ctag",
    "pos",
    "mood",
    "tense",
    "person",
    "gen",
    "num"
  ];

  for (const key of optionalKeys) {
    const entry = value[key];
    if (typeof entry === "string") {
      token[key] = entry;
    }
  }

  return token;
};

const parseSentence = (value: unknown): freelingSentence | null => {
  if (!isRecord(value)) {
    return null;
  }

  const id = value.id;
  const tokens = value.tokens;
  if (!isString(id) || !Array.isArray(tokens)) {
    return null;
  }

  const parsedTokens: freelingToken[] = [];
  for (const token of tokens) {
    const parsed = parseToken(token);
    if (!parsed) {
      return null;
    }
    parsedTokens.push(parsed);
  }

  return {
    id,
    tokens: parsedTokens
  };
};

const parseSentences = (value: unknown): freelingSentence[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const sentences: freelingSentence[] = [];
  for (const entry of value) {
    const parsed = parseSentence(entry);
    if (!parsed) {
      return null;
    }
    sentences.push(parsed);
  }

  return sentences;
};

const parseVerbForms = (value: unknown): verbFormsFileEntry[] | null => {
  if (!Array.isArray(value)) {
    return null;
  }

  const entries: verbFormsFileEntry[] = [];
  for (const entry of value) {
    if (!isRecord(entry)) {
      return null;
    }

    const lemma = entry.lemma;
    const isIrregular = entry.isIrregular;
    const rows = entry.rows;
    if (!isString(lemma) || typeof isIrregular !== "boolean" || !Array.isArray(rows)) {
      return null;
    }

    const normalizedRows: Array<{ Tense: string; Forms: string }> = [];
    for (const row of rows) {
      if (!isRecord(row)) {
        return null;
      }
      const tense = row.Tense;
      const forms = row.Forms;
      if (!isString(tense) || !isString(forms)) {
        return null;
      }
      normalizedRows.push({ Tense: tense, Forms: forms });
    }

    entries.push({ lemma, isIrregular, rows: normalizedRows });
  }

  return entries;
};

const parseSentenceTranslationEntry = (value: unknown): sentenceTranslationEntry | null => {
  if (!isRecord(value)) {
    return null;
  }

  const index = value.index;
  const rawStart = value.rawStart;
  const rawEnd = value.rawEnd;
  const start = value.start;
  const end = value.end;
  const text = value.text;
  const hash = value.hash;
  const translation = value.translation;

  if (
    !isNumber(index) ||
    !isNumber(rawStart) ||
    !isNumber(rawEnd) ||
    !isNumber(start) ||
    !isNumber(end) ||
    !isString(text) ||
    !isString(hash) ||
    !isString(translation)
  ) {
    return null;
  }

  return {
    index,
    rawStart,
    rawEnd,
    start,
    end,
    text,
    hash,
    translation
  };
};

const normalizeSentenceMeta = (value: unknown): Record<string, string> | null => {
  if (!isRecord(value)) {
    return null;
  }

  const meta: Record<string, string> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean") {
      meta[key] = String(entry);
    }
  }

  return meta;
};

const normalizeSentenceTranslations = (value: unknown): sentenceTranslationsPayload | null => {
  if (!isRecord(value)) {
    return null;
  }

  const sentencesValue = value.sentences;
  if (!Array.isArray(sentencesValue)) {
    return null;
  }

  const sentences: sentenceTranslationEntry[] = [];
  for (const entry of sentencesValue) {
    const parsed = parseSentenceTranslationEntry(entry);
    if (!parsed) {
      return null;
    }
    sentences.push(parsed);
  }

  const meta = value.meta ? normalizeSentenceMeta(value.meta) : undefined;
  if (value.meta && !meta) {
    return null;
  }

  return {
    meta: meta ?? undefined,
    sentences
  };
};

const normalizeParsedLemmas = (value: unknown): parsedLemmasPayload | null => {
  if (Array.isArray(value)) {
    const sentences: freelingSentence[] = [];
    for (const entry of value) {
      if (!isRecord(entry)) {
        return null;
      }
      const entrySentences = parseSentences(entry.sentences);
      if (!entrySentences) {
        return null;
      }
      sentences.push(...entrySentences);
    }
    return { sentences };
  }

  if (!isRecord(value)) {
    return null;
  }

  const sentences = parseSentences(value.sentences);
  if (!sentences) {
    return null;
  }

  const verbForms = value.verbForms ? parseVerbForms(value.verbForms) : undefined;
  if (value.verbForms && !verbForms) {
    return null;
  }

  return {
    sentences,
    verbForms: verbForms ?? undefined
  };
};

const normalizeCover = (value: string): string => {
  return value.trim();
};

const isSafeBookId = (value: string): boolean => {
  return /^[a-zA-Z0-9_-]+$/.test(value);
};

export const parseBookUpload = (value: unknown): parseResult => {
  if (!isRecord(value)) {
    return { error: "Invalid request payload." };
  }

  const id = value.id;
  const name = value.name;
  const author = value.author;
  const description = value.description;
  const language = value.language;
  const cover = value.cover;
  const content = value.content;
  const parsedLemmas = value.parsedLemmas;
  const sentenceTranslations = value.sentenceTranslations;

  if (!isString(id) || !id.trim()) {
    return { error: "Book id is required." };
  }

  if (!isSafeBookId(id.trim())) {
    return { error: "Book id must contain only letters, numbers, dashes, or underscores." };
  }

  if (!isString(name) || !name.trim()) {
    return { error: "Book name is required." };
  }

  if (!isString(author)) {
    return { error: "Author must be a string." };
  }

  if (!isString(description)) {
    return { error: "Description must be a string." };
  }

  const normalizedLanguage = isString(language) && language.trim() ? language.trim() : "pt-PT";

  if (!isString(content) || !content.trim()) {
    return { error: "Content is required." };
  }

  if (!isString(cover)) {
    return { error: "Cover must be a base64 string." };
  }

  const normalizedParsedLemmas = normalizeParsedLemmas(parsedLemmas);
  if (!normalizedParsedLemmas || normalizedParsedLemmas.sentences.length === 0) {
    return { error: "Parsed lemmas must include sentences." };
  }

  const normalizedSentenceTranslations = sentenceTranslations
    ? normalizeSentenceTranslations(sentenceTranslations)
    : undefined;
  if (sentenceTranslations && !normalizedSentenceTranslations) {
    return { error: "Sentence translations payload is invalid." };
  }

  return {
    payload: {
      id: id.trim(),
      name: name.trim(),
      author: author.trim(),
      description: description.trim(),
      language: normalizedLanguage,
      cover: normalizeCover(cover),
      content,
      parsedLemmas: normalizedParsedLemmas,
      sentenceTranslations: normalizedSentenceTranslations ?? undefined
    }
  };
};

const createSchema = (db: Database.Database): void => {
  db.exec(
    `
    CREATE TABLE IF NOT EXISTS meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sentence_id TEXT NOT NULL,
      token_id TEXT NOT NULL,
      begin INTEGER NOT NULL,
      end INTEGER NOT NULL,
      form TEXT NOT NULL,
      surface TEXT NOT NULL,
      lemma TEXT NOT NULL,
      pos TEXT,
      tag TEXT,
      ctag TEXT,
      mood TEXT,
      tense TEXT,
      person TEXT,
      gen TEXT,
      num TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_tokens_span ON tokens (begin, end);
    CREATE INDEX IF NOT EXISTS idx_tokens_lemma ON tokens (lemma);

    CREATE TABLE IF NOT EXISTS verb_forms (
      lemma TEXT NOT NULL,
      tense_label TEXT NOT NULL,
      forms TEXT NOT NULL,
      is_irregular INTEGER NOT NULL,
      PRIMARY KEY (lemma, tense_label)
    );

    CREATE INDEX IF NOT EXISTS idx_verb_forms_lemma ON verb_forms (lemma);
    `
  );
};

const createSentenceTranslationsSchema = (db: Database.Database): void => {
  db.exec(
    `
    CREATE TABLE IF NOT EXISTS sentence_meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sentences (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sentence_index INTEGER NOT NULL,
      raw_start INTEGER NOT NULL,
      raw_end INTEGER NOT NULL,
      start INTEGER NOT NULL,
      end INTEGER NOT NULL,
      text TEXT NOT NULL,
      hash TEXT NOT NULL,
      translation TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_sentences_span ON sentences (start, end);
    CREATE INDEX IF NOT EXISTS idx_sentences_hash ON sentences (hash);
    `
  );
};

const insertSentenceTranslationsMeta = (
  db: Database.Database,
  entries: Array<[string, string]>
): void => {
  if (entries.length === 0) {
    return;
  }
  const stmt = db.prepare("INSERT OR REPLACE INTO sentence_meta (key, value) VALUES (?, ?)");
  for (const [key, value] of entries) {
    stmt.run(key, value);
  }
};

const insertMeta = (db: Database.Database, entries: Array<[string, string]>): void => {
  const stmt = db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)");
  for (const [key, value] of entries) {
    stmt.run(key, value);
  }
};

export const ingestBookUpload = (payload: bookUploadPayload): ingestResult => {
  const dbDir = resolveDatabaseDir(process.env.BOOK_DB_DIR);
  const dbPath = path.resolve(dbDir, `${payload.id}.sqlite`);
  if (fs.existsSync(dbPath)) {
    throw new Error(`Book database already exists for ${payload.id}.`);
  }

  fs.mkdirSync(dbDir, { recursive: true });

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");
  createSchema(db);

  const textHash = crypto.createHash("sha256").update(payload.content, "utf8").digest("hex");
  const coverMime = detectImageMime(payload.cover) ?? "";
  insertMeta(db, [
    ["book_id", payload.id],
    ["name", payload.name],
    ["author", payload.author],
    ["description", payload.description],
    ["language", payload.language],
    ["cover", payload.cover],
    ["cover_mime", coverMime],
    ["content", payload.content],
    ["text_hash", textHash],
    ["ingested_at", new Date().toISOString()]
  ]);

  const insertToken = db.prepare(
    `
      INSERT INTO tokens (
        sentence_id,
        token_id,
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
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
  );

  let tokenCount = 0;
  const insertTokens = db.transaction((sentences: freelingSentence[]) => {
    for (const sentence of sentences) {
      for (const token of sentence.tokens) {
        const beginValue = typeof token.begin === "number"
          ? token.begin
          : Number.parseInt(token.begin, 10);
        const endValue = typeof token.end === "number"
          ? token.end
          : Number.parseInt(token.end, 10);
        const begin = Number.isFinite(beginValue) ? beginValue : 0;
        const end = Number.isFinite(endValue) ? endValue : 0;
        const surface = Number.isFinite(begin) && Number.isFinite(end) && end > begin
          ? payload.content.slice(begin, end)
          : token.form.replace(/_/g, " ");

        insertToken.run(
          sentence.id,
          token.id,
          begin,
          end,
          token.form,
          surface || token.form.replace(/_/g, " "),
          token.lemma,
          token.pos ?? "",
          token.tag ?? "",
          token.ctag ?? "",
          token.mood ?? "",
          token.tense ?? "",
          token.person ?? "",
          token.gen ?? "",
          token.num ?? ""
        );
        tokenCount += 1;
      }
    }
  });

  insertTokens(payload.parsedLemmas.sentences);

  let verbFormCount = 0;
  if (payload.parsedLemmas.verbForms?.length) {
    const insertVerbForm = db.prepare(
      `
        INSERT INTO verb_forms (lemma, tense_label, forms, is_irregular)
        VALUES (?, ?, ?, ?)
      `
    );
    const insertVerbForms = db.transaction((entries: verbFormsFileEntry[]) => {
      for (const entry of entries) {
        for (const row of entry.rows) {
          insertVerbForm.run(
            entry.lemma,
            row.Tense,
            row.Forms,
            entry.isIrregular ? 1 : 0
          );
          verbFormCount += 1;
        }
      }
    });
    insertVerbForms(payload.parsedLemmas.verbForms);
  }

  db.close();

  let sentenceTranslationCount = 0;
  let sentenceTranslationDbPath: string | undefined;
  if (payload.sentenceTranslations?.sentences.length) {
    const sentenceDbPath = resolveSentenceTranslationsDbPath(payload.id);
    if (fs.existsSync(sentenceDbPath)) {
      throw new Error(`Sentence translations database already exists for ${payload.id}.`);
    }

    fs.mkdirSync(path.dirname(sentenceDbPath), { recursive: true });
    const sentenceDb = new Database(sentenceDbPath);
    sentenceDb.pragma("journal_mode = WAL");
    createSentenceTranslationsSchema(sentenceDb);

    const metaEntries: Array<[string, string]> = [];
    if (payload.sentenceTranslations.meta) {
      metaEntries.push(...Object.entries(payload.sentenceTranslations.meta));
    }
    metaEntries.push(["book_id", payload.id]);
    metaEntries.push(["language", payload.language]);
    insertSentenceTranslationsMeta(sentenceDb, metaEntries);

    const insertSentence = sentenceDb.prepare(
      `
        INSERT INTO sentences (
          sentence_index,
          raw_start,
          raw_end,
          start,
          end,
          text,
          hash,
          translation
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `
    );
    const insertSentences = sentenceDb.transaction((entries: sentenceTranslationEntry[]) => {
      for (const entry of entries) {
        insertSentence.run(
          entry.index,
          entry.rawStart,
          entry.rawEnd,
          entry.start,
          entry.end,
          entry.text,
          entry.hash,
          entry.translation
        );
        sentenceTranslationCount += 1;
      }
    });
    insertSentences(payload.sentenceTranslations.sentences);
    sentenceDb.close();
    sentenceTranslationDbPath = sentenceDbPath;
  }

  const catalogDb = getBookCatalogDatabase();
  catalogDb.upsertBook({
    id: payload.id,
    title: payload.name,
    author: payload.author,
    description: payload.description,
    language: payload.language,
    coverBase64: payload.cover,
    coverMime
  });

  return {
    dbPath,
    sentenceCount: payload.parsedLemmas.sentences.length,
    tokenCount,
    verbFormCount,
    sentenceTranslationCount,
    sentenceTranslationDbPath
  };
};
