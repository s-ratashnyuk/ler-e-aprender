import type translationRequest from "../types/translationRequest";
import type translationResponse from "../types/translationResponse";
import type translationApiRequest from "../types/translationApiRequest";
import type translationApiResponse from "../types/translationApiResponse";

const mapRequestToApi = (payload: translationRequest): translationApiRequest => {
  return {
    Word: payload.word,
    ContextLeft: payload.contextLeft,
    ContextRight: payload.contextRight,
    SourceLanguage: payload.sourceLanguage,
    TargetLanguage: payload.targetLanguage
  };
};

const mapResponseFromApi = (payload: translationApiResponse): translationResponse => {
  return {
    translation: payload.Translation,
    partOfSpeech: payload.PartOfSpeech,
    example: payload.Example,
    verbForm: payload.VerbForm,
    isIrregular: payload.IsIrregular,
    otherForms: payload.OtherForms
  };
};

const translateWord = async (payload: translationRequest): Promise<translationResponse> => {
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

export default translateWord;
