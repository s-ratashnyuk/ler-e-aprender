type LayoutRefs = {
  Page: HTMLDivElement;
  ReaderCard: HTMLDivElement;
  TextContainer: HTMLDivElement;
  Popup: HTMLDivElement;
  PopupWord: HTMLDivElement;
  PopupTranslation: HTMLDivElement;
  PopupExample: HTMLDivElement;
  PopupDetails: HTMLDivElement;
};

const CreateLayout = (): LayoutRefs => {
  const Page = document.createElement("div");
  Page.className = "page";
  Page.innerHTML = `
    <div class="browser-shell">
      <div class="reader-card">
        <div class="reader-text" role="article" aria-label="Texto do livro"></div>
        <div class="popup" role="dialog" aria-live="polite">
          <div class="popup-word"></div>
          <div class="popup-translation"></div>
          <div class="popup-details"></div>
          <div class="popup-example"></div>
        </div>
      </div>
    </div>
  `;

  const ReaderCard = Page.querySelector<HTMLDivElement>(".reader-card");
  const TextContainer = Page.querySelector<HTMLDivElement>(".reader-text");
  const Popup = Page.querySelector<HTMLDivElement>(".popup");
  const PopupWord = Page.querySelector<HTMLDivElement>(".popup-word");
  const PopupTranslation = Page.querySelector<HTMLDivElement>(".popup-translation");
  const PopupDetails = Page.querySelector<HTMLDivElement>(".popup-details");
  const PopupExample = Page.querySelector<HTMLDivElement>(".popup-example");

  if (
    !ReaderCard ||
    !TextContainer ||
    !Popup ||
    !PopupWord ||
    !PopupTranslation ||
    !PopupDetails ||
    !PopupExample
  ) {
    throw new Error("Layout creation failed.");
  }

  return {
    Page,
    ReaderCard,
    TextContainer,
    Popup,
    PopupWord,
    PopupTranslation,
    PopupDetails,
    PopupExample
  };
};

export default CreateLayout;
