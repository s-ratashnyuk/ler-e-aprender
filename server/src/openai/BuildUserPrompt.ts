import type TranslationRequest from "../contracts/TranslationRequest";

const BuildUserPrompt = (Request: TranslationRequest): string => {
  return [
    `Source language: ${Request.SourceLanguage}`,
    `Target language: ${Request.TargetLanguage}`,
    `Word: ${Request.Word}`,
    `Context left: ${Request.ContextLeft}`,
    `Context right: ${Request.ContextRight}`,
    "Task: Translate only the word using the context to disambiguate.",
    "Include verb form details if applicable.",
    "Return the result as json."
  ].join("\n");
};

export default BuildUserPrompt;
