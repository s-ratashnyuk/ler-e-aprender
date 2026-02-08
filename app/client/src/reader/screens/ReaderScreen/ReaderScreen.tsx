import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { JSX } from "react";
import { useNavigate } from "react-router-dom";
import type { popupState } from "../../../types/popupState";
import type { rootState } from "../../../types/rootState";
import type { textToken } from "../../../types/textToken";
import type { bookDetail } from "../../../types/bookDetail";
import { splitTextToTokens } from "../../selection/splitTextToTokens";
import { useAppDispatch } from "../../../store/hooks/useAppDispatch";
import { useAppSelector } from "../../../store/hooks/useAppSelector";
import { handleContainerClickCapture as handleContainerClickCaptureImpl } from "./callbacks/handleContainerClickCapture";
import { handleAiClick as handleAiClickImpl } from "./callbacks/handleAiClick";
import { handleRefreshClick as handleRefreshClickImpl } from "./callbacks/handleRefreshClick";
import { handleScroll as handleScrollImpl } from "./callbacks/handleScroll";
import { handleTokenClick as handleTokenClickImpl } from "./callbacks/handleTokenClick";
import { renderToken as renderTokenImpl } from "./renderToken";
import { syncScrollPosition as syncScrollPositionImpl } from "./utils/syncScrollPosition";
import { fetchBookCatalog, fetchBookChunk, fetchBookMeta } from "../../../api/books";
import { readerSlice } from "../../../store/readerSlice";

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

const normalizeWord = (value: string): string => value.trim().toLocaleLowerCase();

const CHUNK_SIZE = 8000;
const CHUNK_WINDOW_RADIUS = 1;

