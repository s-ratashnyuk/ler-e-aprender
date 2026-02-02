import type { Dispatch, MutableRefObject, SetStateAction } from "react";
import type { appDispatch } from "../../../../types/appDispatch";
import type { popupState } from "../../../../types/popupState";
import type { textToken } from "../../../../types/textToken";
import type { translationEntry } from "../../../../types/translationEntry";
import type { translationRequest } from "../../../../types/translationRequest";
import { readerSlice } from "../../../../store/readerSlice";
import { translateWord } from "../../../../api/translateWord";
import { findNearestWordToken } from "../../../selection/findNearestWordToken";
import { getSentenceContextAroundToken } from "../../../selection/getSentenceContextAroundToken";
import { buildTranslationEntryId } from "../utils/buildTranslationEntryId";

type HandleRefreshClickParams = {
  activeBookId: string;
  dispatch: appDispatch;
  requestIdRef: MutableRefObject<number>;
  selectedTokenIndex: number | null;
  setPopupState: Dispatch<SetStateAction<popupState>>;
  tokens: textToken[];
  rawText: string;
};

export const handleRefreshClick = async ({
  activeBookId,
  dispatch,
  requestIdRef,
  selectedTokenIndex,
  setPopupState,
  tokens,
  rawText
}: HandleRefreshClickParams): Promise<void> => {
  if (selectedTokenIndex === null) {
    return;
  }

  const selectedToken = findNearestWordToken(tokens, selectedTokenIndex);
  if (!selectedToken) {
    return;
  }

  const requestId = requestIdRef.current + 1;
  requestIdRef.current = requestId;

  const context = getSentenceContextAroundToken(rawText, tokens, selectedToken, 10);

  setPopupState({
    isOpen: true,
    statusText: "A traduzir...",
    word: selectedToken.text,
    response: null
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
      response: translation
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

    dispatch(readerSlice.actions.upsertTranslation({
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
      response: null
    });
  }
};
