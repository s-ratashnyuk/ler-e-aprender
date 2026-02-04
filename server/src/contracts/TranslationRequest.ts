export type translationRequest = {
  BookId: string;
  TokenStart: number;
  TokenEnd: number;
  Word: string;
  ContextLeft: string;
  ContextRight: string;
  ContextSentence: string;
  SourceLanguage: string;
  TargetLanguage: string;
  ForceRefresh?: boolean;
};
