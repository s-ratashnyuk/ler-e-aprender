import { useSelector, type TypedUseSelectorHook } from "react-redux";
import type { rootState } from "../../types/rootState";

export const useAppSelector: TypedUseSelectorHook<rootState> = useSelector;
