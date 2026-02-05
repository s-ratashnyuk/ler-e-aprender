import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import { serve } from "@hono/node-server";
import OpenAI from "openai";
import { createWordAndSentenceTranslation } from "./openai/CreateWordAndSentenceTranslation.js";
import { parseTranslationRequest } from "./utils/ParseTranslationRequest.js";
import { requireEnv } from "./utils/RequireEnv.js";
import { getBookDatabase, hashContext } from "./db/BookDatabase.js";
import { buildWordCard } from "./utils/BuildWordCard.js";
import { getAuthDatabase } from "./db/AuthDatabase.js";

type authPayload = {
  email: string;
  passwordHash: string;
};

const parseAuthPayload = (value: unknown): authPayload | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const record = value as Record<string, unknown>;
  if (typeof record.email !== "string" || typeof record.passwordHash !== "string") {
    return null;
  }

  return {
    email: record.email,
    passwordHash: record.passwordHash
  };
};

const openAiKey = requireEnv("OPENAI_API_KEY");
const openAiClient = new OpenAI({ apiKey: openAiKey });
const inflightTranslations = new Map<string, Promise<void>>();
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

const queueTranslation = (key: string, task: () => Promise<void>): void => {
  if (inflightTranslations.has(key)) {
    return;
  }

  const promise = (async (): Promise<void> => {
    try {
      await task();
    } catch (error) {
      console.error("Translation background task failed.", error);
    } finally {
      inflightTranslations.delete(key);
    }
  })();

  inflightTranslations.set(key, promise);
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

app.post("/api/auth/signup", async (context): Promise<Response> => {
  const body = await context.req.json();
  const payload = parseAuthPayload(body);

  if (!payload) {
    return context.json({ Error: "Invalid request." }, 400);
  }

  try {
    const authDb = getAuthDatabase();
    const user = authDb.createUser(payload.email, payload.passwordHash);
    const sessionId = authDb.createSession(user.id, SESSION_TTL_MS);
    setSessionCookie(context, sessionId);
    return context.json({ UserId: user.id, Email: user.email });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Signup failed.";
    if (message.toLowerCase().includes("unique")) {
      return context.json({ Error: "Email already registered." }, 409);
    }
    return context.json({ Error: message }, 500);
  }
});

app.post("/api/auth/login", async (context): Promise<Response> => {
  const body = await context.req.json();
  const payload = parseAuthPayload(body);

  if (!payload) {
    return context.json({ Error: "Invalid request." }, 400);
  }

  try {
    const authDb = getAuthDatabase();
    const user = authDb.verifyUser(payload.email, payload.passwordHash);
    if (!user) {
      return context.json({ Error: "Invalid email or password." }, 401);
    }
    const sessionId = authDb.createSession(user.id, SESSION_TTL_MS);
    setSessionCookie(context, sessionId);
    return context.json({ UserId: user.id, Email: user.email });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Login failed.";
    return context.json({ Error: message }, 500);
  }
});

app.get("/api/auth/session", (context): Response => {
  const user = refreshSessionFromRequest(context);
  if (!user) {
    return context.json({ Error: "Unauthorized." }, 401);
  }

  return context.json({ UserId: user.id, Email: user.email });
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

  try {
    const db = getBookDatabase(translationRequest.BookId);
    const token = db.findTokenBySpan(translationRequest.TokenStart, translationRequest.TokenEnd);

    if (!token) {
      return context.json({ Error: "Token not found for selection." }, 404);
    }

    const wordSurface = token.surface?.trim() || token.form.replace(/_/g, " ") || translationRequest.Word;
    const { rows: verbForms, isIrregular } = db.getVerbForms(token.lemma);
    const card = buildWordCard(token, verbForms, isIrregular);
    const contextHash = hashContext(translationRequest.ContextSentence);
    const cacheKey = `${token.id}:${contextHash}:${translationRequest.TargetLanguage}`;

    const shouldForceRefresh = translationRequest.ForceRefresh === true;
    const cached = db.getCachedTranslation(
      token.id,
      contextHash,
      translationRequest.TargetLanguage
    );
    const shouldQueueTranslation = !cached || shouldForceRefresh;

    if (shouldQueueTranslation) {
      queueTranslation(cacheKey, async () => {
        const translation = await createWordAndSentenceTranslation(openAiClient, {
          word: wordSurface,
          lemma: token.lemma,
          partOfSpeech: card.partOfSpeech,
          sentence: translationRequest.ContextSentence,
          sourceLanguage: translationRequest.SourceLanguage,
          targetLanguage: translationRequest.TargetLanguage
        });

        const normalizedTranslation = translation.Translation.trim() || "I don't know";
        const usageExamples =
          normalizedTranslation === "I don't know" ? [] : translation.UsageExamples;

        db.upsertCachedTranslation(
          token.id,
          contextHash,
          translationRequest.ContextSentence,
          translationRequest.TargetLanguage,
          normalizedTranslation,
          JSON.stringify(usageExamples)
        );
      });
    }

    const isPending = inflightTranslations.has(cacheKey) || shouldQueueTranslation;
    const rawWordTranslation = cached?.wordTranslation ?? "";
    const usageExamples = (() => {
      try {
        const parsed = JSON.parse(cached?.usageExamplesJson ?? "[]") as Array<{
          Portuguese: string;
          Translation: string;
        }>;
        if (Array.isArray(parsed)) {
          return parsed;
        }
      } catch {
        // ignore
      }
      return [];
    })();
    const wordTranslation = rawWordTranslation.includes("<b>")
      ? rawWordTranslation
      : rawWordTranslation === "I don't know" || !rawWordTranslation.trim()
        ? rawWordTranslation
        : `<b>${rawWordTranslation}</b>`;
    const safeUsageExamples = rawWordTranslation === "I don't know" ? [] : usageExamples;
    if (safeUsageExamples.length > 0) {
      const [first, ...rest] = safeUsageExamples;
      safeUsageExamples.splice(0, safeUsageExamples.length, {
        Portuguese: translationRequest.ContextSentence,
        Translation: first.Translation
      }, ...rest);
    }

    return context.json({
      Translation: wordTranslation,
      PartOfSpeech: card.partOfSpeech,
      Gender: card.gender,
      Tense: card.tense,
      Infinitive: card.infinitive,
      IsIrregular: card.isIrregular,
      IsPending: isPending,
      UsageExamples: safeUsageExamples,
      VerbForms: card.verbForms
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Translation failed.";
    return context.json({ Error: message }, 500);
  }
});

const port = Number(process.env.PORT ?? "8787");
serve({ fetch: app.fetch, port });

console.log(`Server running on http://localhost:${port}`);
