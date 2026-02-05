import type { usageExample } from "../contracts/TranslationResponse";

const escapeRegExp = (value: string): string => {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

export const boldFirstOccurrence = (sentence: string, phrase: string): string => {
  if (!sentence || !phrase) {
    return sentence;
  }

  const escaped = escapeRegExp(phrase);
  const isSingleWord = /^[\p{L}\p{M}]+$/u.test(phrase);
  const pattern = isSingleWord
    ? `(?<![\\p{L}\\p{M}])${escaped}(?![\\p{L}\\p{M}])`
    : escaped;
  const regex = new RegExp(pattern, "iu");
  if (!regex.test(sentence)) {
    return sentence;
  }

  return sentence.replace(regex, (match) => `<b>${match}</b>`);
};

export const buildUsageExamples = (
  sentence: string,
  sentenceTranslation: string,
  wordSurface: string
): usageExample[] => {
  if (!sentenceTranslation || !sentence) {
    return [];
  }

  const highlightedSentence = boldFirstOccurrence(sentence, wordSurface);

  return [
    {
      Portuguese: highlightedSentence,
      Translation: sentenceTranslation
    }
  ];
};
