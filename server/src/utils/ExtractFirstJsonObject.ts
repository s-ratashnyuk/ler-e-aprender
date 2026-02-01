const ExtractFirstJsonObject = (Text: string): string => {
  const StartIndex = Text.indexOf("{");
  const EndIndex = Text.lastIndexOf("}");

  if (StartIndex === -1 || EndIndex === -1 || EndIndex <= StartIndex) {
    throw new Error("No JSON object found in response.");
  }

  return Text.slice(StartIndex, EndIndex + 1);
};

export default ExtractFirstJsonObject;
