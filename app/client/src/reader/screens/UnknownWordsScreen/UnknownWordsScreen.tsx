import { useCallback, useMemo, useRef, useState, type MouseEvent, type JSX } from "react";
import { useNavigate } from "react-router-dom";
import type { popupState } from "../../../types/popupState";
import type { rootState } from "../../../types/rootState";
import type { translationEntry } from "../../../types/translationEntry";
import type { translationResponse } from "../../../types/translationResponse";
import { translateWord } from "../../../api/translateWord";
import { useAppDispatch } from "../../../store/hooks/useAppDispatch";
import { useAppSelector } from "../../../store/hooks/useAppSelector";
import { readerSlice } from "../../../store/readerSlice";
import { TranslationPopup } from "../../components/TranslationPopup";
import { handleContainerClickCapture as handleContainerClickCaptureImpl } from "../ReaderScreen/callbacks/handleContainerClickCapture";
import { buildTranslationEntryId } from "../ReaderScreen/utils/buildTranslationEntryId";

type wordCardItem = {
  key: string;
  entry: translationEntry;
  count: number;
  preview: string;
};

const normalizeWord = (value: string): string => value.trim().toLocaleLowerCase();

const mapEntryToResponse = (entry: translationEntry): translationResponse => {
  return {
    translation: entry.translation,
    isPending: false,
    usageExamples: entry.usageExamples,
    wordCard: entry.wordCard
  };
};

const getMostRecentEntry = (entries: translationEntry[]): translationEntry | null => {
  if (entries.length === 0) {
    return null;
  }

  return entries.reduce<translationEntry>((latest, entry) => {
    return entry.timestamp > latest.timestamp ? entry : latest;
  }, entries[0]);
};

const buildMeaningPreview = (entry: translationEntry): string => {
  const russian = entry.translation.russian.trim();
  const english = entry.translation.english.trim();
  const raw = russian || english;
  if (!raw) {
    return "Sem tradução.";
  }
  return raw.split(";")[0]?.trim() ?? raw;
};

