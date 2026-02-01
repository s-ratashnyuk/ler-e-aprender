import OpenAI from "openai";
import type { translationRequest } from "../contracts/TranslationRequest";
import type { translationResponse } from "../contracts/TranslationResponse";
import { buildSystemInstructions } from "./BuildSystemInstructions";
import { buildUserPrompt } from "./BuildUserPrompt";
import { parseTranslationResponse } from "./ParseTranslationResponse";

export const createTranslation = async (
  openAiClient: OpenAI,
  request: translationRequest
): Promise<translationResponse> => {
  const response = await openAiClient.responses.create({
    model: "gpt-4.1-mini",
    instructions: buildSystemInstructions(),
    input: buildUserPrompt(request),
    temperature: 0.2,
    max_output_tokens: 600,
    text: {
      format: {
        type: "json_object"
      }
    }
  });

  const outputText = response.output_text ?? "";
  if (!outputText) {
    throw new Error("Empty response from OpenAI.");
  }

  return parseTranslationResponse(outputText);
};
