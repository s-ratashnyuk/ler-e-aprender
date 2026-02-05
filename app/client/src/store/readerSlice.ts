import { createSelector, createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { bookEntry } from "../types/bookEntry";
import type { readerState } from "../types/readerState";
import type { readingProgressPayload } from "../types/readingProgressPayload";
import type { translationPayload } from "../types/translationPayload";
import type { translationEntry } from "../types/translationEntry";
import type { translationResponse } from "../types/translationResponse";
import type { rootState } from "../types/rootState";

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

const normalizeWord = (word: string): string => word.trim().toLocaleLowerCase();

const mapEntryToResponse = (entry: translationEntry): translationResponse => {
  return {
    translation: entry.translation,
    partOfSpeech: entry.partOfSpeech,
    gender: entry.gender ?? "",
    tense: entry.tense,
    infinitive: entry.infinitive,
    isIrregular: entry.isIrregular,
    isPending: false,
    usageExamples: entry.usageExamples,
    verbForms: entry.verbForms
  };
};

export const readerSlice = createSlice({
  name: "reader",
  initialState,
  reducers: {
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
    upsertTranslation: (state, action: PayloadAction<translationPayload>): void => {
      const { bookId, entry } = action.payload;
      const normalizedWord = normalizeWord(entry.word);
      if (!normalizedWord) {
        return;
      }

      const translationsForBook = state.translationsByBook[bookId] ?? {};
      const existing = translationsForBook[normalizedWord] ?? [];
      const existingIndex = existing.findIndex((stored) => stored.id === entry.id);

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
