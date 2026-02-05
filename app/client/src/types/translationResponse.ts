export type translationResponse = {
  translation: string;
  partOfSpeech: string;
  gender: string;
  tense: string;
  infinitive: string;
  isIrregular: boolean;
  isPending: boolean;
  usageExamples: usageExample[];
  verbForms: verbFormRow[];
};

export type usageExample = {
  portuguese: string;
  translation: string;
};

export type verbFormRow = {
  tense: string;
  forms: string;
};
