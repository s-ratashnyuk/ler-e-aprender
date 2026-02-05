import type { translationResponse } from "../../types/translationResponse";

export const buildDetailsText = (response: translationResponse): string => {
  const tense = response.tense.trim();
  const infinitive = response.infinitive.trim();

  if (!tense && !infinitive) {
    return "";
  }

  const parts: string[] = [];
  if (tense) {
    parts.push(`Tempo: ${tense}`);
  }
  if (infinitive) {
    parts.push(`Inf.: ${infinitive}`);
  }

  parts.push(`Irregular: ${response.isIrregular ? "sim" : "nao"}`);

  return parts.join(" | ");
};
