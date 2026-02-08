import type { translationText, wordCard } from "./translationResponse";

export type translationEntry = {
  id: string;
  word: string;
  tokenStart?: number;
  tokenEnd?: number;
  contextLeft: string;
  contextRight: string;
  contextSentence?: string;
  translation: translationText;
  usageExamples: usageExample[];
  wordCard?: wordCard;
  timestamp: number;
};

export type usageExample = {
  portuguese: string;
  english: string;
  russian: string;
};
