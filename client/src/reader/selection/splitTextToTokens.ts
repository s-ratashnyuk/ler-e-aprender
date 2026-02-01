import type textToken from "../../types/textToken";

const splitTextToTokens = (rawText: string): textToken[] => {
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
        startIndex: cursorIndex,
        endIndex: startIndex,
        type: "non-word"
      });
    }

    tokens.push({
      index: tokens.length,
      text: wordText,
      startIndex,
      endIndex,
      type: "word"
    });

    cursorIndex = endIndex;
  }

  if (cursorIndex < rawText.length) {
    const tailText = rawText.slice(cursorIndex);
    tokens.push({
      index: tokens.length,
      text: tailText,
      startIndex: cursorIndex,
      endIndex: rawText.length,
      type: "non-word"
    });
  }

  return tokens;
};

export default splitTextToTokens;
