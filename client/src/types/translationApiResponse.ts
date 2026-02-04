export type translationApiResponse = {
  Translation: string;
  PartOfSpeech: string;
  Gender: string;
  Tense: string;
  Infinitive: string;
  IsIrregular: boolean;
  UsageExamples: usageExampleApi[];
  VerbForms: verbFormRowApi[];
};

export type usageExampleApi = {
  Portuguese: string;
  Translation: string;
};

export type verbFormRowApi = {
  Tense: string;
  Forms: string;
};
