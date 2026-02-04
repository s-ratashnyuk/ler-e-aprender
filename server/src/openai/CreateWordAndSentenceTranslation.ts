import OpenAI from "openai";
import { extractFirstJsonObject } from "../utils/ExtractFirstJsonObject";

export type wordAndSentenceTranslation = {
  Translation: string;
  UsageExamples: Array<{ Portuguese: string; Translation: string }>;
};

export type wordAndSentenceInput = {
  word: string;
  lemma: string;
  partOfSpeech: string;
  sentence: string;
  sourceLanguage: string;
  targetLanguage: string;
};

const responseSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    Translation: { type: "string" },
    UsageExamples: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          Portuguese: { type: "string" },
          Translation: { type: "string" }
        },
        required: ["Portuguese", "Translation"]
      }
    }
  },
  required: ["Translation", "UsageExamples"]
};

const buildSystemInstructions = (): string => {
  return [
    "You are a concise translation helper.",
    "Return JSON only with keys: Translation, UsageExamples.",
    "Translation: target-language meaning of the word/expression in this sentence (<= 6 words) or \"I don't know\".",
    "UsageExamples: array of {Portuguese, Translation}.",
    "UsageExamples[0] must be the provided sentence exactly.",
    "All translated text must be in the target language only (Translation and UsageExamples.Translation); never output English.",
    "If the target language is Russian, use Cyrillic for all translated text.",
    "In UsageExamples translations, bold the translated word/expression with <b>...</b>.",
    "If Translation is \"I don't know\", return an empty array."
  ].join("\n");
};

const buildUserPrompt = (input: wordAndSentenceInput): string => {
  return [
    `Source language: ${input.sourceLanguage}`,
    `Target language: ${input.targetLanguage}`,
    `Word/Expression: ${input.word}`,
    `Lemma: ${input.lemma}`,
    `Part of speech: ${input.partOfSpeech}`,
    `Sentence: ${input.sentence}`,
    "Task: Translate the word/expression in context and provide 5 usage examples.",
    "UsageExamples[0] must use the given sentence exactly.",
    "All translated text must be in the target language only (Translation and UsageExamples.Translation). Do not use English.",
    "In each example translation, bold only the translated word/expression using <b>...</b>.",
    "If the word is part of a fixed expression, bold the full translated expression."
  ].join("\n");
};

const getResponseOutputText = (response: OpenAI.Responses.Response): string => {
  if (response.output_text?.trim()) {
    return response.output_text;
  }

  const chunks: string[] = [];
  for (const item of response.output ?? []) {
    if (item.type !== "message") {
      continue;
    }

    for (const content of item.content ?? []) {
      if (content.type === "output_text") {
        chunks.push(content.text);
      } else if (content.type === "refusal") {
        throw new Error(content.refusal || "Model refused to answer.");
      }
    }
  }

  return chunks.join("").trim();
};

export const createWordAndSentenceTranslation = async (
  openAiClient: OpenAI,
  input: wordAndSentenceInput
): Promise<wordAndSentenceTranslation> => {
  const response = await openAiClient.responses.create({
    model: "gpt-4o-mini",
    instructions: buildSystemInstructions(),
    input: buildUserPrompt(input),
    text: {
      format: {
        type: "json_schema",
        name: "word_translation_examples",
        description: "Word translation with usage examples",
        schema: responseSchema,
        strict: true
      }
    }
  });

  if (response.error) {
    throw new Error(response.error.message || "OpenAI response error.");
  }

  const outputText = getResponseOutputText(response);
  if (!outputText) {
    throw new Error("Empty response from OpenAI.");
  }

  const jsonText = extractFirstJsonObject(outputText);
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  const translation = parsed.Translation;
  const usageExamples = parsed.UsageExamples;

  if (typeof translation !== "string" || !Array.isArray(usageExamples)) {
    throw new Error("Invalid word translation response shape.");
  }

  const normalizedExamples = usageExamples.map((example) => {
    if (!example || typeof example !== "object") {
      throw new Error("Invalid usage example entry.");
    }

    const record = example as Record<string, unknown>;
    if (typeof record.Portuguese !== "string" || typeof record.Translation !== "string") {
      throw new Error("Invalid usage example entry.");
    }

    return {
      Portuguese: record.Portuguese,
      Translation: record.Translation
    };
  });

  return {
    Translation: translation,
    UsageExamples: normalizedExamples
  };
};
