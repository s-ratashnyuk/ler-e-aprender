import type { translationRequest } from "../types/translationRequest";
import type { translationResponse } from "../types/translationResponse";
import type { translationApiRequest } from "../types/translationApiRequest";
import type { translationApiResponse } from "../types/translationApiResponse";
import type { usageExample, verbFormRow } from "../types/translationResponse";

const mapRequestToApi = (payload: translationRequest): translationApiRequest => {
  return {
    Word: payload.word,
    ContextLeft: payload.contextLeft,
    ContextRight: payload.contextRight,
    ContextSentence: payload.contextSentence,
    SourceLanguage: payload.sourceLanguage,
    TargetLanguage: payload.targetLanguage
  };
};

const mapResponseFromApi = (payload: translationApiResponse): translationResponse => {
  const usageExamples: usageExample[] = payload.UsageExamples.map((example) => ({
    portuguese: example.Portuguese,
    translation: example.Translation
  }));

  const verbForms: verbFormRow[] = payload.VerbForms.map((row) => ({
    tense: row.Tense,
    forms: row.Forms
  }));

  return {
    translation: payload.Translation,
    partOfSpeech: payload.PartOfSpeech,
    tense: payload.Tense,
    infinitive: payload.Infinitive,
    isIrregular: payload.IsIrregular,
    usageExamples,
    verbForms
  };
};

export const translateWord = async (payload: translationRequest): Promise<translationResponse> => {
  const response = await fetch("/api/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(mapRequestToApi(payload))
  });

  if (!response.ok) {
    throw new Error(`Translation failed with status ${response.status}.`);
  }

  const data = (await response.json()) as translationApiResponse;
  return mapResponseFromApi(data);
};
