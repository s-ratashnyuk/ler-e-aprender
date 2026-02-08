import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { appDispatch } from "../../../../types/appDispatch";
import type { popupState } from "../../../../types/popupState";
import type { textToken } from "../../../../types/textToken";
import type { translationEntry } from "../../../../types/translationEntry";
import type { translationRequest } from "../../../../types/translationRequest";
import type { translationResponse } from "../../../../types/translationResponse";
import { readerSlice } from "../../../../store/readerSlice";
import { translateWord } from "../../../../api/translateWord";
import { findNearestWordToken } from "../../../selection/findNearestWordToken";
import { getSentenceContextAroundToken } from "../../../selection/getSentenceContextAroundToken";
import { buildTranslationEntryId } from "../utils/buildTranslationEntryId";

type HandleAiClickParams = {
  activeBookId: string;
  dispatch: appDispatch;
  fallbackResponse: translationResponse | null;
  requestIdRef: MutableRefObject<number>;
  selectedTokenIndex: number | null;
  setPopupState: Dispatch<SetStateAction<popupState>>;
  tokens: textToken[];
  rawText: string;
  rawTextOffset: number;
};

export const handleAiClick = async ({
  activeBookId,
  dispatch,
  fallbackResponse,
  requestIdRef,
  selectedTokenIndex,
  setPopupState,
  tokens,
  rawText,
  rawTextOffset
}: HandleAiClickParams): Promise<void> => {
  if (selectedTokenIndex === null) {
    return;
  }

  const selectedToken = findNearestWordToken(tokens, selectedTokenIndex);
  if (!selectedToken) {
    return;
  }

  const requestId = requestIdRef.current + 1;
  requestIdRef.current = requestId;

  const context = getSentenceContextAroundToken(rawText, tokens, selectedToken, 10, rawTextOffset);

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
    targetLanguage: "Russo",
    forceOpenAi: true
  };

  const pollPayload: translationRequest = {
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
    setPopupState({
      isOpen: true,
      statusText: message,
      word: selectedToken.text,
      response: fallbackResponse,
      isTranslationPending: false
    });
  }
};
