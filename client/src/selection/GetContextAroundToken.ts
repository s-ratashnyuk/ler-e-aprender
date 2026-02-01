import type TextToken from "./TextToken";

const GetContextAroundToken = (
  Tokens: TextToken[],
  Token: TextToken,
  WindowSize: number
): { ContextLeft: string; ContextRight: string } => {
  const LeftWords: string[] = [];
  const RightWords: string[] = [];

  let LeftIndex = Token.Index - 1;
  while (LeftIndex >= 0 && LeftWords.length < WindowSize) {
    const Candidate = Tokens[LeftIndex];
    if (Candidate?.Type === "word") {
      LeftWords.unshift(Candidate.Text);
    }
    LeftIndex -= 1;
  }

  let RightIndex = Token.Index + 1;
  while (RightIndex < Tokens.length && RightWords.length < WindowSize) {
    const Candidate = Tokens[RightIndex];
    if (Candidate?.Type === "word") {
      RightWords.push(Candidate.Text);
    }
    RightIndex += 1;
  }

  return {
    ContextLeft: LeftWords.join(" "),
    ContextRight: RightWords.join(" ")
  };
};

export default GetContextAroundToken;
