import type { translationResponse, usageExample } from "../contracts/TranslationResponse.js";
import { extractFirstJsonObject } from "../utils/ExtractFirstJsonObject.js";

export const parseTranslationResponse = (outputText: string): translationResponse => {
  const jsonText = extractFirstJsonObject(outputText);
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  const translationEnglish = parsed.TranslationEnglish;
  const translationRussian = parsed.TranslationRussian;
  const usageExamples = parsed.UsageExamples;

  if (
    typeof translationEnglish !== "string" ||
    typeof translationRussian !== "string" ||
    !Array.isArray(usageExamples)
  ) {
    throw new Error("Invalid translation response shape.");
  }

  const normalizedUsageExamples: usageExample[] = usageExamples.map((example) => {
    if (!example || typeof example !== "object") {
      throw new Error("Invalid usage example entry.");
    }

    const record = example as Record<string, unknown>;
    if (
      typeof record.Portuguese !== "string" ||
      typeof record.English !== "string" ||
      typeof record.Russian !== "string"
    ) {
      throw new Error("Invalid usage example entry.");
    }

    return {
      Portuguese: record.Portuguese,
      English: record.English,
      Russian: record.Russian
    };
  });

  return {
    TranslationEnglish: translationEnglish,
    TranslationRussian: translationRussian,
    UsageExamples: normalizedUsageExamples
  };
};
