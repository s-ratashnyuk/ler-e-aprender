import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import OpenAI from "openai";
import { createTranslation } from "./openai/CreateTranslation";
import { parseTranslationRequest } from "./utils/ParseTranslationRequest";
import { requireEnv } from "./utils/RequireEnv";

const openAiKey = requireEnv("OPENAI_API_KEY");
const openAiClient = new OpenAI({ apiKey: openAiKey });

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
    const translation = await createTranslation(openAiClient, translationRequest);
    return context.json(translation);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Translation failed.";
    return context.json({ Error: message }, 500);
  }
});

const port = Number(process.env.PORT ?? "8787");
serve({ fetch: app.fetch, port });

console.log(`Server running on http://localhost:${port}`);
