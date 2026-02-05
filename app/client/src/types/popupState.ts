import type { translationResponse } from "./translationResponse";

export type popupState = {
  isOpen: boolean;
  statusText: string;
  word: string;
  response: translationResponse | null;
  isTranslationPending: boolean;
};
