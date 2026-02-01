import type { translationResponse } from "../contracts/TranslationResponse";
import { extractFirstJsonObject } from "../utils/ExtractFirstJsonObject";

export const parseTranslationResponse = (outputText: string): translationResponse => {
  const jsonText = extractFirstJsonObject(outputText);
  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  const translation = parsed.Translation;
  const partOfSpeech = parsed.PartOfSpeech;
  const example = parsed.Example;
  const verbForm = parsed.VerbForm;
  const isIrregular = parsed.IsIrregular;
  const otherForms = parsed.OtherForms;

  if (
    typeof translation !== "string" ||
    typeof partOfSpeech !== "string" ||
    typeof example !== "string" ||
    typeof verbForm !== "string" ||
    typeof isIrregular !== "boolean" ||
    typeof otherForms !== "string"
  ) {
    throw new Error("Invalid translation response shape.");
  }

  return {
    Translation: translation,
    PartOfSpeech: partOfSpeech,
    Example: example,
    VerbForm: verbForm,
    IsIrregular: isIrregular,
    OtherForms: otherForms
  };
};
