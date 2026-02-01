import type translationResponse from "./translationResponse";

type popupState = {
  isOpen: boolean;
  statusText: string;
  word: string;
  response: translationResponse | null;
};

export type { popupState as default };
