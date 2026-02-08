import { useEffect, useMemo, useState, type JSX } from "react";
import type { popupState } from "../../types/popupState";

type TranslationPopupProps = {
  popupState: popupState;
  onRefresh: () => void;
  onAi: () => void;
  onDelete?: () => void;
  deleteDisabled?: boolean;
  deleteLabel?: string;
  refreshDisabled: boolean;
  aiDisabled: boolean;
};

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

const splitMeanings = (value: string): string[] => {
  return value
    .split(";")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
};

export const TranslationPopup = ({
  popupState,
  onRefresh,
  onAi,
  onDelete,
  deleteDisabled = false,
  deleteLabel,
  refreshDisabled,
  aiDisabled
}: TranslationPopupProps): JSX.Element => {
  const [showEnglishTranslation, setShowEnglishTranslation] = useState(false);
  const [showRussianMeanings, setShowRussianMeanings] = useState(false);

  useEffect(() => {
    if (!popupState.isOpen) {
      return;
    }
    setShowEnglishTranslation(false);
    setShowRussianMeanings(false);
  }, [popupState.isOpen, popupState.word]);

  const popupWordText = popupState.word || popupState.statusText;
  const popupTranslation = popupState.response?.translation ?? { english: "", russian: "" };
  const isTranslationPending = popupState.isTranslationPending;

  const englishMeanings = useMemo(
    () => splitMeanings(popupTranslation.english),
    [popupTranslation.english]
  );
  const russianMeanings = useMemo(
    () => splitMeanings(popupTranslation.russian),
    [popupTranslation.russian]
  );

  const hasMultipleRussianMeanings = russianMeanings.length > 1;
  const visibleRussianMeanings = showRussianMeanings
    ? russianMeanings
    : russianMeanings.slice(0, 1);
  const visibleEnglishMeanings = showEnglishTranslation ? englishMeanings : [];

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

  return (
    <div
      className={`popup${popupState.isOpen ? " is-visible" : ""}`}
      role="dialog"
      aria-live="polite"
      aria-busy={isTranslationPending}
    >
      <div className="popup-header">
        <div className="popup-word">{popupWordText}</div>
        <div className="popup-actions">
          {onDelete ? (
            <button
              className="popup-delete"
              type="button"
              onClick={onDelete}
              disabled={deleteDisabled}
              aria-label={deleteLabel ?? "Remover palavra"}
              title={deleteLabel ?? "Remover palavra"}
            >
              <svg viewBox="0 0 20 20" aria-hidden="true">
                <path
                  d="M6.2 6.2l7.6 7.6M13.8 6.2l-7.6 7.6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : null}
          <button
            className={`popup-refresh${isTranslationPending ? " is-loading" : ""}`}
            type="button"
            onClick={onRefresh}
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
            onClick={onAi}
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
      {wordCardLine ? <div className="popup-subline">{wordCardLine}</div> : null}
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
                <span className="usage-translation-text">{renderBoldText(example.russian)}</span>
              </div>
              <div className="usage-translation-row">
                <span className="usage-translation-label">EN</span>
                <span className="usage-translation-text">{renderBoldText(example.english)}</span>
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
  );
};
