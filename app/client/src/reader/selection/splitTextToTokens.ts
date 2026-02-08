import type { textToken } from "../../types/textToken";

export const splitTextToTokens = (rawText: string, startOffset = 0): textToken[] => {
  const wordRegex = /[\p{L}\p{M}0-9]+(?:[’'\-][\p{L}\p{M}0-9]+)*/gu;
  const tokens: textToken[] = [];
  let cursorIndex = 0;

  for (const match of rawText.matchAll(wordRegex)) {
    const startIndex = match.index ?? 0;
    const wordText = match[0];
    const endIndex = startIndex + wordText.length;

    if (startIndex > cursorIndex) {
      const gapText = rawText.slice(cursorIndex, startIndex);
      tokens.push({
        index: tokens.length,
        text: gapText,
        startIndex: cursorIndex + startOffset,
        endIndex: startIndex + startOffset,
        type: "non-word"
      });
    }

    tokens.push({
      index: tokens.length,
      text: wordText,
      startIndex: startIndex + startOffset,
      endIndex: endIndex + startOffset,
      type: "word"
    });

    cursorIndex = endIndex;
  }

  if (cursorIndex < rawText.length) {
    const tailText = rawText.slice(cursorIndex);
    tokens.push({
      index: tokens.length,
      text: tailText,
      startIndex: cursorIndex + startOffset,
      endIndex: rawText.length + startOffset,
      type: "non-word"
    });
  }

  return tokens;
};
