import type { MutableRefObject } from "react";

type SyncScrollPositionParams = {
  savedProgress: number;
  textContainerRef: MutableRefObject<HTMLDivElement | null>;
};

export const syncScrollPosition = ({ savedProgress, textContainerRef }: SyncScrollPositionParams): void => {
  const container = textContainerRef.current;
  if (!container) {
    return;
  }

  const maxScroll = container.scrollHeight - container.clientHeight;
  container.scrollTop = maxScroll * savedProgress;
};
