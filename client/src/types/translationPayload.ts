import type translationEntry from "./translationEntry";

type translationPayload = {
  bookId: string;
  entry: translationEntry;
};

export type { translationPayload as default };
