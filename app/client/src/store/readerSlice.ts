import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { bookEntry } from "../types/bookEntry";
import type { readerState } from "../types/readerState";
import type { readingPositionPayload } from "../types/readingPositionPayload";
import type { readingProgressPayload } from "../types/readingProgressPayload";
import type { translationPayload } from "../types/translationPayload";
import type { translationEntry } from "../types/translationEntry";
import type { translationResponse } from "../types/translationResponse";
import type { rootState } from "../types/rootState";

const initialState: readerState = {
  activeBookId: "",
  books: [],
  translationsByBook: {},
  checkCountsByBook: {},
  hiddenWordsByBook: {},
  positionByBook: {},
  progressByBook: {}
};

const normalizeWord = (word: string): string => word.trim().toLocaleLowerCase();

const mapEntryToResponse = (entry: translationEntry): translationResponse => {
  return {
    translation: entry.translation,
    isPending: false,
    usageExamples: entry.usageExamples,
    wordCard: entry.wordCard
  };
};

export const readerSlice = createSlice({
  name: "reader",
  initialState,
  reducers: {
    setBooks: (state, action: PayloadAction<bookEntry[]>): void => {
      state.books = action.payload;
      const hasActive = action.payload.some((book) => book.id === state.activeBookId);
      if (!hasActive) {
        state.activeBookId = action.payload[0]?.id ?? "";
      }
    },
    setActiveBook: (state, action: PayloadAction<string>): void => {
      state.activeBookId = action.payload;
    },
    addTranslation: (state, action: PayloadAction<translationPayload>): void => {
      const { bookId, entry } = action.payload;
      const normalizedWord = normalizeWord(entry.word);
      if (!normalizedWord) {
        return;
      }

      const translationsForBook = state.translationsByBook[bookId] ?? {};
      const existing = translationsForBook[normalizedWord] ?? [];
      existing.push(entry);
      translationsForBook[normalizedWord] = existing;
      state.translationsByBook[bookId] = translationsForBook;
    },
    incrementWordCheck: (
      state,
      action: PayloadAction<{
        bookId: string;
        word: string;
      }>
    ): void => {
      const normalizedWord = normalizeWord(action.payload.word);
      if (!normalizedWord) {
        return;
      }

      const countsForBook = state.checkCountsByBook[action.payload.bookId] ?? {};
      countsForBook[normalizedWord] = (countsForBook[normalizedWord] ?? 0) + 1;
      state.checkCountsByBook[action.payload.bookId] = countsForBook;
    },
    hideWordFromUnknowns: (
      state,
      action: PayloadAction<{
        bookId: string;
        word: string;
      }>
    ): void => {
      const normalizedWord = normalizeWord(action.payload.word);
      if (!normalizedWord) {
        return;
      }

      const hiddenForBook = state.hiddenWordsByBook[action.payload.bookId] ?? {};
      hiddenForBook[normalizedWord] = true;
      state.hiddenWordsByBook[action.payload.bookId] = hiddenForBook;
    },
    showWordFromUnknowns: (
      state,
      action: PayloadAction<{
        bookId: string;
        word: string;
      }>
    ): void => {
      const normalizedWord = normalizeWord(action.payload.word);
      if (!normalizedWord) {
        return;
      }

      const hiddenForBook = state.hiddenWordsByBook[action.payload.bookId];
      if (hiddenForBook && normalizedWord in hiddenForBook) {
        delete hiddenForBook[normalizedWord];
      }
    },
    upsertTranslation: (state, action: PayloadAction<translationPayload>): void => {
      const { bookId, entry } = action.payload;
      const normalizedWord = normalizeWord(entry.word);
      if (!normalizedWord) {
        return;
      }

      const translationsForBook = state.translationsByBook[bookId] ?? {};
      const existing = translationsForBook[normalizedWord] ?? [];
      let existingIndex = existing.findIndex((stored) => stored.id === entry.id);
      if (
        existingIndex < 0 &&
        Number.isFinite(entry.tokenStart) &&
        Number.isFinite(entry.tokenEnd)
      ) {
        existingIndex = existing.findIndex(
          (stored) =>
            stored.tokenStart === entry.tokenStart && stored.tokenEnd === entry.tokenEnd
        );
      }

      if (existingIndex >= 0) {
        existing[existingIndex] = entry;
      } else {
        existing.push(entry);
      }

      translationsForBook[normalizedWord] = existing;
      state.translationsByBook[bookId] = translationsForBook;
    },
    setReadingProgress: (state, action: PayloadAction<readingProgressPayload>): void => {
      const { bookId, progress } = action.payload;
      state.progressByBook[bookId] = progress;
    },
    setReadingPosition: (state, action: PayloadAction<readingPositionPayload>): void => {
      const { bookId, position } = action.payload;
      state.positionByBook[bookId] = position;
    }
  }
});

const selectTranslationsByBook = (state: rootState): readerState["translationsByBook"] => {
  return state.reader.translationsByBook;
};

export const selectFirstTranslationsByWord = createSelector(
  [selectTranslationsByBook, (_state: rootState, bookId: string) => bookId],
  (translationsByBook, bookId): Record<string, translationResponse> => {
    const translationsForBook = translationsByBook[bookId];
    if (!translationsForBook) {
      return {};
    }

    const responseByWord: Record<string, translationResponse> = {};
    Object.entries(translationsForBook).forEach(([word, entries]) => {
      const firstEntry = entries[0];
      if (firstEntry) {
        responseByWord[word] = mapEntryToResponse(firstEntry);
      }
    });

    return responseByWord;
  }
);
