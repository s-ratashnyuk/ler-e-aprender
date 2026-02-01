import type { translationRequest } from "../contracts/TranslationRequest";

export const buildUserPrompt = (request: translationRequest): string => {
  return [
    `Source language: ${request.SourceLanguage}`,
    `Target language: ${request.TargetLanguage}`,
    `Word: ${request.Word}`,
    `Context left: ${request.ContextLeft}`,
    `Context right: ${request.ContextRight}`,
    "Task: Translate only the word using the context to disambiguate.",
    "Include verb form details if applicable.",
    "Return the result as json."
  ].join("\n");
};
