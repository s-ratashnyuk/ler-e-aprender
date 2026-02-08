import fs from "node:fs";
import path from "node:path";
import { ingestBookUpload, parseBookUpload } from "../app/server/src/utils/BookUpload.js";

const usage = `
Usage:
  tsx scripts/ingestBook.ts --book-json <path> [--language <code>]

Options:
  --book-json <path>   Path to prepared book JSON (output of scripts/prepareBook.sh)
  --language <code>   Override language (defaults to payload or pt-PT)
  --help              Show this help
`.trim();

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

const loadEnvFile = (filePath: string): boolean => {
  if (!fs.existsSync(filePath)) {
    return false;
  }

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const normalized = trimmed.startsWith("export ") ? trimmed.slice(7).trim() : trimmed;
    const equalsIndex = normalized.indexOf("=");
    if (equalsIndex <= 0) {
      continue;
    }
    const key = normalized.slice(0, equalsIndex).trim();
    let value = normalized.slice(equalsIndex + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }

  return true;
};

const normalizeDatabaseEnv = (serverDir: string, hadDatabasePath: boolean, envLoaded: boolean): void => {
  if (hadDatabasePath || !envLoaded) {
    return;
  }
  const dbPath = process.env.DATABASE_PATH;
  if (!dbPath || path.isAbsolute(dbPath)) {
    return;
  }
  process.env.DATABASE_PATH = path.resolve(serverDir, dbPath);
};

const readJsonFile = (filePath: string): unknown => {
  const content = fs.readFileSync(filePath, "utf8").trim();
  if (!content) {
    throw new Error(`Book JSON is empty: ${filePath}`);
  }
  return JSON.parse(content);
};

const resolveInputPath = (value: string): string => {
  return path.isAbsolute(value) ? value : path.resolve(process.cwd(), value);
};

const main = (): void => {
  const args = parseArgs();
  if (args["--help"] === "true") {
    console.log(usage);
    return;
  }

  const repoRoot = resolveRepoRoot();
  const serverDir = path.resolve(repoRoot, "app", "server");
  const envPath = path.resolve(serverDir, ".env");
  const hadDatabasePath = typeof process.env.DATABASE_PATH === "string";
  const envLoaded = loadEnvFile(envPath);
  normalizeDatabaseEnv(serverDir, hadDatabasePath, envLoaded);

  const bookJsonPath = args["--book-json"];
  if (!bookJsonPath || bookJsonPath === "true") {
    console.error(usage);
    process.exit(1);
  }

  const resolvedBookJsonPath = resolveInputPath(bookJsonPath);
  const payload = readJsonFile(resolvedBookJsonPath);

  if (args["--language"] && payload && typeof payload === "object") {
    (payload as Record<string, unknown>).language = args["--language"];
  }

  const parsed = parseBookUpload(payload);
  if ("error" in parsed) {
    throw new Error(parsed.error);
  }

  const result = ingestBookUpload(parsed.payload);
  console.log(`Ingested ${result.sentenceCount} sentences into ${result.dbPath}`);
  console.log(`Tokens: ${result.tokenCount}`);
  console.log(`Verb forms: ${result.verbFormCount}`);
  if (result.sentenceTranslationDbPath) {
    console.log(`Stored ${result.sentenceTranslationCount} sentence translations into ${result.sentenceTranslationDbPath}`);
  }
};

main();
