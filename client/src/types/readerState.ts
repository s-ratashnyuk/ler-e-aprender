import type bookEntry from "./bookEntry";
import type translationEntry from "./translationEntry";

type readerState = {
  activeBookId: string;
  books: bookEntry[];
  translationsByBook: Record<string, translationEntry[]>;
  progressByBook: Record<string, number>;
};

export type { readerState as default };
