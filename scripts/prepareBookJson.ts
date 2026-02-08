import * as fs from "node:fs";
import * as path from "node:path";

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

type sentenceTranslationsFile = {
  meta?: Record<string, unknown>;
  sentences: sentenceTranslationEntry[];
};

type bookJson = {
  id: string;
  name: string;
  author: string;
  description: string;
  cover: string;
  content: string;
  parsedLemmas: {
    sentences: freelingSentence[];
    verbForms?: verbFormsFileEntry[];
  };
  sentenceTranslations?: sentenceTranslationsFile;
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

const resolveRepoRoot = (): string => {
  const cwd = process.cwd();
  const base = path.basename(cwd);
  if (base === "scripts") {
    return path.resolve(cwd, "..");
  }
  if (base === "server") {
    return path.resolve(cwd, "..", "..");
  }
  if (base === "app") {
    return path.resolve(cwd, "..");
  }
  return cwd;
};

const extractStoryText = (filePath: string): string => {
  const content = fs.readFileSync(filePath, "utf8");
  const match = content.match(/`([\s\S]*)`/);
  if (!match) {
    return content;
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

const readTaggedSentences = (filePath: string): freelingSentence[] => {
  const content = fs.readFileSync(filePath, "utf8").trim();
  if (!content) {
    return [];
  }

  let parsed: unknown;
  let objects: unknown[];
  try {
    parsed = JSON.parse(content);
  } catch {
    parsed = null;
  }

  if (Array.isArray(parsed)) {
    objects = parsed;
  } else if (parsed) {
    objects = [parsed];
  } else {
    objects = readJsonObjects(content);
  }

  const sentences: freelingSentence[] = [];
  for (const obj of objects) {
    const record = obj as { sentences?: freelingSentence[] };
    if (record.sentences?.length) {
      sentences.push(...record.sentences);
    }
  }

  return sentences;
};

const readVerbForms = (filePath: string | undefined): verbFormsFileEntry[] | undefined => {
  if (!filePath || !fs.existsSync(filePath)) {
    return undefined;
  }

  const content = fs.readFileSync(filePath, "utf8");
  return JSON.parse(content) as verbFormsFileEntry[];
};

const readSentenceTranslations = (filePath: string | undefined): sentenceTranslationsFile | undefined => {
  if (!filePath || !fs.existsSync(filePath)) {
    return undefined;
  }

  const content = fs.readFileSync(filePath, "utf8").trim();
  if (!content) {
    return undefined;
  }

  const parsed = JSON.parse(content) as sentenceTranslationsFile;
  if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.sentences)) {
    throw new Error("Sentence translations file must include a sentences array.");
  }

  return parsed;
};

const readCoverBase64 = (filePath: string | undefined): string => {
  if (!filePath) {
    return "";
  }

  const buffer = fs.readFileSync(filePath);
  return buffer.toString("base64");
};

const requireArg = (args: Record<string, string>, key: string): string => {
  const value = args[key];
  if (!value || value === "true") {
    throw new Error(`Missing required argument: ${key}`);
  }
  return value;
};

const main = (): void => {
  const args = parseArgs();
  const repoRoot = resolveRepoRoot();

  const bookId = requireArg(args, "--book-id");
  const name = requireArg(args, "--name");
  const author = requireArg(args, "--author");
  const description = requireArg(args, "--description");

  const textFile = args["--text-file"] ?? path.resolve(
    repoRoot,
    "app",
    "client",
    "src",
    "content",
    "storyText.ts"
  );
  const taggedFile = args["--tagged-file"] ?? path.resolve(
    repoRoot,
    "scripts",
    "storyText-tagged.json"
  );
  const verbFormsFile = args["--verb-forms"] ?? path.resolve(
    repoRoot,
    "scripts",
    "verbForms.json"
  );
  const sentenceTranslationsFile = args["--sentence-translations"];
  const coverFile = args["--cover-file"];
  const outFile = args["--out"] ?? path.resolve(
    repoRoot,
    "db",
    `${bookId}.book.json`
  );

  const content = extractStoryText(textFile);
  const sentences = readTaggedSentences(taggedFile);
  const verbForms = readVerbForms(verbFormsFile);
  const sentenceTranslations = readSentenceTranslations(sentenceTranslationsFile);
  const cover = readCoverBase64(coverFile);

  const book: bookJson = {
    id: bookId,
    name,
    author,
    description,
    cover,
    content,
    parsedLemmas: {
      sentences,
      verbForms
    },
    sentenceTranslations
  };

  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, `${JSON.stringify(book, null, 2)}\n`, "utf8");
  console.log(`Wrote book json to ${outFile}`);
};

main();
