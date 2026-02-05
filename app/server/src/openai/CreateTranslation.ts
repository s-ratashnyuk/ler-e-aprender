import OpenAI from "openai";
import type { translationRequest } from "../contracts/TranslationRequest.js";
import type { translationResponse } from "../contracts/TranslationResponse.js";
import { buildSystemInstructions } from "./BuildSystemInstructions.js";
import { buildUserPrompt } from "./BuildUserPrompt.js";
import { parseTranslationResponse } from "./ParseTranslationResponse.js";

const translationResponseSchema: Record<string, unknown> = {
  type: "object",
  additionalProperties: false,
  properties: {
    Translation: { type: "string" },
    PartOfSpeech: { type: "string" },
    Gender: { type: "string" },
    Tense: { type: "string" },
    Infinitive: { type: "string" },
    IsIrregular: { type: "boolean" },
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
    },
    VerbForms: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          Tense: { type: "string" },
          Forms: { type: "string" }
        },
        required: ["Tense", "Forms"]
      }
    }
  },
  required: [
    "Translation",
    "PartOfSpeech",
    "Gender",
    "Tense",
    "Infinitive",
    "IsIrregular",
    "UsageExamples",
    "VerbForms"
  ]
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

export const createTranslation = async (
  openAiClient: OpenAI,
  request: translationRequest
): Promise<translationResponse> => {
  const response = await openAiClient.responses.create({
    model: "gpt-4o-mini",
    instructions: buildSystemInstructions(),
    input: buildUserPrompt(request),
    text: {
      format: {
        type: "json_schema",
        name: "translation_response",
        description: "Translation response for the reader popup",
        schema: translationResponseSchema,
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

  return parseTranslationResponse(outputText);
};
