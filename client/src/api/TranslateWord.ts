import type TranslationRequest from "./TranslationRequest";
import type TranslationResponse from "./TranslationResponse";

const TranslateWord = async (Payload: TranslationRequest): Promise<TranslationResponse> => {
  const Response = await fetch("/api/translate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(Payload)
  });

  if (!Response.ok) {
    throw new Error(`Translation failed with status ${Response.status}.`);
  }

  const Data = (await Response.json()) as TranslationResponse;
  return Data;
};

export default TranslateWord;
