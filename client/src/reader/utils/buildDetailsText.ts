import type { translationResponse } from "../../types/translationResponse";

export const buildDetailsText = (response: translationResponse): string => {
  if (!response.verbForm) {
    return "";
  }

  const parts: string[] = [];
  parts.push(`Forma base: ${response.verbForm}`);
  parts.push(`Irregular: ${response.isIrregular ? "sim" : "nao"}`);

  if (response.otherForms) {
    parts.push(`Outras formas: ${response.otherForms}`);
  }

  return parts.join(" | ");
};
