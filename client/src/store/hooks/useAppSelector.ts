import { useSelector, type TypedUseSelectorHook } from "react-redux";
import type rootState from "../../types/rootState";

const useAppSelector: TypedUseSelectorHook<rootState> = useSelector;

export default useAppSelector;
