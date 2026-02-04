import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { appDispatch } from "../../../../types/appDispatch";
import type { popupState } from "../../../../types/popupState";
import type { textToken } from "../../../../types/textToken";
import type { translationEntry } from "../../../../types/translationEntry";
import type { translationRequest } from "../../../../types/translationRequest";
import type { translationResponse } from "../../../../types/translationResponse";
import { readerSlice } from "../../../../store/readerSlice";
import { findNearestWordToken } from "../../../selection/findNearestWordToken";
import { getSentenceContextAroundToken } from "../../../selection/getSentenceContextAroundToken";
import { buildTranslationEntryId } from "../utils/buildTranslationEntryId";
import { translateWord } from "../../../../api/translateWord";

type HandleTokenClickParams = {
  activeBookId: string;
  closePopup: () => void;
  dispatch: appDispatch;
  popupStateIsOpen: boolean;
  requestIdRef: MutableRefObject<number>;
  savedTranslationsByWord: Record<string, translationEntry[]>;
  setPopupState: Dispatch<SetStateAction<popupState>>;
  setSelectedTokenIndex: Dispatch<SetStateAction<number | null>>;
  tokenIndex: number;
  tokens: textToken[];
  rawText: string;
};

const mapEntryToResponse = (entry: translationEntry): translationResponse => {
  return {
    translation: entry.translation,
    partOfSpeech: entry.partOfSpeech,
    tense: entry.tense,
    infinitive: entry.infinitive,
    isIrregular: entry.isIrregular,
    usageExamples: entry.usageExamples,
    verbForms: entry.verbForms
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

export const handleTokenClick = async ({
  activeBookId,
  closePopup,
  dispatch,
  popupStateIsOpen,
  requestIdRef,
  savedTranslationsByWord,
  setPopupState,
  setSelectedTokenIndex,
  tokenIndex,
  tokens,
  rawText
}: HandleTokenClickParams): Promise<void> => {
  if (popupStateIsOpen) {
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
  const context = getSentenceContextAroundToken(rawText, tokens, selectedToken, 10);
  const savedTranslations = savedTranslationsByWord[normalizedWord] ?? [];
  const matchingEntry = savedTranslations.find(
    (entry) =>
      entry.contextLeft === context.contextLeft && entry.contextRight === context.contextRight
  );

  if (matchingEntry) {
    setPopupState({
      isOpen: true,
      statusText: "",
      word: selectedToken.text,
      response: mapEntryToResponse(matchingEntry),
      isTranslationPending: false
    });
    return;
  }

  const fallbackEntry = getMostRecentEntry(savedTranslations);
  const fallbackResponse = fallbackEntry ? mapEntryToResponse(fallbackEntry) : null;

  setPopupState({
    isOpen: true,
    statusText: "",
    word: selectedToken.text,
    response: fallbackResponse,
    isTranslationPending: true
  });

  const payload: translationRequest = {
    word: selectedToken.text,
    contextLeft: context.contextLeft,
    contextRight: context.contextRight,
    contextSentence: context.sentence,
    sourceLanguage: "Portuguese (Portugal)",
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
      response: translation,
      isTranslationPending: false
    });

    const entry: translationEntry = {
      id: buildTranslationEntryId(selectedToken.text, context.contextLeft, context.contextRight),
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
    if (requestId !== requestIdRef.current) {
      return;
    }

    const message = error instanceof Error ? error.message : "Erro ao traduzir.";
    setPopupState({
      isOpen: true,
      statusText: message,
      word: selectedToken.text,
      response: fallbackResponse,
      isTranslationPending: false
    });
  }
};
