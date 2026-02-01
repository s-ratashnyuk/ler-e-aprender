import type TextToken from "./TextToken";

const SplitTextToTokens = (RawText: string): TextToken[] => {
  const WordRegex = /[\p{L}\p{M}0-9]+(?:[’'\-][\p{L}\p{M}0-9]+)*/gu;
  const Tokens: TextToken[] = [];
  let CursorIndex = 0;

  for (const Match of RawText.matchAll(WordRegex)) {
    const StartIndex = Match.index ?? 0;
    const WordText = Match[0];
    const EndIndex = StartIndex + WordText.length;

    if (StartIndex > CursorIndex) {
      const GapText = RawText.slice(CursorIndex, StartIndex);
      Tokens.push({
        Index: Tokens.length,
        Text: GapText,
        StartIndex: CursorIndex,
        EndIndex: StartIndex,
        Type: "non-word"
      });
    }

    Tokens.push({
      Index: Tokens.length,
      Text: WordText,
      StartIndex,
      EndIndex,
      Type: "word"
    });

    CursorIndex = EndIndex;
  }

  if (CursorIndex < RawText.length) {
    const TailText = RawText.slice(CursorIndex);
    Tokens.push({
      Index: Tokens.length,
      Text: TailText,
      StartIndex: CursorIndex,
      EndIndex: RawText.length,
      Type: "non-word"
    });
  }

  return Tokens;
};

export default SplitTextToTokens;
