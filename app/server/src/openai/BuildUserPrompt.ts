import type { translationRequest } from "../contracts/TranslationRequest.js";

export const buildUserPrompt = (request: translationRequest): string => {
  return [
    `Source language: ${request.SourceLanguage}`,
    `Word: ${request.Word}`,
    `Context left: ${request.ContextLeft}`,
    `Context right: ${request.ContextRight}`,
    `Sentence (use exactly for usage example 1; may be truncated to 10 words on each side): ${request.ContextSentence}`,
    "Task: Translate only the word using the context to disambiguate.",
    "If the word is part of a fixed expression in the sentence, translate the meaning of that expression.",
    "Provide 5 usage examples by default; include up to 10 total if multiple meanings must be covered.",
    "Provide both English and Russian translations.",
    "In TranslationEnglish and TranslationRussian, bold only the translated word or full translated idiom using <b>...</b> (no markdown).",
    "Usage example 1 must use the Sentence exactly and its translations must bold the translated word or full translated idiom with <b>...</b> (no markdown).",
    "For idioms, bold the entire translated phrase, not just a single word.",
    "If the word is part of a fixed expression, also wrap the full expression in <b>...</b> within the Portuguese example.",
    "Each example must use the exact word form provided and include a translation.",
    "If you are not sure, return both translations as \"I don't know\" and leave UsageExamples empty.",
    "Return the result as json."
  ].join("\n");
};
