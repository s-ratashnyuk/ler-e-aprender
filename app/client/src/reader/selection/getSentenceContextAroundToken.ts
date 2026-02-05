import type { textToken } from "../../types/textToken";

type sentenceContext = {
  contextLeft: string;
  contextRight: string;
  sentence: string;
};

const isSentenceBoundary = (char: string): boolean => {
  return char === "." || char === "!" || char === "?" || char === "\n";
};

const normalizeWhitespace = (value: string): string => {
  return value.replace(/\s+/g, " ").trim();
};

export const getSentenceContextAroundToken = (
  rawText: string,
  tokens: textToken[],
  token: textToken,
  maxWordsEachSide: number
): sentenceContext => {
  const textLength = rawText.length;
  let sentenceStart = 0;

  for (let index = token.startIndex - 1; index >= 0; index -= 1) {
    if (isSentenceBoundary(rawText[index])) {
      sentenceStart = index + 1;
      break;
    }
  }

  while (sentenceStart < textLength && /[\s"'([{]/.test(rawText[sentenceStart])) {
    sentenceStart += 1;
  }

  let sentenceEnd = textLength;
  for (let index = token.endIndex; index < textLength; index += 1) {
    if (isSentenceBoundary(rawText[index])) {
      sentenceEnd = index + 1;
      break;
    }
  }

  while (sentenceEnd < textLength && /["')\]}]/.test(rawText[sentenceEnd])) {
    sentenceEnd += 1;
  }

  const sentenceWordTokens = tokens.filter(
    (candidate) =>
      candidate.type === "word" &&
      candidate.startIndex >= sentenceStart &&
      candidate.endIndex <= sentenceEnd
  );

  const selectedIndex = sentenceWordTokens.findIndex((candidate) => candidate.index === token.index);
  if (selectedIndex < 0 || sentenceWordTokens.length === 0) {
    return {
      contextLeft: "",
      contextRight: "",
      sentence: normalizeWhitespace(rawText.slice(sentenceStart, sentenceEnd))
    };
  }

  const maxWindowSize = maxWordsEachSide * 2 + 1;
  const needsTruncation = sentenceWordTokens.length > maxWindowSize;
  const maxContextWords = needsTruncation ? maxWordsEachSide : sentenceWordTokens.length;

  const leftWords: string[] = [];
  for (let index = selectedIndex - 1; index >= 0 && leftWords.length < maxContextWords; index -= 1) {
    leftWords.unshift(sentenceWordTokens[index].text);
  }

  const rightWords: string[] = [];
  for (
    let index = selectedIndex + 1;
    index < sentenceWordTokens.length && rightWords.length < maxContextWords;
    index += 1
  ) {
    rightWords.push(sentenceWordTokens[index].text);
  }

  let sentence = normalizeWhitespace(rawText.slice(sentenceStart, sentenceEnd));
  if (needsTruncation) {
    const startWordIndex = Math.max(0, selectedIndex - maxWordsEachSide);
    const endWordIndex = Math.min(sentenceWordTokens.length - 1, selectedIndex + maxWordsEachSide);
    const startToken = sentenceWordTokens[startWordIndex];
    const endToken = sentenceWordTokens[endWordIndex];
    let snippet = normalizeWhitespace(rawText.slice(startToken.startIndex, endToken.endIndex));
    if (startWordIndex > 0) {
      snippet = `... ${snippet}`;
    }
    if (endWordIndex < sentenceWordTokens.length - 1) {
      snippet = `${snippet} ...`;
    }
    sentence = snippet;
  }

  return {
    contextLeft: leftWords.join(" "),
    contextRight: rightWords.join(" "),
    sentence
  };
};
