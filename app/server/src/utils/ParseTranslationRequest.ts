import type { translationRequest } from "../contracts/TranslationRequest.js";

export const parseTranslationRequest = (value: unknown): translationRequest | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const recordValue = value as Record<string, unknown>;
  const word = recordValue.Word;
  const bookId = recordValue.BookId;
  const tokenStart = recordValue.TokenStart;
  const tokenEnd = recordValue.TokenEnd;
  const contextLeft = recordValue.ContextLeft;
  const contextRight = recordValue.ContextRight;
  const contextSentence = recordValue.ContextSentence;
  const sourceLanguage = recordValue.SourceLanguage;
  const targetLanguage = recordValue.TargetLanguage;
  const forceRefresh = recordValue.ForceRefresh;
  const forceOpenAi = recordValue.ForceOpenAI;

  if (
    typeof bookId !== "string" ||
    typeof tokenStart !== "number" ||
    typeof tokenEnd !== "number" ||
    typeof word !== "string" ||
    typeof contextLeft !== "string" ||
    typeof contextRight !== "string" ||
    typeof contextSentence !== "string" ||
    typeof sourceLanguage !== "string" ||
    typeof targetLanguage !== "string" ||
    (typeof forceRefresh !== "undefined" && typeof forceRefresh !== "boolean") ||
    (typeof forceOpenAi !== "undefined" && typeof forceOpenAi !== "boolean")
  ) {
    return null;
  }

  if (!Number.isFinite(tokenStart) || !Number.isFinite(tokenEnd) || tokenStart > tokenEnd) {
    return null;
  }

  return {
    BookId: bookId,
    TokenStart: tokenStart,
    TokenEnd: tokenEnd,
    Word: word,
    ContextLeft: contextLeft,
    ContextRight: contextRight,
    ContextSentence: contextSentence,
    SourceLanguage: sourceLanguage,
    TargetLanguage: targetLanguage,
    ForceRefresh: forceRefresh ?? false,
    ForceOpenAI: forceOpenAi ?? false
  };
};
