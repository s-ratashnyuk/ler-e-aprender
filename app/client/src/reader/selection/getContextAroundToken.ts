import type { textToken } from "../../types/textToken";

type contextWindow = {
  contextLeft: string;
  contextRight: string;
};

export const getContextAroundToken = (
  tokens: textToken[],
  token: textToken,
  windowSize: number
): contextWindow => {
  const leftWords: string[] = [];
  const rightWords: string[] = [];

  let leftIndex = token.index - 1;
  while (leftIndex >= 0 && leftWords.length < windowSize) {
    const candidate = tokens[leftIndex];
    if (candidate?.type === "word") {
      leftWords.unshift(candidate.text);
    }
    leftIndex -= 1;
  }

  let rightIndex = token.index + 1;
  while (rightIndex < tokens.length && rightWords.length < windowSize) {
    const candidate = tokens[rightIndex];
    if (candidate?.type === "word") {
      rightWords.push(candidate.text);
    }
    rightIndex += 1;
  }

  return {
    contextLeft: leftWords.join(" "),
    contextRight: rightWords.join(" ")
  };
};
