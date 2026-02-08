import type { tokenRecord, verbFormRow } from "../db/BookDatabase.js";

export type wordCard = {
  partOfSpeech: string;
  gender: string;
  number: string;
  tense: string;
  infinitive: string;
  isIrregular: boolean;
  verbForms: verbFormRow[];
  sentenceTranslation?: {
    portuguese: string;
    russian: string;
  };
};

const posLabels: Record<string, string> = {
  noun: "substantivo",
  verb: "verbo",
  adjective: "adjetivo",
  adverb: "advérbio",
  pronoun: "pronome",
  determiner: "determinante",
  adposition: "preposição",
  conjunction: "conjunção",
  interjection: "interjeição",
  numeral: "numeral",
  punctuation: ""
};

const genderLabels: Record<string, string> = {
  feminine: "feminino",
  masculine: "masculino",
  common: "comum",
  neuter: "neutro"
};

const numberLabels: Record<string, string> = {
  singular: "singular",
  plural: "plural"
};

const buildTenseLabel = (token: tokenRecord): string => {
  if (token.pos !== "verb") {
    return "";
  }

  const mood = token.mood?.toLowerCase() ?? "";
  const tense = token.tense?.toLowerCase() ?? "";

  if (mood === "infinitive") {
    return "infinitivo";
  }
  if (mood === "gerund") {
    return "gerúndio";
  }
  if (mood === "participle") {
    return "particípio";
  }
  if (mood === "pastparticiple") {
    return "part. pass.";
  }
  if (mood === "imperative") {
    return "imperativo";
  }

  const tenseLabel = (() => {
    if (tense === "present") {
      return "pres.";
    }
    if (tense === "past") {
      return "pretérito perf.";
    }
    if (tense === "imperfect") {
      return "pretérito imperf.";
    }
    if (tense === "conditional") {
      return "fut. do pret.";
    }
    if (tense === "future") {
      return "fut.";
    }
    if (tense === "plusquamperfect") {
      return "pretérito mais-que-perfeito";
    }
    return "";
  })();

  if (!tenseLabel) {
    return "";
  }

  if (mood === "indicative") {
    return `${tenseLabel} do ind.`;
  }
  if (mood === "subjunctive") {
    return `${tenseLabel} do subj.`;
  }

  return tenseLabel;
};

export const buildWordCard = (
  token: tokenRecord,
  verbForms: verbFormRow[],
  isIrregular: boolean
): wordCard => {
  const partOfSpeech = posLabels[token.pos] ?? "";
  const gender = token.gen ? genderLabels[token.gen] ?? token.gen : "";
  const number = token.num ? numberLabels[token.num] ?? token.num : "";
  const tense = buildTenseLabel(token);
  const infinitive = token.pos === "verb" ? token.lemma : "";

  return {
    partOfSpeech,
    gender,
    number,
    tense,
    infinitive,
    isIrregular,
    verbForms
  };
};
