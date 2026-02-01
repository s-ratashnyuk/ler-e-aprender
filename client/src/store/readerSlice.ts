import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type bookEntry from "../types/bookEntry";
import type readerState from "../types/readerState";
import type readingProgressPayload from "../types/readingProgressPayload";
import type translationPayload from "../types/translationPayload";

const defaultBook: bookEntry = {
  id: "book-1",
  title: "A chave da biblioteca",
  language: "pt-PT"
};

const initialState: readerState = {
  activeBookId: defaultBook.id,
  books: [defaultBook],
  translationsByBook: {},
  progressByBook: {}
};

const readerSlice = createSlice({
  name: "reader",
  initialState,
  reducers: {
    setActiveBook: (state, action: PayloadAction<string>): void => {
      state.activeBookId = action.payload;
    },
    addTranslation: (state, action: PayloadAction<translationPayload>): void => {
      const { bookId, entry } = action.payload;
      const existing = state.translationsByBook[bookId] ?? [];
      existing.push(entry);
      state.translationsByBook[bookId] = existing;
    },
    setReadingProgress: (state, action: PayloadAction<readingProgressPayload>): void => {
      const { bookId, progress } = action.payload;
      state.progressByBook[bookId] = progress;
    }
  }
});

export default readerSlice;
