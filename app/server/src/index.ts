import "dotenv/config";
import crypto from "node:crypto";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { serve } from "@hono/node-server";
import OpenAI from "openai";
import { OAuth2Client } from "google-auth-library";
import { parseTranslationRequest } from "./utils/ParseTranslationRequest.js";
import { getBookDatabase } from "./db/BookDatabase.js";
import { getSentenceTranslationsDatabase, hashSentenceText } from "./db/SentenceTranslationDatabase.js";
import { getBookCatalogDatabase } from "./db/BookCatalogDatabase.js";
import { getAuthDatabase } from "./db/AuthDatabase.js";
import {
  getWiktionaryArticlesDatabase,
  resolveWiktionaryArticlesDbPath,
  type wiktionaryArticle,
  type wiktionaryTranslation
} from "./db/WiktionaryArticlesDatabase.js";
import { buildImageDataUrl } from "./utils/DetectImageMime.js";
import { buildWordCard } from "./utils/BuildWordCard.js";
import { boldFirstOccurrence } from "./utils/BuildUsageExamples.js";
import { createDictionaryArticle } from "./openai/CreateDictionaryArticle.js";

const SESSION_COOKIE = "reader-session";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SESSION_TTL_SECONDS = Math.floor(SESSION_TTL_MS / 1000);
const isSecureRequest = (context: Parameters<typeof setCookie>[0]): boolean => {
  const forwardedProto = context.req.header("x-forwarded-proto");
  if (forwardedProto) {
    return forwardedProto.split(",")[0].trim().toLowerCase() === "https";
  }

  try {
    return new URL(context.req.url).protocol === "https:";
  } catch {
    return false;
  }
};

const shouldSecureCookie = (context: Parameters<typeof setCookie>[0]): boolean => {
  if (typeof process.env.COOKIE_SECURE === "string") {
    return process.env.COOKIE_SECURE.toLowerCase() === "true";
  }

  if (process.env.NODE_ENV !== "production") {
    return false;
  }

  return isSecureRequest(context);
};

const setSessionCookie = (context: Parameters<typeof setCookie>[0], sessionId: string): void => {
  setCookie(context, SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "Lax",
    secure: shouldSecureCookie(context),
    path: "/",
    maxAge: SESSION_TTL_SECONDS
  });
};

const clearSessionCookie = (context: Parameters<typeof deleteCookie>[0]): void => {
  deleteCookie(context, SESSION_COOKIE, { path: "/" });
};

const OAUTH_STATE_COOKIE = "google-oauth-state";
const OAUTH_STATE_TTL_SECONDS = 10 * 60;

const getGoogleCredentials = (): {
  clientId: string;
  clientSecret: string;
  redirectUrl: string;
} => {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUrl = process.env.GOOGLE_REDIRECT_URL?.trim();
  if (!clientId || !clientSecret || !redirectUrl) {
    throw new Error(
      "GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URL must be configured."
    );
  }
  return { clientId, clientSecret, redirectUrl };
};

const getGoogleOAuthClient = (): OAuth2Client => {
  const credentials = getGoogleCredentials();
  return new OAuth2Client(
    credentials.clientId,
    credentials.clientSecret,
    credentials.redirectUrl
  );
};

const setOAuthStateCookie = (context: Parameters<typeof setCookie>[0], value: string): void => {
  setCookie(context, OAUTH_STATE_COOKIE, value, {
    httpOnly: true,
    sameSite: "Lax",
    secure: shouldSecureCookie(context),
    path: "/",
    maxAge: OAUTH_STATE_TTL_SECONDS
  });
};

const clearOAuthStateCookie = (context: Parameters<typeof deleteCookie>[0]): void => {
  deleteCookie(context, OAUTH_STATE_COOKIE, { path: "/" });
};

const redirectToLoginWithError = (context: Parameters<typeof setCookie>[0], errorCode: string): Response => {
  const search = new URLSearchParams({ error: errorCode }).toString();
  return context.redirect(`/login?${search}`);
};

const isSafeBookId = (value: string): boolean => {
  return /^[a-zA-Z0-9_-]+$/.test(value);
};

let openAiClient: OpenAI | null = null;

