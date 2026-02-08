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
  requestIdRef: MutableRefObject<number>;
  savedTranslationsByWord: Record<string, translationEntry[]>;
  setPopupState: Dispatch<SetStateAction<popupState>>;
  setSelectedTokenIndex: Dispatch<SetStateAction<number | null>>;
  tokenIndex: number;
  tokens: textToken[];
  rawText: string;
  rawTextOffset: number;
};

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

export const handleTokenClick = async ({
  activeBookId,
  closePopup,
  dispatch,
  requestIdRef,
  savedTranslationsByWord,
  setPopupState,
  setSelectedTokenIndex,
  tokenIndex,
  tokens,
  rawText,
  rawTextOffset
}: HandleTokenClickParams): Promise<void> => {
  const selectedToken = findNearestWordToken(tokens, tokenIndex);
  if (!selectedToken) {
    closePopup();
    return;
  }

  setSelectedTokenIndex(selectedToken.index);

  const requestId = requestIdRef.current + 1;
  requestIdRef.current = requestId;

  const normalizedWord = selectedToken.text.trim().toLocaleLowerCase();
  dispatch(readerSlice.actions.incrementWordCheck({
    bookId: activeBookId,
    word: normalizedWord
  }));
  dispatch(readerSlice.actions.showWordFromUnknowns({
    bookId: activeBookId,
    word: normalizedWord
  }));
  const context = getSentenceContextAroundToken(rawText, tokens, selectedToken, 10, rawTextOffset);
  const savedTranslations = savedTranslationsByWord[normalizedWord] ?? [];
  const matchingEntry =
    savedTranslations.find(
      (entry) =>
        entry.tokenStart === selectedToken.startIndex && entry.tokenEnd === selectedToken.endIndex
    ) ??
    savedTranslations.find(
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
    bookId: activeBookId,
    tokenStart: selectedToken.startIndex,
    tokenEnd: selectedToken.endIndex,
    word: selectedToken.text,
    contextLeft: context.contextLeft,
    contextRight: context.contextRight,
    contextSentence: context.sentence,
    sourceLanguage: "Portuguese (Portugal)",
    targetLanguage: "Russo"
  };

  const pollUntilReady = async (): Promise<translationResponse | null> => {
    const delays = [600, 900, 1200, 1500, 1800, 2200];
    for (const delayMs of delays) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      const next = await translateWord(payload);
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
      word: selectedToken.text,
      response: translation,
      isTranslationPending: translation.isPending
    });

    const finalizeTranslation = (resolved: translationResponse): void => {
      setPopupState({
        isOpen: true,
        statusText: "",
        word: selectedToken.text,
        response: resolved,
        isTranslationPending: false
      });

      const entry: translationEntry = {
        id: buildTranslationEntryId(selectedToken.text, context.contextLeft, context.contextRight),
        word: selectedToken.text,
        tokenStart: selectedToken.startIndex,
        tokenEnd: selectedToken.endIndex,
        contextLeft: context.contextLeft,
        contextRight: context.contextRight,
        contextSentence: context.sentence,
        translation: resolved.translation,
        usageExamples: resolved.usageExamples,
        wordCard: resolved.wordCard,
        timestamp: Date.now()
      };

      dispatch(readerSlice.actions.addTranslation({
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
    setPopupState({
      isOpen: true,
      statusText: message,
      word: selectedToken.text,
      response: fallbackResponse,
      isTranslationPending: false
    });
  }
};
