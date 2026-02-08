export type translationApiResponse = {
  TranslationEnglish: string;
  TranslationRussian: string;
  IsPending?: boolean;
  UsageExamples: usageExampleApi[];
  WordCard?: wordCardApi;
};

export type usageExampleApi = {
  Portuguese: string;
  English: string;
  Russian: string;
};

export type wordCardApi = {
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
