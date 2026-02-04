import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import Database from "better-sqlite3";

type freelingToken = {
  id: string;
  begin: string;
  end: string;
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

const parseArgs = (): Record<string, string> => {
  const args: Record<string, string> = {};
  for (let index = 2; index < process.argv.length; index += 1) {
    const key = process.argv[index];
    if (!key.startsWith("--")) {
      continue;
    }
    const value = process.argv[index + 1];
    if (!value || value.startsWith("--")) {
      args[key] = "true";
    } else {
      args[key] = value;
      index += 1;
    }
  }
  return args;
};

const extractStoryText = (filePath: string): string => {
  const content = fs.readFileSync(filePath, "utf8");
  const match = content.match(/`([\s\S]*)`/);
  if (!match) {
    throw new Error(`Could not extract story text from ${filePath}`);
  }

  const raw = match[1];
  return raw.startsWith("\n") ? raw.slice(1) : raw;
};

const readJsonObjects = (content: string): unknown[] => {
  const objects: unknown[] = [];
  let index = 0;
  while (index < content.length) {
    while (index < content.length && /\s/.test(content[index])) {
      index += 1;
    }
    if (index >= content.length) {
      break;
    }

    if (content[index] !== "{") {
      throw new Error(`Unexpected character at ${index}: ${content[index]}`);
    }

    let depth = 0;
    let inString = false;
    let escape = false;
    let endIndex = -1;
    for (let cursor = index; cursor < content.length; cursor += 1) {
      const char = content[cursor];
      if (inString) {
        if (escape) {
          escape = false;
        } else if (char === "\\") {
          escape = true;
        } else if (char === "\"") {
          inString = false;
        }
        continue;
      }

      if (char === "\"") {
        inString = true;
      } else if (char === "{") {
        depth += 1;
      } else if (char === "}") {
        depth -= 1;
        if (depth === 0) {
          endIndex = cursor + 1;
          break;
        }
      }
    }

    if (endIndex === -1) {
      throw new Error("Unterminated JSON object in tagged file.");
    }

    const jsonText = content.slice(index, endIndex);
    objects.push(JSON.parse(jsonText));
    index = endIndex;
  }

  return objects;
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

    CREATE TABLE IF NOT EXISTS translations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      token_id INTEGER NOT NULL,
      context_hash TEXT NOT NULL,
      context_sentence TEXT NOT NULL,
      target_language TEXT NOT NULL,
      word_translation TEXT NOT NULL,
      usage_examples_json TEXT NOT NULL,
      updated_at INTEGER NOT NULL,
      UNIQUE (token_id, context_hash, target_language)
    );
    `
  );
};

const insertMeta = (db: Database.Database, bookId: string, textHash: string): void => {
  const stmt = db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)");
  stmt.run("book_id", bookId);
  stmt.run("text_hash", textHash);
  stmt.run("ingested_at", new Date().toISOString());
};

const main = (): void => {
  const args = parseArgs();
  const bookId = args["--book-id"] ?? "Sou-Sophia";
  const taggedFile = args["--tagged-file"] ?? path.resolve(process.cwd(), "storyText-tagged.json");
  const textFile = args["--text-file"] ?? path.resolve(process.cwd(), "client/src/content/storyText.ts");
  const dbPath =
    args["--db-path"] ??
    path.resolve(process.cwd(), "server", "data", `${bookId}.sqlite`);
  const verbFormsFile = args["--verb-forms"];

  const storyText = extractStoryText(textFile);
  const textHash = crypto.createHash("sha256").update(storyText, "utf8").digest("hex");

  const taggedContent = fs.readFileSync(taggedFile, "utf8");
  const objects = readJsonObjects(taggedContent);

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }

  const db = new Database(dbPath);
  createSchema(db);
  insertMeta(db, bookId, textHash);

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

  const insertTokens = db.transaction((sentences: freelingSentence[]) => {
    for (const sentence of sentences) {
      for (const token of sentence.tokens) {
        const begin = Number.parseInt(token.begin, 10);
        const end = Number.parseInt(token.end, 10);
        const surface =
          Number.isFinite(begin) && Number.isFinite(end) && end > begin
            ? storyText.slice(begin, end)
            : token.form.replace(/_/g, " ");

        insertToken.run(
          sentence.id,
          token.id,
          Number.isFinite(begin) ? begin : 0,
          Number.isFinite(end) ? end : 0,
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
      }
    }
  });

  const sentences: freelingSentence[] = [];
  for (const obj of objects) {
    const record = obj as { sentences?: freelingSentence[] };
    if (record.sentences?.length) {
      sentences.push(...record.sentences);
    }
  }

  insertTokens(sentences);

  if (verbFormsFile) {
    const verbFormsContent = fs.readFileSync(verbFormsFile, "utf8");
    const verbForms = JSON.parse(verbFormsContent) as verbFormsFileEntry[];
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
        }
      }
    });
    insertVerbForms(verbForms);
  } else {
    console.warn("No verb forms file provided; verb_forms table will be empty.");
  }

  db.close();
  console.log(`Ingested ${sentences.length} sentences into ${dbPath}`);
};

main();
