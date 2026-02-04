export type usageExample = {
  Portuguese: string;
  Translation: string;
};

export type verbFormRow = {
  Tense: string;
  Forms: string;
};

export type translationResponse = {
  Translation: string;
  PartOfSpeech: string;
  Gender: string;
  Tense: string;
  Infinitive: string;
  IsIrregular: boolean;
  UsageExamples: usageExample[];
  VerbForms: verbFormRow[];
};
