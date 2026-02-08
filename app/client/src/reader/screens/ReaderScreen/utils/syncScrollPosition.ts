import type { MutableRefObject } from "react";
import type { textToken } from "../../../../types/textToken";

type SyncScrollPositionParams = {
  anchorOffset: number;
  textContainerRef: MutableRefObject<HTMLDivElement | null>;
  tokens: textToken[];
};

const findTokenIndexForOffset = (tokens: textToken[], anchorOffset: number): number => {
  if (tokens.length === 0) {
    return 0;
  }

  const exactIndex = tokens.findIndex(
    (token) => token.startIndex <= anchorOffset && token.endIndex >= anchorOffset
  );
  if (exactIndex >= 0) {
    return exactIndex;
  }

  const nextIndex = tokens.findIndex((token) => token.startIndex >= anchorOffset);
  if (nextIndex >= 0) {
    return nextIndex;
  }

  return tokens.length - 1;
};

export const syncScrollPosition = ({
  anchorOffset,
  textContainerRef,
  tokens
}: SyncScrollPositionParams): void => {
  const container = textContainerRef.current;
  if (!container || tokens.length === 0) {
    return;
  }

  const targetIndex = findTokenIndexForOffset(tokens, anchorOffset);
  const targetElement = container.querySelector<HTMLElement>(
    `[data-token-index="${targetIndex}"]`
  );
  if (!targetElement) {
    return;
  }

  const containerRect = container.getBoundingClientRect();
  const elementRect = targetElement.getBoundingClientRect();
  const delta = elementRect.top - containerRect.top;
  container.scrollTop += delta;
};
