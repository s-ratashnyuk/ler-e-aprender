import type { store } from "../store/store";

export type rootState = ReturnType<typeof store.getState>;
