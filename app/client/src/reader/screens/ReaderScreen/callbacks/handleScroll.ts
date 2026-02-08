import type { MutableRefObject } from "react";
import { readerSlice } from "../../../../store/readerSlice";
import { appDispatch } from "../../../../types/appDispatch";
import type { textToken } from "../../../../types/textToken";

type HandleScrollParams = {
  activeBookId: string;
  dispatch: appDispatch;
  contentLength: number;
  onAnchorChange: (position: number) => void;
  scrollRafRef: MutableRefObject<number | null>;
  textContainerRef: MutableRefObject<HTMLDivElement | null>;
  tokens: textToken[];
};

const findAnchorTokenIndex = (container: HTMLDivElement, tokens: textToken[]): number => {
  const elements = container.querySelectorAll<HTMLElement>("[data-token-index]");
  if (!elements.length) {
    return 0;
  }

  const top = container.scrollTop;
  for (const element of elements) {
    if (element.offsetTop + element.offsetHeight >= top) {
      const rawIndex = element.dataset.tokenIndex ?? "0";
      const index = Number.parseInt(rawIndex, 10);
      if (Number.isFinite(index) && tokens[index]) {
        return index;
      }
      break;
    }
  }

  return 0;
};

export const handleScroll = ({
  activeBookId,
  dispatch,
  contentLength,
  onAnchorChange,
  scrollRafRef,
  textContainerRef,
  tokens
}: HandleScrollParams): void => {
  const container = textContainerRef.current;
  if (!container || !activeBookId || tokens.length === 0) {
    return;
  }

  if (scrollRafRef.current !== null) {
    return;
  }

  scrollRafRef.current = window.requestAnimationFrame(() => {
    scrollRafRef.current = null;
    const anchorIndex = findAnchorTokenIndex(container, tokens);
    const anchorToken = tokens[anchorIndex] ?? tokens[0];
    const position = anchorToken?.startIndex ?? 0;
    const progress = contentLength > 0 ? Math.min(Math.max(position / contentLength, 0), 1) : 0;

    dispatch(readerSlice.actions.setReadingPosition({
      bookId: activeBookId,
      position
    }));
    dispatch(readerSlice.actions.setReadingProgress({
      bookId: activeBookId,
      progress
    }));
    onAnchorChange(position);
  });
};
