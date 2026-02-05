import type { MouseEvent } from "react";

type HandleContainerClickCaptureParams = {
  closePopup: () => void;
  isPopupOpen: boolean;
};

export const handleContainerClickCapture = (
  { closePopup, isPopupOpen }: HandleContainerClickCaptureParams,
  event: MouseEvent<HTMLDivElement>
): void => {
  if (!isPopupOpen) {
    return;
  }

  event.stopPropagation();
  closePopup();
};