const getOpenAiClient = (): OpenAI => {
  if (openAiClient) {
    return openAiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }

  openAiClient = new OpenAI({ apiKey });
  return openAiClient;
};

const normalizeWordValue = (value: string): string => value.trim();

const buildCandidateKeys = (words: string[], positions: string[]): string[] => {
  const normalizedPositions = positions.map((pos) => pos.trim()).filter(Boolean);
  if (normalizedPositions.length === 0) {
    return [];
  }

  const keys: string[] = [];
  const seen = new Set<string>();
  for (const word of words) {
    const normalized = normalizeWordValue(word);
    if (!normalized) {
      continue;
    }
    for (const pos of normalizedPositions) {
      const key = `${normalized}-${pos}`;
      if (!seen.has(key)) {
        seen.add(key);
        keys.push(key);
      }
    }
  }
  return keys;
};

const buildPosCandidates = (pos: string, wordSurface: string): string[] => {
  const normalized = pos.trim();
  if (!normalized) {
    return [];
  }

  const mapping: Record<string, string> = {
    adjective: "adj",
    adverb: "adv",
    pronoun: "pron",
    determiner: "det",
    adposition: "prep",
    conjunction: "conj",
    number: "num",
    interjection: "intj",
    date: "num",
    noun: "noun",
    verb: "verb"
  };

  const candidates: string[] = [];
  const mapped = mapping[normalized] ?? normalized;
  candidates.push(mapped);
  if (mapped !== normalized) {
    candidates.push(normalized);
  }
  if (normalized === "determiner") {
    candidates.push("article");
  }
  if (normalized === "noun" && /^[A-ZÀ-ÖØ-Þ]/.test(wordSurface.trim())) {
    candidates.push("name");
  }

  return Array.from(new Set(candidates));
};

