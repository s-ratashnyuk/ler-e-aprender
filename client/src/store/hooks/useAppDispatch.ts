import { useDispatch } from "react-redux";
import type { appDispatch } from "../../types/appDispatch";

export const useAppDispatch = (): appDispatch => {
  return useDispatch<appDispatch>();
};
