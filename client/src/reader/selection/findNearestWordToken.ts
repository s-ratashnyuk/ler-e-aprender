import type textToken from "../../types/textToken";

const findNearestWordToken = (tokens: textToken[], tokenIndex: number): textToken | null => {
  const clickedToken = tokens[tokenIndex];

  if (!clickedToken) {
    return null;
  }

  if (clickedToken.type === "word") {
    return clickedToken;
  }

  let leftIndex = tokenIndex - 1;
  let rightIndex = tokenIndex + 1;
  let leftWord: textToken | null = null;
  let rightWord: textToken | null = null;

  while (leftIndex >= 0 && !leftWord) {
    if (tokens[leftIndex]?.type === "word") {
      leftWord = tokens[leftIndex] ?? null;
    }
    leftIndex -= 1;
  }

  while (rightIndex < tokens.length && !rightWord) {
    if (tokens[rightIndex]?.type === "word") {
      rightWord = tokens[rightIndex] ?? null;
    }
    rightIndex += 1;
  }

  if (!leftWord && !rightWord) {
    return null;
  }

  if (!leftWord) {
    return rightWord;
  }

  if (!rightWord) {
    return leftWord;
  }

  const leftLength = leftWord.text.length;
  const rightLength = rightWord.text.length;
  const lengthDifference = Math.abs(leftLength - rightLength);

  if (lengthDifference <= 1) {
    return rightWord;
  }

  return leftLength > rightLength ? leftWord : rightWord;
};

export default findNearestWordToken;
