import { configureStore } from "@reduxjs/toolkit";
import { readerSlice } from "./readerSlice";
import { persistedStateStorage } from "./persistedState";

const preloadedState = persistedStateStorage.load();

export const store = configureStore({
  reducer: {
    reader: readerSlice.reducer
  },
  preloadedState
});

const handleStoreUpdate = (): void => {
  persistedStateStorage.save({
    reader: store.getState().reader
  });
};

store.subscribe(handleStoreUpdate);
