import type { MutableRefObject } from "react";
import { readerSlice } from "../../../../store/readerSlice";
import { appDispatch } from "../../../../types/appDispatch";

type HandleScrollParams = {
  activeBookId: string;
  dispatch: appDispatch;
  textContainerRef: MutableRefObject<HTMLDivElement | null>;
};

export const handleScroll = ({ activeBookId, dispatch, textContainerRef }: HandleScrollParams): void => {
  const container = textContainerRef.current;
  if (!container) {
    return;
  }

  const maxScroll = container.scrollHeight - container.clientHeight;
  const progress = maxScroll > 0 ? container.scrollTop / maxScroll : 0;

  dispatch(readerSlice.actions.setReadingProgress({
    bookId: activeBookId,
    progress
  }));
};
