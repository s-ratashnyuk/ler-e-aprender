export type translationResponse = {
  translation: translationText;
  isPending: boolean;
  usageExamples: usageExample[];
  wordCard?: wordCard;
};

export type translationText = {
  english: string;
  russian: string;
};

export type usageExample = {
  portuguese: string;
  english: string;
  russian: string;
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
