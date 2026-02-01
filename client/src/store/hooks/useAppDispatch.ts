import { useDispatch } from "react-redux";
import type appDispatch from "../../types/appDispatch";

const useAppDispatch = (): appDispatch => {
  return useDispatch<appDispatch>();
};

export default useAppDispatch;
