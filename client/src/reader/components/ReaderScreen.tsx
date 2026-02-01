import { useCallback, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { JSX } from "react";
import type { popupState } from "../../types/popupState";
import type { rootState } from "../../types/rootState";
import type { textToken } from "../../types/textToken";
import type { translationEntry } from "../../types/translationEntry";
import type { translationRequest } from "../../types/translationRequest";
import { splitTextToTokens } from "../selection/splitTextToTokens";
import { findNearestWordToken } from "../selection/findNearestWordToken";
import { getContextAroundToken } from "../selection/getContextAroundToken";
import { useAppDispatch } from "../../store/hooks/useAppDispatch";
import { useAppSelector } from "../../store/hooks/useAppSelector";
import { readerSlice, selectFirstTranslationsByWord } from "../../store/readerSlice";
import { storyText } from "../../content/StoryText";
import { translateWord } from "../../api/TranslateWord";

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
  const savedTranslationsByWord = useAppSelector((state) =>
    selectFirstTranslationsByWord(state, activeBookId)
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
    const container = textContainerRef.current;
    if (!container) {
      return;
    }

    const maxScroll = container.scrollHeight - container.clientHeight;
    container.scrollTop = maxScroll * savedProgress;
  }, [savedProgress, tokens]);

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
      if (!popupState.isOpen) {
        return;
      }

      event.stopPropagation();
      closePopup();
    },
    [closePopup, popupState.isOpen]
  );

  const handleScroll = useCallback((): void => {
    const container = textContainerRef.current;
    if (!container) {
      return;
    }

    const maxScroll = container.scrollHeight - container.clientHeight;
    const progress = maxScroll > 0 ? container.scrollTop / maxScroll : 0;

    dispatch(readerSlice.actions.setReadingProgress({
      bookId: activeBookId,
      progress
    }));
  }, [activeBookId, dispatch]);

  const handleTokenClick = useCallback(
    async (tokenIndex: number): Promise<void> => {
      if (popupState.isOpen) {
        return;
      }

      const selectedToken = findNearestWordToken(tokens, tokenIndex);
      if (!selectedToken) {
        closePopup();
        return;
      }

      setSelectedTokenIndex(selectedToken.index);

      const requestId = requestIdRef.current + 1;
      requestIdRef.current = requestId;

      const normalizedWord = selectedToken.text.trim().toLocaleLowerCase();
      const savedTranslation = savedTranslationsByWord[normalizedWord] ?? null;

      if (savedTranslation) {
        setPopupState({
          isOpen: true,
          statusText: "",
          word: selectedToken.text,
          response: savedTranslation
        });
        return;
      }

      setPopupState({
        isOpen: true,
        statusText: "A traduzir...",
        word: selectedToken.text,
        response: null
      });

      const context = getContextAroundToken(tokens, selectedToken, 4);
      const payload: translationRequest = {
        word: selectedToken.text,
        contextLeft: context.contextLeft,
        contextRight: context.contextRight,
        sourceLanguage: "Portugues de Portugal",
        targetLanguage: "Russo"
      };

      try {
        const translation = await translateWord(payload);
        if (requestId !== requestIdRef.current) {
          return;
        }

        setPopupState({
          isOpen: true,
          statusText: "",
          word: selectedToken.text,
          response: translation
        });

        const entry: translationEntry = {
          id: crypto.randomUUID(),
          word: selectedToken.text,
          contextLeft: context.contextLeft,
          contextRight: context.contextRight,
          translation: translation.translation,
          partOfSpeech: translation.partOfSpeech,
          tense: translation.tense,
          infinitive: translation.infinitive,
          isIrregular: translation.isIrregular,
          usageExamples: translation.usageExamples,
          verbForms: translation.verbForms,
          timestamp: Date.now()
        };

        dispatch(readerSlice.actions.addTranslation({
          bookId: activeBookId,
          entry
        }));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Erro ao traduzir.";
        setPopupState({
          isOpen: true,
          statusText: message,
          word: selectedToken.text,
          response: null
        });
      }
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

  const renderToken = useCallback(
    (token: textToken): JSX.Element => {
      const isSelected = selectedTokenIndex === token.index;
      const isWord = token.type === "word";
      const className = ["token", isWord ? "word-token" : "", isSelected ? "is-selected" : ""]
        .filter(Boolean)
        .join(" ");

      return (
        <span
          key={token.index}
          className={className}
          onClick={() => handleTokenClick(token.index)}
        >
          {token.text}
        </span>
      );
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
            <div className="popup-translation">{popupTranslationText}</div>
            {popupTenseLine ? <div className="popup-subline">{popupTenseLine}</div> : null}
            {usageExamples.length > 0 ? (
              <div className="popup-usage">
                {usageExamples.map((example, index) => (
                  <div className="usage-item" key={`${example.portuguese}-${index}`}>
                    <div className="usage-label">Uso {index + 1}</div>
                    <div className="usage-pt">{example.portuguese}</div>
                    <div className="usage-translation">{example.translation}</div>
                  </div>
                ))}
              </div>
            ) : null}
            {verbForms.length > 0 ? (
              <div className="popup-forms">
                <div className="forms-title">FORMAS VERBAIS</div>
                <div className="forms-table" role="table">
                  <div className="forms-row forms-head" role="row">
                    <div className="forms-cell tempo" role="columnheader">Tempo</div>
                    <div className="forms-cell" role="columnheader">Forma</div>
                  </div>
                  {verbForms.map((row, index) => (
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
