import OpenAI from "openai";
import type TranslationRequest from "../contracts/TranslationRequest";
import type TranslationResponse from "../contracts/TranslationResponse";
import BuildSystemInstructions from "./BuildSystemInstructions";
import BuildUserPrompt from "./BuildUserPrompt";
import ParseTranslationResponse from "./ParseTranslationResponse";

const CreateTranslation = async (
  OpenAiClient: OpenAI,
  Request: TranslationRequest
): Promise<TranslationResponse> => {
  const Response = await OpenAiClient.responses.create({
    model: "gpt-4.1-mini",
    instructions: BuildSystemInstructions(),
    input: BuildUserPrompt(Request),
    temperature: 0.2,
    max_output_tokens: 220,
    text: {
      format: {
        type: "json_object"
      }
    }
  });

  const OutputText = Response.output_text ?? "";
  if (!OutputText) {
    throw new Error("Empty response from OpenAI.");
  }

  return ParseTranslationResponse(OutputText);
};

export default CreateTranslation;
