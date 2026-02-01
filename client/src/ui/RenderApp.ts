import StoryText from "../content/StoryText";
import type TranslationRequest from "../api/TranslationRequest";
import type TranslationResponse from "../api/TranslationResponse";
import TranslateWord from "../api/TranslateWord";
import SplitTextToTokens from "../selection/SplitTextToTokens";
import GetTokenIndexFromElement from "../selection/GetTokenIndexFromElement";
import FindNearestWordToken from "../selection/FindNearestWordToken";
import GetContextAroundToken from "../selection/GetContextAroundToken";
import CreateTokenSpans from "./CreateTokenSpans";
import CreateLayout from "./CreateLayout";
import BuildDetailsText from "./BuildDetailsText";

const RenderApp = (Root: HTMLElement): void => {
  const Layout = CreateLayout();
  Root.appendChild(Layout.Page);

  const Tokens = SplitTextToTokens(StoryText);
  const TokenSpans = CreateTokenSpans(Tokens);
  Layout.TextContainer.appendChild(TokenSpans.Fragment);

  let SelectedTokenIndex: number | null = null;

  const ClearSelection = (): void => {
    if (SelectedTokenIndex === null) {
      return;
    }
    const PreviousElement = TokenSpans.TokenElementsByIndex.get(SelectedTokenIndex);
    PreviousElement?.classList.remove("is-selected");
    SelectedTokenIndex = null;
  };

  const SetPopupContent = (Response: TranslationResponse, Word: string): void => {
    const PartOfSpeechText = Response.PartOfSpeech
      ? `${Word} (${Response.PartOfSpeech})`
      : Word;
    Layout.PopupWord.textContent = PartOfSpeechText;
    Layout.PopupTranslation.textContent = Response.Translation;
    Layout.PopupDetails.textContent = BuildDetailsText(Response);
    Layout.PopupExample.textContent = Response.Example;
  };

  const SetPopupStatus = (StatusText: string): void => {
    Layout.PopupWord.textContent = StatusText;
    Layout.PopupTranslation.textContent = "";
    Layout.PopupDetails.textContent = "";
    Layout.PopupExample.textContent = "";
  };

  const ShowPopup = (): void => {
    Layout.Popup.classList.add("is-visible");
  };

  const HidePopup = (): void => {
    Layout.Popup.classList.remove("is-visible");
  };

  const UpdateSelection = (TokenIndex: number): void => {
    if (SelectedTokenIndex !== null) {
      const PreviousElement = TokenSpans.TokenElementsByIndex.get(SelectedTokenIndex);
      PreviousElement?.classList.remove("is-selected");
    }
    SelectedTokenIndex = TokenIndex;
    const NewElement = TokenSpans.TokenElementsByIndex.get(TokenIndex);
    NewElement?.classList.add("is-selected");
  };

  const HandleClick = async (Event: MouseEvent): Promise<void> => {
    if (Layout.Popup.classList.contains("is-visible")) {
      ClearSelection();
      HidePopup();
      return;
    }

    const TokenIndex = GetTokenIndexFromElement(Event.target);
    if (TokenIndex === null) {
      ClearSelection();
      HidePopup();
      return;
    }

    const SelectedToken = FindNearestWordToken(Tokens, TokenIndex);
    if (!SelectedToken) {
      ClearSelection();
      HidePopup();
      return;
    }

    UpdateSelection(SelectedToken.Index);
    SetPopupStatus("A traduzir...");
    ShowPopup();

    const Context = GetContextAroundToken(Tokens, SelectedToken, 4);
    const Payload: TranslationRequest = {
      Word: SelectedToken.Text,
      ContextLeft: Context.ContextLeft,
      ContextRight: Context.ContextRight,
      SourceLanguage: "Portugues de Portugal",
      TargetLanguage: "Russo"
    };

    try {
      const Translation = await TranslateWord(Payload);
      SetPopupContent(Translation, SelectedToken.Text);
    } catch (Error) {
      const Message = Error instanceof Error ? Error.message : "Erro ao traduzir.";
      SetPopupStatus(Message);
    }
  };

  Layout.TextContainer.addEventListener("click", HandleClick);
};

export default RenderApp;
