import type store from "../store/store";

type rootState = ReturnType<store["getState"]>;

export type { rootState as default };
