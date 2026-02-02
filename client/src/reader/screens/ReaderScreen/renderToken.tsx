import type { JSX } from "react";
import type { textToken } from "../../../types/textToken";

type RenderTokenParams = {
  onTokenClick: (tokenIndex: number) => void | Promise<void>;
  selectedTokenIndex: number | null;
  token: textToken;
};

export const renderToken = ({ onTokenClick, selectedTokenIndex, token }: RenderTokenParams): JSX.Element => {
  const isSelected = selectedTokenIndex === token.index;
  const isWord = token.type === "word";
  const className = ["token", isWord ? "word-token" : "", isSelected ? "is-selected" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      key={token.index}
      className={className}
      onClick={() => onTokenClick(token.index)}
    >
      {token.text}
    </span>
  );
};
