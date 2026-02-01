type TextToken = {
  Index: number;
  Text: string;
  StartIndex: number;
  EndIndex: number;
  Type: "word" | "non-word";
};

export type { TextToken as default };
