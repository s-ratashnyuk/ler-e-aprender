import type TranslationResponse from "../contracts/TranslationResponse";
import ExtractFirstJsonObject from "../utils/ExtractFirstJsonObject";

const ParseTranslationResponse = (OutputText: string): TranslationResponse => {
  const JsonText = ExtractFirstJsonObject(OutputText);
  const Parsed = JSON.parse(JsonText) as Record<string, unknown>;
  const Translation = Parsed.Translation;
  const PartOfSpeech = Parsed.PartOfSpeech;
  const Example = Parsed.Example;
  const VerbForm = Parsed.VerbForm;
  const IsIrregular = Parsed.IsIrregular;
  const OtherForms = Parsed.OtherForms;

  if (
    typeof Translation !== "string" ||
    typeof PartOfSpeech !== "string" ||
    typeof Example !== "string" ||
    typeof VerbForm !== "string" ||
    typeof IsIrregular !== "boolean" ||
    typeof OtherForms !== "string"
  ) {
    throw new Error("Invalid translation response shape.");
  }

  return { Translation, PartOfSpeech, Example, VerbForm, IsIrregular, OtherForms };
};

export default ParseTranslationResponse;
