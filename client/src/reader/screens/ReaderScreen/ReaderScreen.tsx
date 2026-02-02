import { useCallback, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { JSX } from "react";
import type { popupState } from "../../../types/popupState";
import type { rootState } from "../../../types/rootState";
import type { textToken } from "../../../types/textToken";
import { splitTextToTokens } from "../../selection/splitTextToTokens";
import { useAppDispatch } from "../../../store/hooks/useAppDispatch";
import { useAppSelector } from "../../../store/hooks/useAppSelector";
import { storyText } from "../../../content/storyText";
import { handleContainerClickCapture as handleContainerClickCaptureImpl } from "./callbacks/handleContainerClickCapture";
import { handleScroll as handleScrollImpl } from "./callbacks/handleScroll"
import { handleTokenClick as handleTokenClickImpl } from "./callbacks/handleTokenClick";
import { renderToken as renderTokenImpl } from "./renderToken";
import { syncScrollPosition as syncScrollPositionImpl } from "./utils/syncScrollPosition";

const renderBoldText = (value: string): JSX.Element | string => {
  let normalized = value.replace(/<\/?strong>/gi, (match) =>
    match.startsWith("</") ? "</b>" : "<b>"
  );
  if (!normalized.includes("<b>") && normalized.includes("**")) {
    const parts = normalized.split("**");
    normalized = parts
      .map((part, index) => (index % 2 === 1 ? `<b>${part}</b>` : part))
      .join("");
  }
  if (!normalized.includes("<b>")) {
    return value;
  }

  const tagPattern = /<\/?b>/gi;
  const segments = normalized.split(tagPattern);
  const tags = normalized.match(tagPattern) ?? [];
  let isBold = false;

  return (
    <>
      {segments.map((segment, index) => {
        const node = isBold ? (
          <strong key={`bold-${index}`}>{segment}</strong>
        ) : (
          <span key={`text-${index}`}>{segment}</span>
        );

        if (index < tags.length) {
          isBold = tags[index].toLowerCase() === "<b>";
        }

        return node;
      })}
    </>
  );
};

export const ReaderScreen = (): JSX.Element => {
  const dispatch = useAppDispatch();
  const selectActiveBookId = useCallback(
    (state: rootState): string => state.reader.activeBookId,
    []
  );
  const selectProgressByBook = useCallback(
    (state: rootState): Record<string, number> => state.reader.progressByBook,
    []
  );
  const activeBookId = useAppSelector(selectActiveBookId);
  const progressByBook = useAppSelector(selectProgressByBook);
  const savedProgress = progressByBook[activeBookId] ?? 0;
  const savedTranslationsByWord = useAppSelector(
    (state) => state.reader.translationsByBook[activeBookId] ?? {}
  );

  const tokens = useMemo((): textToken[] => splitTextToTokens(storyText), []);
  const textContainerRef = useRef<HTMLDivElement | null>(null);
  const requestIdRef = useRef(0);

  const [selectedTokenIndex, setSelectedTokenIndex] = useState<number | null>(null);
  const [popupState, setPopupState] = useState<popupState>({
    isOpen: false,
    statusText: "",
    word: "",
    response: null
  });

  const syncScrollPosition = useCallback((): void => {
    syncScrollPositionImpl({
      textContainerRef,
      savedProgress
    });
  }, [savedProgress, tokens.length]);

  useLayoutEffect(syncScrollPosition, [syncScrollPosition]);

  const closePopup = useCallback((): void => {
    requestIdRef.current += 1;
    setSelectedTokenIndex(null);
    setPopupState({
      isOpen: false,
      statusText: "",
      word: "",
      response: null
    });
  }, []);

  const handleContainerClickCapture = useCallback(
    (event: MouseEvent<HTMLDivElement>): void => {
      handleContainerClickCaptureImpl(
        {
          closePopup,
          isPopupOpen: popupState.isOpen
        },
        event
      );
    },
    [closePopup, popupState.isOpen]
  );

  const handleScroll = useCallback((): void => {
    handleScrollImpl({
      activeBookId,
      dispatch,
      textContainerRef
    });
  }, [activeBookId, dispatch]);

  const handleTokenClick = useCallback(
    async (tokenIndex: number): Promise<void> => {
      await handleTokenClickImpl({
        tokenIndex,
        activeBookId,
        closePopup,
        dispatch,
        popupStateIsOpen: popupState.isOpen,
        requestIdRef,
        savedTranslationsByWord,
        setPopupState,
        setSelectedTokenIndex,
        tokens,
        rawText: storyText
      });
    },
    [activeBookId, closePopup, dispatch, popupState.isOpen, savedTranslationsByWord, tokens]
  );

  const popupWordText = popupState.response
    ? (() => {
      const partOfSpeech = popupState.response.partOfSpeech.trim();
      if (!partOfSpeech) {
        return popupState.word;
      }

      const isVerb = partOfSpeech.toLocaleLowerCase().includes("verbo");
      if (!isVerb) {
        return `${popupState.word} (${partOfSpeech})`;
      }

      const regularity = popupState.response.isIrregular ? "irregular" : "regular";
      return `${popupState.word} (${partOfSpeech}, ${regularity})`;
    })()
    : popupState.word || popupState.statusText;

  const popupTranslationText = popupState.response
    ? popupState.response.translation
    : popupState.statusText;

  const popupTenseLine = popupState.response
    ? (() => {
      const tenseLabel = popupState.response.tense.trim();
      const infinitive = popupState.response.infinitive.trim();

      if (!tenseLabel && !infinitive) {
        return "";
      }

      if (tenseLabel && infinitive) {
        return `${tenseLabel}, inf.: ${infinitive}`;
      }

      if (infinitive) {
        return `inf.: ${infinitive}`;
      }

      return tenseLabel;
    })()
    : "";

  const usageExamples = popupState.response?.usageExamples ?? [];
  const verbForms = popupState.response?.verbForms ?? [];
  const orderedVerbForms = useMemo(() => {
    if (verbForms.length === 0) {
      return verbForms;
    }

    const imperativoRows: typeof verbForms = [];
    const otherRows: typeof verbForms = [];

    verbForms.forEach((row) => {
      const label = row.tense.trim().toLocaleLowerCase();
      if (label.startsWith("imperativo")) {
        imperativoRows.push(row);
      } else {
        otherRows.push(row);
      }
    });

    return [...otherRows, ...imperativoRows];
  }, [verbForms]);

  const renderToken = useCallback(
    (token: textToken): JSX.Element => {
      return renderTokenImpl({
        token,
        onTokenClick: handleTokenClick,
        selectedTokenIndex
      });
    },
    [handleTokenClick, selectedTokenIndex]
  );

  return (
    <div className="page">
      <div className="browser-shell">
        <div className="reader-card">
          <div
            className="reader-text"
            role="article"
            aria-label="Texto do livro"
            ref={textContainerRef}
            onScroll={handleScroll}
            onClickCapture={handleContainerClickCapture}
          >
            {tokens.map(renderToken)}
          </div>
          <div className={`popup${popupState.isOpen ? " is-visible" : ""}`} role="dialog" aria-live="polite">
            <div className="popup-word">{popupWordText}</div>
            <div className="popup-translation">{renderBoldText(popupTranslationText)}</div>
            {popupTenseLine ? <div className="popup-subline">{popupTenseLine}</div> : null}
            {usageExamples.length > 0 ? (
              <div className="popup-usage">
                {usageExamples.map((example, index) => (
                  <div className="usage-item" key={`${example.portuguese}-${index}`}>
                    <div className="usage-label">Uso {index + 1}</div>
                    <div className="usage-pt">{renderBoldText(example.portuguese)}</div>
                    <div className="usage-translation">{renderBoldText(example.translation)}</div>
                  </div>
                ))}
              </div>
            ) : null}
            {orderedVerbForms.length > 0 ? (
              <div className="popup-forms">
                <div className="forms-title">FORMAS VERBAIS</div>
                <div className="forms-table" role="table">
                  <div className="forms-row forms-head" role="row">
                    <div className="forms-cell tempo" role="columnheader">Tempo</div>
                    <div className="forms-cell" role="columnheader">Forma</div>
                  </div>
                  {orderedVerbForms.map((row, index) => (
                    <div className="forms-row" role="row" key={`${row.tense}-${index}`}>
                      <div className="forms-cell tempo" role="cell">{row.tense}</div>
                      <div className="forms-cell" role="cell">{row.forms}</div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};