export const ReaderScreen = (): JSX.Element => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const selectActiveBookId = useCallback(
    (state: rootState): string => state.reader.activeBookId,
    []
  );
  const selectProgressByBook = useCallback(
    (state: rootState): Record<string, number> => state.reader.progressByBook,
    []
  );
  const selectPositionByBook = useCallback(
    (state: rootState): Record<string, number> => state.reader.positionByBook,
    []
  );
  const activeBookId = useAppSelector(selectActiveBookId);
  const books = useAppSelector((state: rootState) => state.reader.books);
  const progressByBook = useAppSelector(selectProgressByBook);
  const positionByBook = useAppSelector(selectPositionByBook);
  const savedProgress = progressByBook[activeBookId] ?? 0;
  const savedPosition = positionByBook[activeBookId];
  const savedTranslationsByWord = useAppSelector(
    (state) => state.reader.translationsByBook[activeBookId] ?? {}
  );
  const translatedWords = useMemo(() => {
    const entries = Object.entries(savedTranslationsByWord);
    return new Set(
      entries.filter(([, values]) => values.length > 0).map(([word]) => word)
    );
  }, [savedTranslationsByWord]);

  const [bookDetail, setBookDetail] = useState<bookDetail | null>(null);
  const [bookStatus, setBookStatus] = useState<"idle" | "loading" | "error">("idle");
  const [chunkStatus, setChunkStatus] = useState<"idle" | "loading" | "error">("idle");
  const [chunksByIndex, setChunksByIndex] = useState<Record<number, {
    offset: number;
    length: number;
    content: string;
    tokens: textToken[];
  }>>({});
  const chunksByIndexRef = useRef(chunksByIndex);
  const [currentChunkIndex, setCurrentChunkIndex] = useState(0);
  const [anchorOffset, setAnchorOffset] = useState(0);
  const hasInitializedRef = useRef(false);
  const restorePendingRef = useRef(false);
  const inflightChunksRef = useRef<Set<number>>(new Set());
  const scrollRafRef = useRef<number | null>(null);
  const textContainerRef = useRef<HTMLDivElement | null>(null);
  const requestIdRef = useRef(0);
  const activeBookIdRef = useRef(activeBookId);

  const contentLength = bookDetail?.contentLength ?? 0;
  const totalChunks = contentLength > 0 ? Math.ceil(contentLength / CHUNK_SIZE) : 0;
  const windowStartIndex =
    totalChunks > 0 ? Math.max(0, currentChunkIndex - CHUNK_WINDOW_RADIUS) : 0;
  const windowEndIndex =
    totalChunks > 0 ? Math.min(totalChunks - 1, currentChunkIndex + CHUNK_WINDOW_RADIUS) : 0;
  const windowOffset = windowStartIndex * CHUNK_SIZE;

  const windowText = useMemo(() => {
    if (!bookDetail || totalChunks === 0) {
      return "";
    }

    let text = "";
    for (let index = windowStartIndex; index <= windowEndIndex; index += 1) {
      const chunk = chunksByIndex[index];
      if (chunk) {
        text += chunk.content;
        continue;
      }

      const offset = index * CHUNK_SIZE;
      const expectedLength = Math.max(0, Math.min(CHUNK_SIZE, contentLength - offset));
      if (expectedLength > 0) {
        text += " ".repeat(expectedLength);
      }
    }

    return text;
  }, [bookDetail, chunksByIndex, windowStartIndex, windowEndIndex, contentLength, totalChunks]);

  const windowTokens = useMemo((): textToken[] => {
    if (totalChunks === 0) {
      return [];
    }

    const tokens: textToken[] = [];
    for (let index = windowStartIndex; index <= windowEndIndex; index += 1) {
      const chunk = chunksByIndex[index];
      if (!chunk) {
        continue;
      }
      for (const token of chunk.tokens) {
        tokens.push({
          ...token,
          index: tokens.length
        });
      }
    }

    return tokens;
  }, [chunksByIndex, windowStartIndex, windowEndIndex, totalChunks]);

  const handleReturnClick = useCallback((): void => {
    navigate("/books");
  }, [navigate]);

  const [selectedTokenIndex, setSelectedTokenIndex] = useState<number | null>(null);
  const [popupState, setPopupState] = useState<popupState>({
    isOpen: false,
    statusText: "",
    word: "",
    response: null,
    isTranslationPending: false
  });
  const [showEnglishTranslation, setShowEnglishTranslation] = useState(false);
  const [showRussianMeanings, setShowRussianMeanings] = useState(false);
  const popupOpenRef = useRef(false);
  const selectedTokenIndexRef = useRef<number | null>(null);

  useEffect(() => {
    if (books.length > 0) {
      return;
    }

    let isMounted = true;
    fetchBookCatalog()
      .then((catalog) => {
        if (!isMounted) {
          return;
        }
        dispatch(readerSlice.actions.setBooks(catalog));
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        if (error instanceof Error && error.message === "Unauthorized") {
          navigate("/login", { replace: true });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [books.length, dispatch, navigate]);

  useEffect(() => {
    if (!activeBookId) {
      setBookDetail(null);
      setChunksByIndex({});
      setBookStatus("idle");
      setChunkStatus("idle");
      return;
    }

    let isMounted = true;
    restorePendingRef.current = false;
    hasInitializedRef.current = false;
    inflightChunksRef.current.clear();
    setChunksByIndex({});
    setCurrentChunkIndex(0);
    setAnchorOffset(0);
    setBookStatus("loading");
    fetchBookMeta(activeBookId)
      .then((detail) => {
        if (!isMounted) {
          return;
        }
        setBookDetail(detail);
        setBookStatus("idle");
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }
        setBookStatus("error");
        if (error instanceof Error && error.message === "Unauthorized") {
          navigate("/login", { replace: true });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [activeBookId, navigate]);

  useEffect(() => {
    chunksByIndexRef.current = chunksByIndex;
  }, [chunksByIndex]);

  useEffect(() => {
    activeBookIdRef.current = activeBookId;
  }, [activeBookId]);

  const loadChunk = useCallback(
    async (index: number): Promise<void> => {
      if (!activeBookId || !bookDetail || index < 0) {
        return;
      }

      if (chunksByIndexRef.current[index]) {
        return;
      }
      if (inflightChunksRef.current.has(index)) {
        return;
      }

      const offset = index * CHUNK_SIZE;
      const length = Math.max(0, Math.min(CHUNK_SIZE, contentLength - offset));
      if (length <= 0) {
        return;
      }

      inflightChunksRef.current.add(index);
      setChunkStatus("loading");
      const requestBookId = activeBookId;

      try {
        const chunk = await fetchBookChunk(activeBookId, offset, length);
        if (activeBookIdRef.current !== requestBookId) {
          return;
        }

        const tokens = splitTextToTokens(chunk.content, chunk.offset);
        setChunksByIndex((prev) => ({
          ...prev,
          [index]: {
            offset: chunk.offset,
            length: chunk.length,
            content: chunk.content,
            tokens
          }
        }));
        setChunkStatus("idle");
      } catch (error) {
        if (activeBookIdRef.current !== requestBookId) {
          return;
        }
        setChunkStatus("error");
      } finally {
        inflightChunksRef.current.delete(index);
      }
    },
    [activeBookId, bookDetail, contentLength]
  );

  useEffect(() => {
    if (!bookDetail || hasInitializedRef.current) {
      return;
    }

    const totalLength = bookDetail.contentLength;
    const fallbackPosition = Math.round(savedProgress * totalLength);
    const initialPosition =
      typeof savedPosition === "number" && Number.isFinite(savedPosition)
        ? savedPosition
        : fallbackPosition;
    const clampedPosition = Math.min(Math.max(initialPosition, 0), Math.max(totalLength - 1, 0));

    setAnchorOffset(clampedPosition);
    setCurrentChunkIndex(totalLength > 0 ? Math.floor(clampedPosition / CHUNK_SIZE) : 0);
    restorePendingRef.current = true;
    hasInitializedRef.current = true;
  }, [bookDetail, savedPosition, savedProgress]);

  useEffect(() => {
    if (!bookDetail || totalChunks === 0) {
      return;
    }

    for (let index = windowStartIndex; index <= windowEndIndex; index += 1) {
      void loadChunk(index);
    }

    const keep = new Set<number>();
    for (let index = windowStartIndex; index <= windowEndIndex; index += 1) {
      keep.add(index);
    }

    setChunksByIndex((prev) => {
      let changed = false;
      const next: typeof prev = {};
      for (const [key, chunk] of Object.entries(prev)) {
        const index = Number.parseInt(key, 10);
        if (keep.has(index)) {
          next[index] = chunk;
        } else {
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [bookDetail, loadChunk, totalChunks, windowStartIndex, windowEndIndex]);

  useEffect(() => {
    if (!bookDetail || totalChunks === 0) {
      return;
    }

    const nextIndex = Math.min(
      Math.max(Math.floor(anchorOffset / CHUNK_SIZE), 0),
      totalChunks - 1
    );
    if (nextIndex !== currentChunkIndex) {
      setCurrentChunkIndex(nextIndex);
    }
  }, [anchorOffset, bookDetail, currentChunkIndex, totalChunks]);

  const syncScrollPosition = useCallback((): void => {
    syncScrollPositionImpl({
      textContainerRef,
      anchorOffset,
      tokens: windowTokens
    });
  }, [anchorOffset, windowTokens]);

  useLayoutEffect(() => {
    if (!restorePendingRef.current) {
      return;
    }
    if (windowTokens.length === 0) {
      return;
    }
    syncScrollPosition();
    restorePendingRef.current = false;
  }, [syncScrollPosition, windowTokens.length]);

  const closePopup = useCallback((): void => {
    requestIdRef.current += 1;
    setSelectedTokenIndex(null);
    setPopupState({
      isOpen: false,
      statusText: "",
      word: "",
      response: null,
      isTranslationPending: false
    });
  }, []);

  useEffect(() => {
    popupOpenRef.current = popupState.isOpen;
    selectedTokenIndexRef.current = selectedTokenIndex;
  }, [popupState.isOpen, selectedTokenIndex]);

  useEffect(() => {
    if (!popupState.isOpen) {
      return;
    }
    setShowEnglishTranslation(false);
    setShowRussianMeanings(false);
  }, [popupState.isOpen, popupState.word]);

  useEffect(() => {
    if (!popupOpenRef.current && selectedTokenIndexRef.current === null) {
      return;
    }
    closePopup();
  }, [closePopup, windowStartIndex, windowEndIndex]);

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
      contentLength,
      onAnchorChange: setAnchorOffset,
      scrollRafRef,
      textContainerRef,
      tokens: windowTokens
    });
  }, [activeBookId, contentLength, dispatch, windowTokens]);

  const handleTokenClick = useCallback(
    async (tokenIndex: number): Promise<void> => {
      await handleTokenClickImpl({
        tokenIndex,
        activeBookId,
        closePopup,
        dispatch,
        requestIdRef,
        savedTranslationsByWord,
        setPopupState,
        setSelectedTokenIndex,
        tokens: windowTokens,
        rawText: windowText,
        rawTextOffset: windowOffset
      });
    },
    [
      activeBookId,
      closePopup,
      dispatch,
      savedTranslationsByWord,
      windowOffset,
      windowText,
      windowTokens
    ]
  );

  const handleRefreshClick = useCallback(async (): Promise<void> => {
    await handleRefreshClickImpl({
      activeBookId,
      dispatch,
      fallbackResponse: popupState.response,
      requestIdRef,
      selectedTokenIndex,
      setPopupState,
      tokens: windowTokens,
      rawText: windowText,
      rawTextOffset: windowOffset
    });
  }, [
    activeBookId,
    dispatch,
    popupState.response,
    requestIdRef,
    selectedTokenIndex,
    setPopupState,
    windowOffset,
    windowText,
    windowTokens
  ]);

  const handleAiClick = useCallback(async (): Promise<void> => {
    await handleAiClickImpl({
      activeBookId,
      dispatch,
      fallbackResponse: popupState.response,
      requestIdRef,
      selectedTokenIndex,
      setPopupState,
      tokens: windowTokens,
      rawText: windowText,
      rawTextOffset: windowOffset
    });
  }, [
    activeBookId,
    dispatch,
    popupState.response,
    requestIdRef,
    selectedTokenIndex,
    setPopupState,
    windowOffset,
    windowText,
    windowTokens
  ]);

  const popupWordText = popupState.word || popupState.statusText;

  const popupTranslation = popupState.response?.translation ?? { english: "", russian: "" };

  const isTranslationPending = popupState.isTranslationPending;
  const splitMeanings = useCallback((value: string): string[] => {
    return value
      .split(";")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }, []);
  const englishMeanings = splitMeanings(popupTranslation.english);
  const russianMeanings = splitMeanings(popupTranslation.russian);
  const hasMultipleRussianMeanings = russianMeanings.length > 1;
  const visibleRussianMeanings = showRussianMeanings
    ? russianMeanings
    : russianMeanings.slice(0, 1);
  const visibleEnglishMeanings = showEnglishTranslation ? englishMeanings : [];
  const refreshDisabled = selectedTokenIndex === null || !popupState.word.trim() || isTranslationPending;
  const aiDisabled = refreshDisabled;
  const derivedProgress =
    typeof savedPosition === "number" && contentLength > 0
      ? savedPosition / contentLength
      : savedProgress;
  const progressPercent = Math.min(Math.max(derivedProgress, 0), 1) * 100;
  const isBookLoading =
    windowTokens.length === 0 &&
    (bookStatus === "loading" || chunkStatus === "loading" || (bookDetail && contentLength > 0));
  const isBookEmpty = windowTokens.length === 0 && !isBookLoading;

  const usageExamples =
    isTranslationPending || popupState.statusText ? [] : popupState.response?.usageExamples ?? [];
  const verbForms =
    isTranslationPending || popupState.statusText ? [] : popupState.response?.wordCard?.verbForms ?? [];
  const wordCard = isTranslationPending || popupState.statusText
    ? undefined
    : popupState.response?.wordCard;
  const sentenceTranslation = wordCard?.sentenceTranslation;
  const wordCardLine = (() => {
    if (!wordCard) {
      return "";
    }

    const parts: string[] = [];
    if (wordCard.partOfSpeech) {
      parts.push(wordCard.partOfSpeech);
    }
    if (wordCard.infinitive) {
      parts.push(`infinitivo: ${wordCard.infinitive}`);
    }
    if (wordCard.tense) {
      parts.push(`tempo: ${wordCard.tense}`);
    }
    if (wordCard.gender) {
      parts.push(`gênero: ${wordCard.gender}`);
    }
    if (wordCard.number) {
      parts.push(`número: ${wordCard.number}`);
    }
    if (wordCard.isIrregular) {
      parts.push("irregular");
    }

    return parts.join(" · ");
  })();

  const renderToken = useCallback(
    (token: textToken): JSX.Element => {
      const isTranslated =
        token.type === "word" && translatedWords.has(normalizeWord(token.text));

      return renderTokenImpl({
        token,
        onTokenClick: handleTokenClick,
        selectedTokenIndex,
        isTranslated
      });
    },
    [handleTokenClick, selectedTokenIndex, translatedWords]
  );

  return (
    <div className="page">
      <div
        className="progress-bar"
        role="progressbar"
        aria-label="Progresso de leitura"
        aria-valuenow={Math.round(progressPercent)}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <span className="progress-bar__fill" style={{ width: `${progressPercent}%` }} />
      </div>
      <div className="browser-shell">
        <div className="reader-card">
          <div className="reader-toolbar">
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
          </div>
          <div
            className="reader-text"
            role="article"
            aria-label="Texto do livro"
            ref={textContainerRef}
            onScroll={handleScroll}
            onClickCapture={handleContainerClickCapture}
          >
            {isBookLoading || isBookEmpty ? (
              <div className="reader-empty">
                {isBookLoading
                  ? "Carregando livro..."
                  : bookStatus === "error" || chunkStatus === "error"
                    ? "Nao foi possivel carregar o livro."
                    : "Nenhum conteudo para exibir."}
              </div>
            ) : (
              windowTokens.map(renderToken)
            )}
          </div>
          <div
            className={`popup${popupState.isOpen ? " is-visible" : ""}`}
            role="dialog"
            aria-live="polite"
            aria-busy={isTranslationPending}
          >
            <div className="popup-header">
              <div className="popup-word">{popupWordText}</div>
              <div className="popup-actions">
                <button
                  className={`popup-refresh${isTranslationPending ? " is-loading" : ""}`}
                  type="button"
                  onClick={handleRefreshClick}
                  disabled={refreshDisabled}
                  aria-label="Atualizar tradução"
                  title="Atualizar tradução"
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true">
                    <path
                      d="M16.5 10a6.5 6.5 0 1 1-2.1-4.8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M16.5 4.5v4h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
                <button
                  className="popup-ai"
                  type="button"
                  onClick={handleAiClick}
                  disabled={aiDisabled}
                  aria-label="Atualizar com IA"
                  title="Atualizar com IA"
                >
                  AI
                </button>
              </div>
            </div>
            <div className="popup-translation">
              {isTranslationPending ? (
                <div
                  role="status"
                  aria-live="polite"
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                    style={{ animation: "popup-spin 0.8s linear infinite" }}
                  >
                    <path
                      d="M16.5 10a6.5 6.5 0 1 1-2.1-4.8"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M16.5 4.5v4h-4"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <span>A traduzir...</span>
                </div>
              ) : popupState.statusText ? (
                <span>{popupState.statusText}</span>
              ) : (
                <>
                  {popupTranslation.russian.trim() ? (
                    <div className="popup-translation-row">
                      <span className="popup-translation-label">RU</span>
                      <ul className="popup-translation-list">
                        {visibleRussianMeanings.map((meaning, index) => (
                          <li key={`ru-${index}`}>{renderBoldText(meaning)}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {popupTranslation.english.trim() && showEnglishTranslation ? (
                    <div className="popup-translation-row popup-translation-row--english">
                      <span className="popup-translation-label">EN</span>
                      <ul className="popup-translation-list">
                        {visibleEnglishMeanings.map((meaning, index) => (
                          <li key={`en-${index}`}>{renderBoldText(meaning)}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                  {popupTranslation.english.trim() || hasMultipleRussianMeanings ? (
                    <div className="popup-translation-controls">
                      {hasMultipleRussianMeanings ? (
                        <button
                          type="button"
                          className="popup-translation-toggle"
                          onClick={() => setShowRussianMeanings((value) => !value)}
                        >
                          {showRussianMeanings ? "Ocultar RU" : "Mostrar RU"}
                        </button>
                      ) : null}
                      {popupTranslation.english.trim() ? (
                        <button
                          type="button"
                          className="popup-translation-toggle"
                          onClick={() => setShowEnglishTranslation((value) => !value)}
                        >
                          {showEnglishTranslation ? "Ocultar EN" : "Mostrar EN"}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  {!popupTranslation.english.trim() && !popupTranslation.russian.trim() ? (
                    <span>Sem tradução.</span>
                  ) : null}
                </>
              )}
            </div>
            {wordCardLine ? (
              <div className="popup-subline">{wordCardLine}</div>
            ) : null}
            {sentenceTranslation ? (
              <div className="popup-sentence">
                <div className="popup-sentence-label">Frase</div>
                <div className="popup-sentence-pt">
                  {renderBoldText(sentenceTranslation.portuguese)}
                </div>
                <div className="popup-sentence-ru">
                  {renderBoldText(sentenceTranslation.russian)}
                </div>
              </div>
            ) : null}
            {usageExamples.length > 0 ? (
              <div className="popup-usage">
                {usageExamples.map((example, index) => (
                    <div className="usage-item" key={`${example.portuguese}-${index}`}>
                      <div className="usage-label">Uso {index + 1}</div>
                      <div className="usage-pt">{renderBoldText(example.portuguese)}</div>
                      <div className="usage-translation-row">
                        <span className="usage-translation-label">RU</span>
                        <span className="usage-translation-text">
                          {renderBoldText(example.russian)}
                        </span>
                      </div>
                      <div className="usage-translation-row">
                        <span className="usage-translation-label">EN</span>
                        <span className="usage-translation-text">
                          {renderBoldText(example.english)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            {verbForms.length > 0 ? (
              <div className="popup-forms">
                <div className="forms-title">Formas verbais</div>
                <div className="forms-table">
                  <div className="forms-row forms-head">
                    <div className="forms-cell tempo">Tempo</div>
                    <div className="forms-cell">Forma</div>
                  </div>
                  {verbForms.map((row, index) => (
                    <div className="forms-row" key={`${row.Tense}-${index}`}>
                      <div className="forms-cell tempo">{row.Tense}</div>
                      <div className="forms-cell">{row.Forms}</div>
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
