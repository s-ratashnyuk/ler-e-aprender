import OpenAI from "openai";
import { extractFirstJsonObject } from "../utils/ExtractFirstJsonObject.js";

export type dictionaryArticle = {
  word: string;
  pos: string;
  translations: Array<{
    glosses: {
      english: string;
      russian: string;
    };
    examples: Array<{
      text: string;
      english: string;
      russian: string;
    }>;
  }>;
};

export type dictionaryArticleInput = {
  word: string;
  lemma: string;
  partOfSpeech: string;
  sentence: string;
  sourceLanguage: string;
};

const responseSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    word: { type: "string" },
    pos: { type: "string" },
    translations: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          glosses: {
            type: "object",
            additionalProperties: false,
            properties: {
              english: { type: "string" },
              russian: { type: "string" }
            },
            required: ["english", "russian"]
          },
          examples: {
            type: "array",
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                text: { type: "string" },
                english: { type: "string" },
                russian: { type: "string" }
              },
              required: ["text", "english", "russian"]
            }
          }
        },
        required: ["glosses", "examples"]
      }
    }
  },
  required: ["word", "pos", "translations"]
};

const buildSystemInstructions = (): string => {
  return [
    "You are a bilingual lexicographer for Portuguese (Portugal).",
    "Return JSON only with keys: word, pos, translations.",
    "translations is an array of senses. Each sense has glosses and examples.",
    "glosses must include english and russian strings describing the meaning.",
    "examples is an array of {text, english, russian}.",
    "text must be Portuguese and include the given word form when possible.",
    "english and russian are translations of the Portuguese example sentence.",
    "Provide 2-6 senses if they exist; keep each gloss concise.",
    "Provide 1-3 examples per sense when possible; keep examples short.",
    "If you are unsure, return an empty translations array.",
    "Do not include any extra keys or commentary."
  ].join("\n");
};

const buildUserPrompt = (input: dictionaryArticleInput): string => {
  return [
    `Word: ${input.word}`,
    `Lemma: ${input.lemma}`,
    `Part of speech: ${input.partOfSpeech}`,
    `Source language: ${input.sourceLanguage}`,
    `Context sentence (use as example 1 if helpful): ${input.sentence}`,
    "Task: Build a dictionary-like entry with multiple meanings and usage examples.",
    "Include the context sentence as an example if it fits the word sense.",
    "Use English and Russian for glosses and example translations."
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

export const createDictionaryArticle = async (
  openAiClient: OpenAI,
  input: dictionaryArticleInput
): Promise<dictionaryArticle> => {
  const response = await openAiClient.responses.create({
    model: "gpt-4o-mini",
    instructions: buildSystemInstructions(),
    input: buildUserPrompt(input),
    text: {
      format: {
        type: "json_schema",
        name: "dictionary_article",
        description: "Dictionary-like word article",
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

  if (
    typeof parsed.word !== "string" ||
    typeof parsed.pos !== "string" ||
    !Array.isArray(parsed.translations)
  ) {
    throw new Error("Invalid dictionary article response shape.");
  }

  const translations = parsed.translations.map((entry) => {
    if (!entry || typeof entry !== "object") {
      throw new Error("Invalid dictionary translation entry.");
    }
    const record = entry as Record<string, unknown>;
    const glosses = record.glosses as Record<string, unknown> | undefined;
    const examples = record.examples;
    if (
      !glosses ||
      typeof glosses.english !== "string" ||
      typeof glosses.russian !== "string" ||
      !Array.isArray(examples)
    ) {
      throw new Error("Invalid dictionary translation entry.");
    }

    const normalizedExamples = examples.map((example) => {
      if (!example || typeof example !== "object") {
        throw new Error("Invalid dictionary example entry.");
      }
      const exampleRecord = example as Record<string, unknown>;
      if (
        typeof exampleRecord.text !== "string" ||
        typeof exampleRecord.english !== "string" ||
        typeof exampleRecord.russian !== "string"
      ) {
        throw new Error("Invalid dictionary example entry.");
      }

      return {
        text: exampleRecord.text,
        english: exampleRecord.english,
        russian: exampleRecord.russian
      };
    });

    return {
      glosses: {
        english: glosses.english,
        russian: glosses.russian
      },
      examples: normalizedExamples
    };
  });

  return {
    word: parsed.word,
    pos: parsed.pos,
    translations
  };
};