const buildFallbackSentence = (entry: translationEntry): string => {
  const sentence = entry.contextSentence?.trim();
  if (sentence) {
    return sentence;
  }

  return [entry.contextLeft, entry.word, entry.contextRight]
    .filter((part) => part && part.trim().length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
};

export const UnknownWordsScreen = (): JSX.Element => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const activeBookId = useAppSelector((state: rootState) => state.reader.activeBookId);
  const books = useAppSelector((state: rootState) => state.reader.books);
  const translationsByWord = useAppSelector(
    (state: rootState) => state.reader.translationsByBook[activeBookId] ?? {}
  );
  const checkCountsByWord = useAppSelector(
    (state: rootState) => state.reader.checkCountsByBook[activeBookId] ?? {}
  );
  const hiddenWordsByKey = useAppSelector(
    (state: rootState) => state.reader.hiddenWordsByBook[activeBookId] ?? {}
  );

  const [popupState, setPopupState] = useState<popupState>({
    isOpen: false,
    statusText: "",
    word: "",
    response: null,
    isTranslationPending: false
  });
  const [selectedEntry, setSelectedEntry] = useState<translationEntry | null>(null);
  const requestIdRef = useRef(0);

  const closePopup = useCallback((): void => {
    requestIdRef.current += 1;
    setSelectedEntry(null);
    setPopupState({
      isOpen: false,
      statusText: "",
      word: "",
      response: null,
      isTranslationPending: false
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

  const wordItems = useMemo<wordCardItem[]>(() => {
    const items = Object.entries(translationsByWord)
      .map(([wordKey, entries]) => {
        const recent = getMostRecentEntry(entries);
        if (!recent) {
          return null;
        }
        if (hiddenWordsByKey[wordKey]) {
          return null;
        }
        const count = checkCountsByWord[wordKey] ?? entries.length;
        return {
          key: wordKey,
          entry: recent,
          count,
          preview: buildMeaningPreview(recent)
        };
      })
      .filter((item): item is wordCardItem => item !== null);

    return items.sort((a, b) => {
      if (b.count !== a.count) {
        return b.count - a.count;
      }
      return a.entry.word.localeCompare(b.entry.word);
    });
  }, [translationsByWord, checkCountsByWord, hiddenWordsByKey]);

  const activeBook = useMemo(
    () => books.find((book) => book.id === activeBookId) ?? null,
    [activeBookId, books]
  );

  const handleReturnClick = useCallback((): void => {
    navigate("/reader");
  }, [navigate]);

  const handleWordClick = useCallback((entry: translationEntry): void => {
    setSelectedEntry(entry);
    setPopupState({
      isOpen: true,
      statusText: "",
      word: entry.word,
      response: mapEntryToResponse(entry),
      isTranslationPending: false
    });
  }, []);

  const handleDeleteCurrent = useCallback((): void => {
    if (!activeBookId) {
      return;
    }

    const wordKey = normalizeWord(popupState.word || selectedEntry?.word || "");
    if (!wordKey) {
      return;
    }

    dispatch(readerSlice.actions.hideWordFromUnknowns({
      bookId: activeBookId,
      word: wordKey
    }));
    closePopup();
  }, [activeBookId, closePopup, dispatch, popupState.word, selectedEntry]);

  const hasContextForRefresh =
    selectedEntry &&
    Number.isFinite(selectedEntry.tokenStart) &&
    Number.isFinite(selectedEntry.tokenEnd);

  const refreshDisabled =
    !selectedEntry || !popupState.word.trim() || popupState.isTranslationPending || !hasContextForRefresh;
  const aiDisabled = refreshDisabled;

  const handleRefreshClick = useCallback(async (): Promise<void> => {
    if (!selectedEntry || !activeBookId || !hasContextForRefresh) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const contextSentence = buildFallbackSentence(selectedEntry);

    setPopupState((prev) => ({
      isOpen: true,
      statusText: "",
      word: prev.word,
      response: prev.response,
      isTranslationPending: true
    }));

    const payload = {
      bookId: activeBookId,
      tokenStart: selectedEntry.tokenStart ?? 0,
      tokenEnd: selectedEntry.tokenEnd ?? 0,
      word: selectedEntry.word,
      contextLeft: selectedEntry.contextLeft,
      contextRight: selectedEntry.contextRight,
      contextSentence,
      sourceLanguage: "Portuguese (Portugal)",
      targetLanguage: "Russo",
      forceRefresh: true
    };

    const pollPayload = {
      ...payload,
      forceRefresh: false
    };

    const pollUntilReady = async (): Promise<translationResponse | null> => {
      const delays = [600, 900, 1200, 1500, 1800, 2200];
      for (const delayMs of delays) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        const next = await translateWord(pollPayload);
        if (requestId !== requestIdRef.current) {
          return null;
        }
        if (!next.isPending) {
          return next;
        }
      }
      return null;
    };

    try {
      const translation = await translateWord(payload);
      if (requestId !== requestIdRef.current) {
        return;
      }

      setPopupState({
        isOpen: true,
        statusText: "",
        word: selectedEntry.word,
        response: translation,
        isTranslationPending: translation.isPending
      });

      const finalizeTranslation = (resolved: translationResponse): void => {
        const entry: translationEntry = {
          ...selectedEntry,
          id: buildTranslationEntryId(selectedEntry.word, selectedEntry.contextLeft, selectedEntry.contextRight),
          translation: resolved.translation,
          usageExamples: resolved.usageExamples,
          wordCard: resolved.wordCard,
          contextSentence,
          timestamp: Date.now()
        };

        setSelectedEntry(entry);
        setPopupState({
          isOpen: true,
          statusText: "",
          word: selectedEntry.word,
          response: resolved,
          isTranslationPending: false
        });

        dispatch(readerSlice.actions.upsertTranslation({
          bookId: activeBookId,
          entry
        }));
      };

      if (!translation.isPending) {
        finalizeTranslation(translation);
        return;
      }

      const resolved = await pollUntilReady();
      if (!resolved || requestId !== requestIdRef.current) {
        return;
      }

      finalizeTranslation(resolved);
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      const message = error instanceof Error ? error.message : "Erro ao traduzir.";
      setPopupState((prev) => ({
        isOpen: true,
        statusText: message,
        word: prev.word,
        response: prev.response,
        isTranslationPending: false
      }));
    }
  }, [activeBookId, dispatch, hasContextForRefresh, selectedEntry]);

  const handleAiClick = useCallback(async (): Promise<void> => {
    if (!selectedEntry || !activeBookId || !hasContextForRefresh) {
      return;
    }

    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    const contextSentence = buildFallbackSentence(selectedEntry);

    setPopupState((prev) => ({
      isOpen: true,
      statusText: "",
      word: prev.word,
      response: prev.response,
      isTranslationPending: true
    }));

    const payload = {
      bookId: activeBookId,
      tokenStart: selectedEntry.tokenStart ?? 0,
      tokenEnd: selectedEntry.tokenEnd ?? 0,
      word: selectedEntry.word,
      contextLeft: selectedEntry.contextLeft,
      contextRight: selectedEntry.contextRight,
      contextSentence,
      sourceLanguage: "Portuguese (Portugal)",
      targetLanguage: "Russo",
      forceOpenAi: true
    };

    const pollPayload = {
      ...payload,
      forceOpenAi: false
    };

    const pollUntilReady = async (): Promise<translationResponse | null> => {
      const delays = [600, 900, 1200, 1500, 1800, 2200];
      for (const delayMs of delays) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
        const next = await translateWord(pollPayload);
        if (requestId !== requestIdRef.current) {
          return null;
        }
        if (!next.isPending) {
          return next;
        }
      }
      return null;
    };

    try {
      const translation = await translateWord(payload);
      if (requestId !== requestIdRef.current) {
        return;
      }

      setPopupState({
        isOpen: true,
        statusText: "",
        word: selectedEntry.word,
        response: translation,
        isTranslationPending: translation.isPending
      });

      const finalizeTranslation = (resolved: translationResponse): void => {
        const entry: translationEntry = {
          ...selectedEntry,
          id: buildTranslationEntryId(selectedEntry.word, selectedEntry.contextLeft, selectedEntry.contextRight),
          translation: resolved.translation,
          usageExamples: resolved.usageExamples,
          wordCard: resolved.wordCard,
          contextSentence,
          timestamp: Date.now()
        };

        setSelectedEntry(entry);
        setPopupState({
          isOpen: true,
          statusText: "",
          word: selectedEntry.word,
          response: resolved,
          isTranslationPending: false
        });

        dispatch(readerSlice.actions.upsertTranslation({
          bookId: activeBookId,
          entry
        }));
      };

      if (!translation.isPending) {
        finalizeTranslation(translation);
        return;
      }

      const resolved = await pollUntilReady();
      if (!resolved || requestId !== requestIdRef.current) {
        return;
      }

      finalizeTranslation(resolved);
    } catch (error) {
      if (requestId !== requestIdRef.current) {
        return;
      }

      const message = error instanceof Error ? error.message : "Erro ao traduzir.";
      setPopupState((prev) => ({
        isOpen: true,
        statusText: message,
        word: prev.word,
        response: prev.response,
        isTranslationPending: false
      }));
    }
  }, [activeBookId, dispatch, hasContextForRefresh, selectedEntry]);

  return (
    <div className="page unknown-words-page">
      <div className="browser-shell">
        <div className="unknown-words-card">
          <div className="unknown-words-top">
            <div className="unknown-words-nav">
              <button
                className="return-button"
                type="button"
                onClick={handleReturnClick}
                aria-label="Retornar"
              >
                <svg viewBox="0 0 20 20" aria-hidden="true">
                  <path
                    d="M12.5 5.5L8 10l4.5 4.5"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <div className="unknown-words-title">
                <span className="unknown-words-eyebrow">Palavras marcadas</span>
                <h1 className="unknown-words-heading">
                  {activeBook?.title ?? "Suas palavras desconhecidas"}
                </h1>
                <p className="unknown-words-subtitle">
                  Toque em uma palavra para rever a tradução com o mesmo popup do leitor.
                </p>
              </div>
            </div>
            <div className="unknown-words-stats">
              <div className="unknown-words-stat">
                <span className="unknown-words-stat__label">Palavras</span>
                <span className="unknown-words-stat__value">{wordItems.length}</span>
              </div>
              <div className="unknown-words-stat">
                <span className="unknown-words-stat__label">Toques</span>
                <span className="unknown-words-stat__value">
                  {wordItems.reduce((sum, item) => sum + item.count, 0)}
                </span>
              </div>
            </div>
          </div>
          <div className="unknown-words-list" onClickCapture={handleContainerClickCapture}>
            {wordItems.length === 0 ? (
              <div className="unknown-words-empty">
                Nenhuma palavra marcada ainda. Leia o livro e toque em palavras para adicionar aqui.
              </div>
            ) : (
              wordItems.map((item) => {
                const isSelected = normalizeWord(popupState.word) === item.key && popupState.isOpen;
                return (
                  <button
                    key={item.key}
                    type="button"
                    className={`unknown-word${isSelected ? " is-selected" : ""}`}
                    onClick={() => handleWordClick(item.entry)}
                  >
                    <div className="unknown-word__text">
                      <span className="unknown-word__value">{item.entry.word}</span>
                      <span className="unknown-word__translation">{item.preview}</span>
                    </div>
                    <div className="unknown-word__count">
                      <span className="unknown-word__count-label">Toques</span>
                      <span className="unknown-word__count-value">{item.count}</span>
                    </div>
                  </button>
                );
              })
            )}
          </div>
          <TranslationPopup
            popupState={popupState}
            onRefresh={handleRefreshClick}
            onAi={handleAiClick}
            onDelete={handleDeleteCurrent}
            deleteDisabled={!selectedEntry || !popupState.word.trim()}
            deleteLabel="Remover palavra"
            refreshDisabled={refreshDisabled}
            aiDisabled={aiDisabled}
          />
        </div>
      </div>
    </div>
  );
};
