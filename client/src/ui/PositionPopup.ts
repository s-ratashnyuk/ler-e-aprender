const PositionPopup = (
  Popup: HTMLDivElement,
  Anchor: HTMLElement,
  Container: HTMLElement
): void => {
  const AnchorRect = Anchor.getBoundingClientRect();
  const ContainerRect = Container.getBoundingClientRect();
  const PopupRect = Popup.getBoundingClientRect();

  const HorizontalPadding = 16;
  const VerticalOffset = 12;

  let Left = AnchorRect.left - ContainerRect.left;
  let Top = AnchorRect.bottom - ContainerRect.top + VerticalOffset;

  const MaxLeft = ContainerRect.width - PopupRect.width - HorizontalPadding;
  if (Left > MaxLeft) {
    Left = MaxLeft;
  }
  if (Left < HorizontalPadding) {
    Left = HorizontalPadding;
  }

  const MaxTop = ContainerRect.height - PopupRect.height - VerticalOffset;
  if (Top > MaxTop) {
    Top = AnchorRect.top - ContainerRect.top - PopupRect.height - VerticalOffset;
  }
  if (Top < VerticalOffset) {
    Top = VerticalOffset;
  }

  Popup.style.transform = `translate(${Left}px, ${Top}px)`;
};

export default PositionPopup;
