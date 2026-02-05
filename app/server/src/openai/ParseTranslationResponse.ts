import type { translationResponse, usageExample, verbFormRow } from "../contracts/TranslationResponse.js";
import { extractFirstJsonObject } from "../utils/ExtractFirstJsonObject.js";

export const parseTranslationResponse = (outputText: string): translationResponse => {
  const jsonText = extractFirstJsonObject(outputText);
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  const translation = parsed.Translation;
  const partOfSpeech = parsed.PartOfSpeech;
  const gender = parsed.Gender;
  const tense = parsed.Tense;
  const infinitive = parsed.Infinitive;
  const isIrregular = parsed.IsIrregular;
  const usageExamples = parsed.UsageExamples;
  const verbForms = parsed.VerbForms;

  if (
    typeof translation !== "string" ||
    typeof partOfSpeech !== "string" ||
    typeof gender !== "string" ||
    typeof tense !== "string" ||
    typeof infinitive !== "string" ||
    typeof isIrregular !== "boolean" ||
    !Array.isArray(usageExamples) ||
    !Array.isArray(verbForms)
  ) {
    throw new Error("Invalid translation response shape.");
  }

  const normalizedUsageExamples: usageExample[] = usageExamples.map((example) => {
    if (!example || typeof example !== "object") {
      throw new Error("Invalid usage example entry.");
    }

    const record = example as Record<string, unknown>;
    if (typeof record.Portuguese !== "string" || typeof record.Translation !== "string") {
      throw new Error("Invalid usage example entry.");
    }

    return {
      Portuguese: record.Portuguese,
      Translation: record.Translation
    };
  });

  const normalizedVerbForms: verbFormRow[] = verbForms.map((form) => {
    if (!form || typeof form !== "object") {
      throw new Error("Invalid verb form entry.");
    }

    const record = form as Record<string, unknown>;
    if (typeof record.Tense !== "string" || typeof record.Forms !== "string") {
      throw new Error("Invalid verb form entry.");
    }

    return {
      Tense: record.Tense,
      Forms: record.Forms
    };
  });

  return {
    Translation: translation,
    PartOfSpeech: partOfSpeech,
    Gender: gender,
    Tense: tense,
    Infinitive: infinitive,
    IsIrregular: isIrregular,
    UsageExamples: normalizedUsageExamples,
    VerbForms: normalizedVerbForms
  };
};
