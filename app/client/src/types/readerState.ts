import type { bookEntry } from "./bookEntry";
import type { translationEntry } from "./translationEntry";

export type readerState = {
  activeBookId: string;
  books: bookEntry[];
  translationsByBook: Record<string, Record<string, translationEntry[]>>;
  checkCountsByBook: Record<string, Record<string, number>>;
  hiddenWordsByBook: Record<string, Record<string, boolean>>;
  positionByBook: Record<string, number>;
  progressByBook: Record<string, number>;
};