const collectGlosses = (
  translations: wiktionaryTranslation[],
  key: "english" | "russian",
  limit = 4
): string[] => {
  const values: string[] = [];
  const seen = new Set<string>();

  for (const entry of translations) {
    const raw = entry?.glosses?.[key]?.trim() ?? "";
    if (!raw) {
      continue;
    }
    const normalized = raw.toLocaleLowerCase();
    if (seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    values.push(raw);
    if (values.length >= limit) {
      break;
    }
  }

  return values;
};

const buildTranslationSummary = (article: wiktionaryArticle | null): {
  english: string;
  russian: string;
} => {
  if (!article) {
    return { english: "I don't know", russian: "I don't know" };
  }

  const english = collectGlosses(article.translations, "english").join("; ");
  const russian = collectGlosses(article.translations, "russian").join("; ");

  if (!english && !russian) {
    return { english: "I don't know", russian: "I don't know" };
  }

  return {
    english,
    russian
  };
};

const buildUsageExamplesFromArticle = (
  article: wiktionaryArticle | null,
  wordSurface: string,
  limit = 5
): Array<{ Portuguese: string; English: string; Russian: string }> => {
  if (!article) {
    return [];
  }

  const examples: Array<{ Portuguese: string; English: string; Russian: string }> = [];
  const seen = new Set<string>();

  for (const entry of article.translations) {
    const entryExamples = Array.isArray(entry.examples) ? entry.examples : [];
    for (const example of entryExamples) {
      const text = example.text?.trim() ?? "";
      const english = example.english?.trim() || example.translation?.trim() || "";
      const russian = example.russian?.trim() ?? "";
      if (!text || !english || !russian) {
        continue;
      }

      const key = `${text}::${english}::${russian}`;
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      const highlighted = wordSurface ? boldFirstOccurrence(text, wordSurface) : text;
      examples.push({
        Portuguese: highlighted,
        English: english,
        Russian: russian
      });

      if (examples.length >= limit) {
        return examples;
      }
    }
  }

  return examples;
};

const refreshSessionFromRequest = (
  context: Parameters<typeof getCookie>[0]
): { id: number; email: string } | null => {
  const sessionId = getCookie(context, SESSION_COOKIE);
  if (!sessionId) {
    return null;
  }

  const authDb = getAuthDatabase();
  const user = authDb.refreshSession(sessionId, SESSION_TTL_MS);
  if (!user) {
    clearSessionCookie(context);
    return null;
  }

  setSessionCookie(context, sessionId);
  return user;
};

const app = new Hono();

app.use(
  "*",
  cors({
    origin: "http://localhost:5173",
    credentials: true
  })
);

app.get("/health", (context): Response => {
  return context.json({ Status: "ok" });
});

app.get("/api/auth/google", (context): Response => {
  let oauthClient: OAuth2Client;
  try {
    oauthClient = getGoogleOAuthClient();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Google OAuth is not configured.";
    return context.json({ Error: message }, 500);
  }

  const state = crypto.randomBytes(16).toString("hex");
  setOAuthStateCookie(context, state);

  const authUrl = oauthClient.generateAuthUrl({
    scope: ["openid", "email", "profile"],
    state,
    prompt: "select_account"
  });

  return context.redirect(authUrl);
});

app.get("/api/oauth", async (context): Promise<Response> => {
  const oauthError = context.req.query("error");
  const code = context.req.query("code");
  const state = context.req.query("state");
  const storedState = getCookie(context, OAUTH_STATE_COOKIE);

  clearOAuthStateCookie(context);

  if (oauthError) {
    return redirectToLoginWithError(
      context,
      oauthError === "access_denied" ? "oauth_denied" : "oauth_failed"
    );
  }

  if (!code || !state || !storedState || storedState !== state) {
    return redirectToLoginWithError(context, "state_mismatch");
  }

  let oauthClient: OAuth2Client;
  let credentials: { clientId: string; clientSecret: string; redirectUrl: string };
  try {
    credentials = getGoogleCredentials();
    oauthClient = getGoogleOAuthClient();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Google OAuth is not configured.";
    return context.json({ Error: message }, 500);
  }

  const { tokens } = await oauthClient.getToken(code);
  if (!tokens.id_token) {
    return redirectToLoginWithError(context, "oauth_failed");
  }

  const ticket = await oauthClient.verifyIdToken({
    idToken: tokens.id_token,
    audience: credentials.clientId
  });
  const payload = ticket.getPayload();

  if (!payload?.email) {
    return redirectToLoginWithError(context, "oauth_failed");
  }

  if (payload.email_verified === false) {
    return redirectToLoginWithError(context, "email_unverified");
  }

  const authDb = getAuthDatabase();
  let user = authDb.getUserByEmail(payload.email);
  if (!user) {
    try {
      user = authDb.createOAuthUser(payload.email);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (message.toLowerCase().includes("unique")) {
        user = authDb.getUserByEmail(payload.email);
      }
    }
  }

  if (!user) {
    return redirectToLoginWithError(context, "oauth_failed");
  }

  const sessionId = authDb.createSession(user.id, SESSION_TTL_MS);
  setSessionCookie(context, sessionId);
  return context.redirect("/books");
});

app.get("/api/auth/session", (context): Response => {
  const user = refreshSessionFromRequest(context);
  if (!user) {
    return context.json({ Error: "Unauthorized." }, 401);
  }

  return context.json({ UserId: user.id, Email: user.email });
});

app.get("/api/books", (context): Response => {
  const user = refreshSessionFromRequest(context);
  if (!user) {
    return context.json({ Error: "Unauthorized." }, 401);
  }

  try {
    const catalogDb = getBookCatalogDatabase();
    let entries = catalogDb.listBooks();
    if (entries.length === 0) {
      catalogDb.syncFromBookDatabases();
      entries = catalogDb.listBooks();
    }

    const books = entries.map((entry) => {
      const coverImage = buildImageDataUrl(entry.coverBase64, entry.coverMime);
      return {
        Id: entry.id,
        Title: entry.title,
        Author: entry.author,
        Description: entry.description,
        Language: entry.language,
        CoverImage: coverImage ?? ""
      };
    });

    return context.json({ Books: books });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load books.";
    return context.json({ Error: message }, 500);
  }
});

app.get("/api/books/:id", (context): Response => {
  const user = refreshSessionFromRequest(context);
  if (!user) {
    return context.json({ Error: "Unauthorized." }, 401);
  }

  const bookId = context.req.param("id");
  if (!isSafeBookId(bookId)) {
    return context.json({ Error: "Invalid book id." }, 400);
  }

  try {
    const db = getBookDatabase(bookId);
    const catalog = getBookCatalogDatabase().getBook(bookId);
    const coverMime = catalog?.coverMime ?? "";
    const includeContentParam = context.req.query("includeContent");
    const includeContent = includeContentParam === undefined
      ? true
      : includeContentParam === "true" || includeContentParam === "1";

    const contentLength = db.getContentLength();
    const metaTitle = db.getMetaValue("name") ?? "";
    const metaAuthor = db.getMetaValue("author") ?? "";
    const metaDescription = db.getMetaValue("description") ?? "";
    const metaCover = db.getMetaValue("cover") ?? "";
    const metaLanguage = db.getMetaValue("language") ?? "";
    const metaId = db.getMetaValue("book_id") ?? bookId;
    const textHash = db.getMetaValue("text_hash") ?? "";
    const coverImage = buildImageDataUrl(metaCover, coverMime);
    const language = metaLanguage || catalog?.language || "pt-PT";
    const content = includeContent ? db.getContentSlice(0, contentLength) : undefined;

    return context.json({
      Id: metaId,
      Title: metaTitle,
      Author: metaAuthor,
      Description: metaDescription,
      Language: language,
      CoverImage: coverImage ?? "",
      Content: content,
      ContentLength: contentLength,
      TextHash: textHash
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Book not found.";
    const status = message.toLowerCase().includes("not found") ? 404 : 500;
    const responseMessage = status === 404 ? "Book not found." : "Failed to load book.";
    return context.json({ Error: responseMessage }, status);
  }
});

app.get("/api/books/:id/content", (context): Response => {
  const user = refreshSessionFromRequest(context);
  if (!user) {
    return context.json({ Error: "Unauthorized." }, 401);
  }

  const bookId = context.req.param("id");
  if (!isSafeBookId(bookId)) {
    return context.json({ Error: "Invalid book id." }, 400);
  }

  const offsetParam = context.req.query("offset") ?? "0";
  const lengthParam = context.req.query("length") ?? "0";
  const offset = Number.parseInt(offsetParam, 10);
  const length = Number.parseInt(lengthParam, 10);

  if (!Number.isFinite(offset) || offset < 0 || !Number.isFinite(length) || length <= 0) {
    return context.json({ Error: "Invalid offset or length." }, 400);
  }

  try {
    const db = getBookDatabase(bookId);
    const totalLength = db.getContentLength();
    const safeOffset = Math.min(Math.max(offset, 0), totalLength);
    const safeLength = Math.min(Math.max(length, 0), Math.max(totalLength - safeOffset, 0));
    const content = safeLength > 0 ? db.getContentSlice(safeOffset, safeLength) : "";

    return context.json({
      Id: bookId,
      Offset: safeOffset,
      Length: content.length,
      TotalLength: totalLength,
      Content: content
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Book not found.";
    const status = message.toLowerCase().includes("not found") ? 404 : 500;
    const responseMessage = status === 404 ? "Book not found." : "Failed to load book.";
    return context.json({ Error: responseMessage }, status);
  }
});

app.post("/api/translate", async (context): Promise<Response> => {
  const user = refreshSessionFromRequest(context);
  if (!user) {
    return context.json({ Error: "Unauthorized." }, 401);
  }

  const body = await context.req.json();
  const translationRequest = parseTranslationRequest(body);

  if (!translationRequest) {
    return context.json({ Error: "Invalid request." }, 400);
  }

  if (!isSafeBookId(translationRequest.BookId)) {
    return context.json({ Error: "Invalid book id." }, 400);
  }

  try {
    const db = getBookDatabase(translationRequest.BookId);
    const token = db.findTokenBySpan(translationRequest.TokenStart, translationRequest.TokenEnd);

    if (!token) {
      return context.json({ Error: "Token not found for selection." }, 404);
    }

    const wordSurface = token.surface?.trim() || token.form.replace(/_/g, " ") || translationRequest.Word;
    const normalizedWord = wordSurface.trim();
    const shouldForceOpenAi = translationRequest.ForceOpenAI === true;

    const sentenceDb = getSentenceTranslationsDatabase(translationRequest.BookId);
    let sentenceRecord = sentenceDb?.findBySpan(token.begin, token.end) ?? null;
    if (!sentenceRecord && sentenceDb) {
      const contextSentence = translationRequest.ContextSentence.trim();
      if (contextSentence) {
        const sentenceHash = hashSentenceText(contextSentence);
        sentenceRecord =
          sentenceDb.findByHash(sentenceHash) ??
          sentenceDb.findByText(contextSentence) ??
          null;
      }
    }

    const sentenceTranslation = sentenceRecord
      ? {
          portuguese: boldFirstOccurrence(sentenceRecord.text, wordSurface),
          russian: sentenceRecord.translation
        }
      : undefined;

    const wiktionaryDb = getWiktionaryArticlesDatabase();
    if (!wiktionaryDb) {
      const dbPath = resolveWiktionaryArticlesDbPath();
      throw new Error(`Wiktionary articles database not found: ${dbPath}`);
    }

    const posCandidates = buildPosCandidates(token.pos ?? "", normalizedWord);
    const lemmaValue = token.lemma?.trim() ?? "";
    const preferLemma = (token.pos === "verb" || token.pos === "noun") && lemmaValue;
    const candidateWords = preferLemma
      ? [
          lemmaValue,
          lemmaValue.toLocaleLowerCase(),
          normalizedWord,
          normalizedWord.toLocaleLowerCase(),
          translationRequest.Word?.trim() ?? "",
          (translationRequest.Word ?? "").trim().toLocaleLowerCase()
        ]
      : [
          normalizedWord,
          normalizedWord.toLocaleLowerCase(),
          lemmaValue,
          lemmaValue.toLocaleLowerCase(),
          translationRequest.Word?.trim() ?? "",
          (translationRequest.Word ?? "").trim().toLocaleLowerCase()
        ];
    const candidateKeys = buildCandidateKeys(candidateWords, posCandidates);

    let article: wiktionaryArticle | null = null;
    for (const key of candidateKeys) {
      article = wiktionaryDb.findByKey(key);
      if (article) {
        break;
      }
    }

    const fallbackArticle = article;
    if (!article || shouldForceOpenAi) {
      const openAiClient = getOpenAiClient();
      const partOfSpeech = posCandidates[0] ?? token.pos ?? "";
      const preferredWord = token.lemma?.trim() || normalizedWord;
      const generated = await createDictionaryArticle(openAiClient, {
        word: preferredWord,
        lemma: token.lemma,
        partOfSpeech,
        sentence: translationRequest.ContextSentence,
        sourceLanguage: translationRequest.SourceLanguage
      });

      if (generated.translations.length > 0) {
        const now = Date.now();
        const articleKey = `${generated.word}-${generated.pos}`;
        wiktionaryDb.upsertArticle({
          key: articleKey,
          word: generated.word,
          pos: generated.pos,
          translations: generated.translations,
          source: "openai",
          updatedAt: now
        });
        article = {
          word: generated.word,
          pos: generated.pos,
          translations: generated.translations,
          source: "openai",
          updatedAt: now
        };
      } else if (shouldForceOpenAi && fallbackArticle) {
        article = fallbackArticle;
      }
    }

    const usageExamples = buildUsageExamplesFromArticle(article, normalizedWord);
    const translationSummary = buildTranslationSummary(article);

    const verbFormDetails = db.getVerbForms(token.lemma);
    const wordCardBase = buildWordCard(token, verbFormDetails.rows, verbFormDetails.isIrregular);
    const wordCard = sentenceTranslation
      ? { ...wordCardBase, sentenceTranslation }
      : wordCardBase;

    return context.json({
      TranslationEnglish: translationSummary.english,
      TranslationRussian: translationSummary.russian,
      IsPending: false,
      UsageExamples: usageExamples,
      WordCard: wordCard
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Translation failed.";
    return context.json({ Error: message }, 500);
  }
});

const port = Number(process.env.PORT ?? "8787");
serve({ fetch: app.fetch, port });

console.log(`Server running on http://localhost:${port}`);
