export const buildTranslationEntryId = (word: string, contextLeft: string, contextRight: string): string => {
  const normalized = `${word.trim().toLocaleLowerCase()}|${contextLeft.trim().toLocaleLowerCase()}|${contextRight
    .trim()
    .toLocaleLowerCase()}`;
  let hash = 2166136261;
  for (let index = 0; index < normalized.length; index += 1) {
    hash ^= normalized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return `tr-${(hash >>> 0).toString(36)}`;
};
