import type TextToken from "../selection/TextToken";

type TokenSpanResult = {
  Fragment: DocumentFragment;
  TokenElementsByIndex: Map<number, HTMLSpanElement>;
};

const CreateTokenSpans = (Tokens: TextToken[]): TokenSpanResult => {
  const Fragment = document.createDocumentFragment();
  const TokenElementsByIndex = new Map<number, HTMLSpanElement>();

  for (const Token of Tokens) {
    const Span = document.createElement("span");
    Span.dataset.tokenIndex = String(Token.Index);
    Span.textContent = Token.Text;
    Span.className = "token";

    if (Token.Type === "word") {
      Span.classList.add("word-token");
      TokenElementsByIndex.set(Token.Index, Span);
    }

    Fragment.appendChild(Span);
  }

  return { Fragment, TokenElementsByIndex };
};

export default CreateTokenSpans;
