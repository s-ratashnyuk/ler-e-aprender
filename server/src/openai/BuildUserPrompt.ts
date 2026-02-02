import type { translationRequest } from "../contracts/TranslationRequest";

export const buildUserPrompt = (request: translationRequest): string => {
  return [
    `Source language: ${request.SourceLanguage}`,
    `Target language: ${request.TargetLanguage}`,
    `Word: ${request.Word}`,
    `Context left: ${request.ContextLeft}`,
    `Context right: ${request.ContextRight}`,
    "Task: Translate only the word using the context to disambiguate.",
    "Include verb tense + infinitive details if applicable.",
    "Provide 5 usage examples by default; include up to 10 total if multiple meanings must be covered.",
    "Each example must use the exact word form provided and include a translation.",
    "If the word is a verb, include verb forms for Pres. do ind., Pretérito perf., Pretérito imperf., Fut., Part. pass., Imperativo (last).",
    "For verb forms, use only eu, tu, ele(a), nós, ele(a)s (no vós). For Imperativo, omit eu and use tu, ele(a), nós, ele(a)s.",
    "Return the result as json."
  ].join("\n");
};
