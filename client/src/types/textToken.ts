type textToken = {
  index: number;
  text: string;
  startIndex: number;
  endIndex: number;
  type: "word" | "non-word";
};

export type { textToken as default };
