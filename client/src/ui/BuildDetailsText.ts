import type TranslationResponse from "../api/TranslationResponse";

const BuildDetailsText = (Response: TranslationResponse): string => {
  if (!Response.VerbForm) {
    return "";
  }

  const Lines: string[] = [];
  Lines.push(`Forma base: ${Response.VerbForm}`);
  Lines.push(`Irregular: ${Response.IsIrregular ? "sim" : "nao"}`);

  if (Response.OtherForms) {
    Lines.push(`Outras formas: ${Response.OtherForms}`);
  }

  return Lines.join(" | ");
};

export default BuildDetailsText;
