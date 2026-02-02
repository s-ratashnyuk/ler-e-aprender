import type { translationRequest } from "../contracts/TranslationRequest";

export const buildUserPrompt = (request: translationRequest): string => {
  return [
    `Source language: ${request.SourceLanguage}`,
    `Target language: ${request.TargetLanguage}`,
    `Word: ${request.Word}`,
    `Context left: ${request.ContextLeft}`,
    `Context right: ${request.ContextRight}`,
    `Sentence (use exactly for usage example 1; may be truncated to 10 words on each side): ${request.ContextSentence}`,
    "Task: Translate only the word using the context to disambiguate.",
    "If the word is part of a fixed expression in the sentence, translate the meaning of that expression.",
    "Determine the word's part of speech from its Portuguese grammar in the sentence; do not assume an English function-word role based on spelling.",
    "Only label as preposição if it clearly acts as a Portuguese preposition; if it is an inflected verb, mark as verbo and provide tense/infinitive.",
    "Include verb tense + infinitive details if applicable.",
    "Provide 5 usage examples by default; include up to 10 total if multiple meanings must be covered.",
    "In Translation, bold only the translated word or full translated idiom using <b>...</b> (no markdown).",
    "Usage example 1 must use the Sentence exactly and its translation must bold the translated word or full translated idiom with <b>...</b> (no markdown).",
    "For idioms, bold the entire translated phrase, not just a single word.",
    "If the word is part of a fixed expression, also wrap the full expression in <b>...</b> within the Portuguese example.",
    "Each example must use the exact word form provided and include a translation.",
    "If you are not sure, return Translation as \"I don't know\" and leave UsageExamples/VerbForms empty.",
    "If the word is a verb, include verb forms for Pres. do ind., Pretérito perf., Pretérito imperf., Fut., Part. pass., Imperativo (last).",
    "For verb forms, use only eu, tu, ele(a), nós, ele(a)s (no vós). For Imperativo, omit eu and use tu, ele(a), nós, ele(a)s.",
    "Return the result as json."
  ].join("\n");
};
