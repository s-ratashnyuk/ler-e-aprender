export type translationRequest = {
  bookId: string;
  tokenStart: number;
  tokenEnd: number;
  word: string;
  contextLeft: string;
  contextRight: string;
  contextSentence: string;
  sourceLanguage: string;
  targetLanguage: string;
  forceRefresh?: boolean;
  forceOpenAi?: boolean;
};
