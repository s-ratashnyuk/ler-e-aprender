import type TextToken from "./TextToken";

const FindNearestWordToken = (Tokens: TextToken[], TokenIndex: number): TextToken | null => {
  const ClickedToken = Tokens[TokenIndex];

  if (!ClickedToken) {
    return null;
  }

  if (ClickedToken.Type === "word") {
    return ClickedToken;
  }

  let LeftIndex = TokenIndex - 1;
  let RightIndex = TokenIndex + 1;
  let LeftWord: TextToken | null = null;
  let RightWord: TextToken | null = null;

  while (LeftIndex >= 0 && !LeftWord) {
    if (Tokens[LeftIndex]?.Type === "word") {
      LeftWord = Tokens[LeftIndex] ?? null;
    }
    LeftIndex -= 1;
  }

  while (RightIndex < Tokens.length && !RightWord) {
    if (Tokens[RightIndex]?.Type === "word") {
      RightWord = Tokens[RightIndex] ?? null;
    }
    RightIndex += 1;
  }

  if (!LeftWord && !RightWord) {
    return null;
  }

  if (!LeftWord) {
    return RightWord;
  }

  if (!RightWord) {
    return LeftWord;
  }

  const LeftLength = LeftWord.Text.length;
  const RightLength = RightWord.Text.length;
  const LengthDifference = Math.abs(LeftLength - RightLength);

  if (LengthDifference <= 1) {
    return RightWord;
  }

  return LeftLength > RightLength ? LeftWord : RightWord;
};

export default FindNearestWordToken;
