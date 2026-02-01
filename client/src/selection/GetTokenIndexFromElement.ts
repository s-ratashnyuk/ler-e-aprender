const GetTokenIndexFromElement = (Target: EventTarget | null): number | null => {
  if (!Target || !(Target instanceof HTMLElement)) {
    return null;
  }

  const TokenElement = Target.closest<HTMLElement>("[data-token-index]");

  if (!TokenElement) {
    return null;
  }

  const TokenIndexValue = TokenElement.dataset.tokenIndex;

  if (!TokenIndexValue) {
    return null;
  }

  const TokenIndex = Number(TokenIndexValue);

  if (Number.isNaN(TokenIndex)) {
    return null;
  }

  return TokenIndex;
};

export default GetTokenIndexFromElement;
