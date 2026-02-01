type translationEntry = {
  id: string;
  word: string;
  contextLeft: string;
  contextRight: string;
  translation: string;
  partOfSpeech: string;
  example: string;
  verbForm: string;
  isIrregular: boolean;
  otherForms: string;
  timestamp: number;
};

export type { translationEntry as default };
