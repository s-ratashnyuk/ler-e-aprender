import type { readerState } from "../types/readerState";

type persistedState = {
  reader: readerState;
};

const storageKey = "reader-state";

const loadPersistedState = (): persistedState | undefined => {
  if (typeof window === "undefined") {
    return undefined;
  }

  const rawState = window.localStorage.getItem(storageKey);
  if (!rawState) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(rawState) as persistedState;
    if (!parsed || typeof parsed !== "object" || !parsed.reader) {
      return undefined;
    }
    return {
      reader: {
        ...parsed.reader,
        positionByBook: parsed.reader.positionByBook ?? {}
      }
    };
  } catch {
    return undefined;
  }
};

const savePersistedState = (state: persistedState): void => {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    return;
  }
};

export const persistedStateStorage = {
  load: loadPersistedState,
  save: savePersistedState
};
