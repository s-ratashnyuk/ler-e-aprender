export type usageExample = {
  Portuguese: string;
  English: string;
  Russian: string;
};

export type wordCard = {
  partOfSpeech: string;
  gender: string;
  number: string;
  tense: string;
  infinitive: string;
  isIrregular: boolean;
  verbForms: Array<{ Tense: string; Forms: string }>;
  sentenceTranslation?: {
    portuguese: string;
    russian: string;
  };
};

export type translationResponse = {
  TranslationEnglish: string;
  TranslationRussian: string;
  IsPending?: boolean;
  UsageExamples: usageExample[];
  WordCard?: wordCard;
};
