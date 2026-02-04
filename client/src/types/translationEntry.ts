export type translationEntry = {
  id: string;
  word: string;
  contextLeft: string;
  contextRight: string;
  translation: string;
  partOfSpeech: string;
  gender: string;
  tense: string;
  infinitive: string;
  isIrregular: boolean;
  usageExamples: usageExample[];
  verbForms: verbFormRow[];
  timestamp: number;
};

export type usageExample = {
  portuguese: string;
  translation: string;
};

export type verbFormRow = {
  tense: string;
  forms: string;
};
