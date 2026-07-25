import type {
  ChapterKnowledgeChunk,
  RetrievedKnowledge,
} from "./types.js";

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "can",
  "do",
  "for",
  "from",
  "how",
  "i",
  "in",
  "is",
  "it",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "what",
  "when",
  "why",
  "with",
  "you",
]);

function tokens(value: string): string[] {
  return (
    value
      .normalize("NFKD")
      .toLowerCase()
      .match(/[a-z0-9_]{2,}/gu) || []
  ).filter((token) => !STOP_WORDS.has(token));
}

function termFrequency(values: readonly string[]): Map<string, number> {
  const frequencies = new Map<string, number>();
  for (const value of values) {
    frequencies.set(value, (frequencies.get(value) || 0) + 1);
  }
  return frequencies;
}

function scoreChunk(
  chunk: ChapterKnowledgeChunk,
  queryTokens: readonly string[],
  queryPhrase: string
): number {
  const bodyTokens = tokens(`${chunk.title} ${chunk.section} ${chunk.text}`);
  const bodyFrequency = termFrequency(bodyTokens);
  let score = 0;
  for (const queryToken of queryTokens) {
    const frequency = bodyFrequency.get(queryToken) || 0;
    if (frequency > 0) score += 2 + Math.min(frequency, 4);
    if (tokens(chunk.section).includes(queryToken)) score += 3;
    if (tokens(chunk.title).includes(queryToken)) score += 2;
  }
  if (
    queryPhrase.length >= 5 &&
    chunk.text.toLowerCase().includes(queryPhrase.toLowerCase())
  ) {
    score += 8;
  }
  return score / Math.max(1, Math.log2(bodyTokens.length + 2));
}

export interface RetrievalOptions {
  readonly maximumChunks?: number;
  readonly maximumContextCharacters?: number;
}

export function retrieveChapterKnowledge(
  chunks: readonly ChapterKnowledgeChunk[],
  query: string,
  options: RetrievalOptions = {}
): readonly RetrievedKnowledge[] {
  const maximumChunks = Math.max(1, Math.min(options.maximumChunks ?? 4, 8));
  const maximumContextCharacters = Math.max(
    1_000,
    Math.min(options.maximumContextCharacters ?? 8_000, 20_000)
  );
  const queryTokens = [...new Set(tokens(query))];
  const ranked = chunks
    .map((chunk, originalIndex) => ({
      chunk,
      originalIndex,
      score: scoreChunk(chunk, queryTokens, query.trim()),
    }))
    .sort((left, right) => right.score - left.score || left.originalIndex - right.originalIndex);

  const positive = ranked.filter((item) => item.score > 0);
  const candidates = positive.length > 0 ? positive : ranked;
  const selected: RetrievedKnowledge[] = [];
  let usedCharacters = 0;

  for (const candidate of candidates) {
    if (selected.length >= maximumChunks) break;
    if (
      selected.length > 0 &&
      usedCharacters + candidate.chunk.text.length > maximumContextCharacters
    ) {
      continue;
    }
    selected.push({ chunk: candidate.chunk, score: candidate.score });
    usedCharacters += candidate.chunk.text.length;
  }

  return selected;
}
