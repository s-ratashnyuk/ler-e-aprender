export const extractFirstJsonObject = (text: string): string => {
  const startIndex = text.indexOf("{");
  const endIndex = text.lastIndexOf("}");

  if (startIndex === -1 || endIndex === -1 || endIndex <= startIndex) {
    throw new Error("No JSON object found in response.");
  }

  return text.slice(startIndex, endIndex + 1);
};
