import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import OpenAI from "openai";
import CreateTranslation from "./openai/CreateTranslation";
import ParseTranslationRequest from "./utils/ParseTranslationRequest";
import RequireEnv from "./utils/RequireEnv";

const OpenAiKey = RequireEnv("OPENAI_API_KEY");
const OpenAiClient = new OpenAI({ apiKey: OpenAiKey });

const App = new Hono();

App.use(
  "*",
  cors({
    origin: "http://localhost:5173"
  })
);

App.get("/health", (Context): Response => {
  return Context.json({ Status: "ok" });
});

App.post("/api/translate", async (Context): Promise<Response> => {
  const Body = await Context.req.json();
  const TranslationRequest = ParseTranslationRequest(Body);

  if (!TranslationRequest) {
    return Context.json({ Error: "Invalid request." }, 400);
  }

  try {
    const Translation = await CreateTranslation(OpenAiClient, TranslationRequest);
    return Context.json(Translation);
  } catch (error) {
    const Message = error instanceof Error ? error.message : "Translation failed.";
    return Context.json({ Error: Message }, 500);
  }
});

const Port = Number(process.env.PORT ?? "8787");
serve({ fetch: App.fetch, port: Port });

console.log(`Server running on http://localhost:${Port}`);
