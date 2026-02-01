import type TranslationRequest from "../contracts/TranslationRequest";

const ParseTranslationRequest = (Value: unknown): TranslationRequest | null => {
  if (!Value || typeof Value !== "object") {
    return null;
  }

  const RecordValue = Value as Record<string, unknown>;
  const Word = RecordValue.Word;
  const ContextLeft = RecordValue.ContextLeft;
  const ContextRight = RecordValue.ContextRight;
  const SourceLanguage = RecordValue.SourceLanguage;
  const TargetLanguage = RecordValue.TargetLanguage;

  if (
    typeof Word !== "string" ||
    typeof ContextLeft !== "string" ||
    typeof ContextRight !== "string" ||
    typeof SourceLanguage !== "string" ||
    typeof TargetLanguage !== "string"
  ) {
    return null;
  }

  return {
    Word,
    ContextLeft,
    ContextRight,
    SourceLanguage,
    TargetLanguage
  };
};

export default ParseTranslationRequest;
