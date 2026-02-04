import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import OpenAI from "openai";
import { createWordAndSentenceTranslation } from "./openai/CreateWordAndSentenceTranslation";
import { parseTranslationRequest } from "./utils/ParseTranslationRequest";
import { requireEnv } from "./utils/RequireEnv";
import { getBookDatabase, hashContext } from "./db/BookDatabase";
import { buildWordCard } from "./utils/BuildWordCard";

const openAiKey = requireEnv("OPENAI_API_KEY");
const openAiClient = new OpenAI({ apiKey: openAiKey });
const inflightTranslations = new Map<string, Promise<void>>();

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
    origin: "http://localhost:5173"
  })
);

app.get("/health", (context): Response => {
  return context.json({ Status: "ok" });
});

app.post("/api/translate", async (context): Promise<Response> => {
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
      IsPending: shouldQueueTranslation,
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
