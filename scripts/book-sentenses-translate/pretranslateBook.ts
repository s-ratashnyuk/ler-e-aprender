import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";

type SentenceSlice = {
  index: number;
  rawStart: number;
  rawEnd: number;
  start: number;
  end: number;
  text: string;
  hash: string;
};

type SentenceTranslation = SentenceSlice & {
  translation: string;
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

const hashString = (value: string): string => {
  return crypto.createHash("sha1").update(value).digest("hex");
};

const splitSentences = (text: string, locale: string): SentenceSlice[] => {
  const segmenter = new Intl.Segmenter(locale, { granularity: "sentence" });
  const segments = segmenter.segment(text);
  const results: SentenceSlice[] = [];
  let index = 0;

  for (const segment of segments) {
    const rawStart = segment.index ?? 0;
    const rawEnd = rawStart + segment.segment.length;

    const leading = segment.segment.match(/^\s*/)?.[0].length ?? 0;
    const trailing = segment.segment.match(/\s*$/)?.[0].length ?? 0;
    const start = rawStart + leading;
    const end = rawEnd - trailing;

    if (start >= end) {
      continue;
    }

    const sentenceText = text.slice(start, end);
    results.push({
      index,
      rawStart,
      rawEnd,
      start,
      end,
      text: sentenceText,
      hash: hashString(sentenceText),
    });
    index += 1;
  }

  return results;
};

const extractTranslation = (payload: unknown): string => {
  if (typeof payload === "string") {
    return payload;
  }
  if (!payload || typeof payload !== "object") {
    throw new Error("Translation response was not JSON.");
  }

  const record = payload as Record<string, unknown>;
  const candidates = [
    "Translation",
    "translation",
    "TranslatedText",
    "translatedText",
    "Result",
    "result",
    "Text",
    "text",
  ];
  for (const key of candidates) {
    if (typeof record[key] === "string") {
      return record[key] as string;
    }
  }

  throw new Error(`Unexpected translation payload: ${JSON.stringify(payload).slice(0, 200)}`);
};

const translateText = async (
  text: string,
  serviceUrl: string,
  sourceLanguage: string,
  targetLanguage: string
): Promise<string> => {
  const response = await fetch(serviceUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      Text: text,
      SourceLanguage: sourceLanguage,
      TargetLanguage: targetLanguage,
    }),
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(`Translation failed (${response.status}): ${payload}`);
  }

  const payload = (await response.json()) as unknown;
  return extractTranslation(payload);
};

const translateBatch = async <T, R>(
  items: T[],
  concurrency: number,
  task: (item: T, index: number) => Promise<R>
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  const safeConcurrency = Math.max(1, Math.floor(concurrency));

  for (let offset = 0; offset < items.length; offset += safeConcurrency) {
    const batch = items.slice(offset, offset + safeConcurrency);
    const batchResults = await Promise.all(
      batch.map((item, idx) => task(item, offset + idx))
    );
    for (let idx = 0; idx < batchResults.length; idx += 1) {
      results[offset + idx] = batchResults[idx];
    }
    const done = Math.min(offset + safeConcurrency, items.length);
    console.log(`Translated ${done}/${items.length}`);
  }

  return results;
};

const ensureDir = (dirPath: string): void => {
  fs.mkdirSync(dirPath, { recursive: true });
};

const main = async (): Promise<void> => {
  const args = parseArgs();
  const repoRoot = resolveRepoRoot();

  const bookTextPath =
    args["--book-text"] ??
    path.resolve(repoRoot, "books", "chamo-me-sophia", "book-text.txt");
  const outDir =
    args["--out-dir"] ?? path.resolve(path.dirname(bookTextPath), "pretranslations");

  const sourceLanguage = args["--source-language"] ?? "Portuguese (Portugal)";
  const targetLanguage = args["--target-language"] ?? "Russo";
  const serviceUrl = args["--service-url"] ?? "http://192.168.137.3:8000/translate";
  const locale = args["--locale"] ?? "pt";
  const concurrency = Number(args["--concurrency"] ?? "1");

  const bookText = fs.readFileSync(bookTextPath, "utf8");
  const sentenceSlices = splitSentences(bookText, locale);

  console.log(`Found ${sentenceSlices.length} sentences.`);

  const sentenceTranslations = await translateBatch(
    sentenceSlices,
    concurrency,
    async (sentence): Promise<SentenceTranslation> => {
      const translation = await translateText(
        sentence.text,
        serviceUrl,
        sourceLanguage,
        targetLanguage
      );
      return { ...sentence, translation };
    }
  );

  const sentenceOutput = {
    meta: {
      bookTextPath: path.resolve(bookTextPath),
      bookTextHash: hashString(bookText),
      sourceLanguage,
      targetLanguage,
      locale,
      createdAt: new Date().toISOString(),
      sentenceCount: sentenceTranslations.length,
      serviceUrl,
    },
    sentences: sentenceTranslations,
  };

  ensureDir(outDir);
  const sentenceOutPath = path.resolve(outDir, "sentence-translations.json");

  fs.writeFileSync(sentenceOutPath, JSON.stringify(sentenceOutput, null, 2));

  console.log(`Wrote ${sentenceOutPath}`);
};

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
