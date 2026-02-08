import type { bookEntry } from "./bookEntry";
import type { translationEntry } from "./translationEntry";

export type readerState = {
  activeBookId: string;
  books: bookEntry[];
  translationsByBook: Record<string, Record<string, translationEntry[]>>;
  positionByBook: Record<string, number>;
  progressByBook: Record<string, number>;
};
