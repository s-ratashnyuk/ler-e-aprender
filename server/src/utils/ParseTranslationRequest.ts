import type { translationRequest } from "../contracts/TranslationRequest";

export const parseTranslationRequest = (value: unknown): translationRequest | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const recordValue = value as Record<string, unknown>;
  const word = recordValue.Word;
  const contextLeft = recordValue.ContextLeft;
  const contextRight = recordValue.ContextRight;
  const contextSentence = recordValue.ContextSentence;
  const sourceLanguage = recordValue.SourceLanguage;
  const targetLanguage = recordValue.TargetLanguage;

  if (
    typeof word !== "string" ||
    typeof contextLeft !== "string" ||
    typeof contextRight !== "string" ||
    typeof contextSentence !== "string" ||
    typeof sourceLanguage !== "string" ||
    typeof targetLanguage !== "string"
  ) {
    return null;
  }

  return {
    Word: word,
    ContextLeft: contextLeft,
    ContextRight: contextRight,
    ContextSentence: contextSentence,
    SourceLanguage: sourceLanguage,
    TargetLanguage: targetLanguage
  };
};
