import { lstat, readFile, realpath } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
import { createContext, Script } from "node:vm";

import { PUBLIC_ROOT } from "../paths.js";
import {
  CHAPTER_IDS,
  type ChapterId,
  type ChapterKnowledgeChunk,
} from "./types.js";

const MAX_SOURCE_BYTES = 512 * 1024;
const DEFAULT_CHUNK_CHARACTERS = 1_500;
const MIN_CHUNK_CHARACTERS = 500;
const MAX_CHUNK_CHARACTERS = 3_000;

const OMITTED_KEYS = new Set([
  "acceptedanswers",
  "answer",
  "answers",
  "answerkey",
  "answerindex",
  "expectedoutput",
  "hiddentests",
  "sourcerules",
  "solution",
  "solutions",
  "testcases",
  "tests",
]);

interface PublicClassroomSource {
  readonly filename: "class-materials.js" | "learning-content.js";
  readonly globalName: "CLASS_MATERIALS" | "LEARNING_CONTENT";
  readonly source: "class-materials" | "learning-content";
  readonly label: string;
}

const PUBLIC_CLASSROOM_SOURCES = [
  {
    filename: "class-materials.js",
    globalName: "CLASS_MATERIALS",
    source: "class-materials",
    label: "Class material",
  },
  {
    filename: "learning-content.js",
    globalName: "LEARNING_CONTENT",
    source: "learning-content",
    label: "Learning guide",
  },
] as const satisfies readonly PublicClassroomSource[];

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isWithin(root: string, candidate: string): boolean {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === "" || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== "..");
}

function humanize(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/gu, "$1 $2")
    .replace(/[-_]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .replace(/^./u, (character) => character.toUpperCase());
}

function normalizeText(value: string): string {
  return value.replace(/\r\n?/gu, "\n").replace(/[ \t]+\n/gu, "\n").trim();
}

function isOmittedKey(key: string): boolean {
  return OMITTED_KEYS.has(key.toLowerCase().replace(/[^a-z0-9]/gu, ""));
}

function collectText(value: unknown, path: readonly string[], output: string[]): void {
  if (typeof value === "string") {
    const text = normalizeText(value);
    if (text) {
      const label = path.length > 0 ? `${humanize(path.at(-1) || "")}: ` : "";
      output.push(`${label}${text}`);
    }
    return;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    const label = path.length > 0 ? `${humanize(path.at(-1) || "")}: ` : "";
    output.push(`${label}${String(value)}`);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectText(item, path, output);
    return;
  }
  if (!isRecord(value)) return;

  for (const [key, child] of Object.entries(value)) {
    if (isOmittedKey(key)) continue;
    collectText(child, [...path, key], output);
  }
}

function splitLongParagraph(paragraph: string, maximumCharacters: number): string[] {
  if (paragraph.length <= maximumCharacters) return [paragraph];
  const pieces: string[] = [];
  let remaining = paragraph;
  while (remaining.length > maximumCharacters) {
    let splitAt = remaining.lastIndexOf(" ", maximumCharacters);
    if (splitAt < Math.floor(maximumCharacters * 0.6)) splitAt = maximumCharacters;
    pieces.push(remaining.slice(0, splitAt).trim());
    remaining = remaining.slice(splitAt).trim();
  }
  if (remaining) pieces.push(remaining);
  return pieces;
}

function chunkParagraphs(paragraphs: readonly string[], maximumCharacters: number): string[] {
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs.flatMap((item) =>
    splitLongParagraph(item, maximumCharacters)
  )) {
    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maximumCharacters) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    current = paragraph;
  }
  if (current) chunks.push(current);
  return chunks;
}

async function loadBrowserGlobal(
  contentRoot: string,
  source: PublicClassroomSource
): Promise<JsonRecord> {
  const sourcePath = resolve(contentRoot, source.filename);
  if (!isWithin(contentRoot, sourcePath)) {
    throw new Error(`Classroom source escaped the public content boundary: ${source.filename}`);
  }
  const sourceStats = await lstat(sourcePath);
  if (!sourceStats.isFile() || sourceStats.isSymbolicLink()) {
    throw new Error(`Classroom source must be a regular file: ${source.filename}`);
  }
  const [realContentRoot, realSourcePath] = await Promise.all([
    realpath(contentRoot),
    realpath(sourcePath),
  ]);
  if (!isWithin(realContentRoot, realSourcePath)) {
    throw new Error(`Classroom source escaped the real public content boundary: ${source.filename}`);
  }

  const sourceText = await readFile(realSourcePath, "utf8");
  if (Buffer.byteLength(sourceText) > MAX_SOURCE_BYTES) {
    throw new Error(`Classroom source is unexpectedly large: ${source.filename}`);
  }

  const sandbox: { window: JsonRecord } = { window: {} };
  const context = createContext(sandbox, {
    codeGeneration: { strings: false, wasm: false },
    name: `classroom-content:${source.filename}`,
  });
  const script = new Script(sourceText, {
    filename: source.filename,
  });
  script.runInContext(context, { timeout: 1_000 });
  const exportedValue = sandbox.window[source.globalName];
  if (!isRecord(exportedValue)) {
    throw new Error(`${source.filename} did not export ${source.globalName}.`);
  }
  return exportedValue;
}

function chapterContent(exportedValue: JsonRecord, chapterId: ChapterId): JsonRecord | null {
  if (isRecord(exportedValue[chapterId])) return exportedValue[chapterId] as JsonRecord;
  const chapters = exportedValue.chapters;
  if (isRecord(chapters) && isRecord(chapters[chapterId])) {
    return chapters[chapterId] as JsonRecord;
  }
  return null;
}

function chapterTitle(chapter: JsonRecord, chapterId: ChapterId): string {
  return typeof chapter.title === "string" && chapter.title.trim()
    ? chapter.title.trim()
    : `Python chapter ${chapterId.slice(2)}`;
}

export interface PublicClassroomRepositoryOptions {
  readonly publicRoot?: string;
  readonly maximumChunkCharacters?: number;
}

export class PublicClassroomRepository {
  readonly sourceFilenames = PUBLIC_CLASSROOM_SOURCES.map((source) => source.filename);
  readonly #contentRoot: string;
  readonly #maximumChunkCharacters: number;
  #indexPromise: Promise<ReadonlyMap<ChapterId, readonly ChapterKnowledgeChunk[]>> | null =
    null;

  constructor(options: PublicClassroomRepositoryOptions = {}) {
    this.#contentRoot = resolve(options.publicRoot || PUBLIC_ROOT, "content");
    const requestedMaximum =
      options.maximumChunkCharacters ?? DEFAULT_CHUNK_CHARACTERS;
    if (
      !Number.isSafeInteger(requestedMaximum) ||
      requestedMaximum < MIN_CHUNK_CHARACTERS ||
      requestedMaximum > MAX_CHUNK_CHARACTERS
    ) {
      throw new Error(
        `maximumChunkCharacters must be a whole number from ${MIN_CHUNK_CHARACTERS} to ${MAX_CHUNK_CHARACTERS}.`
      );
    }
    this.#maximumChunkCharacters = requestedMaximum;
  }

  async getChapterChunks(chapterId: ChapterId): Promise<readonly ChapterKnowledgeChunk[]> {
    const index = await this.#index();
    return index.get(chapterId) || [];
  }

  async listChapterIds(): Promise<readonly ChapterId[]> {
    const index = await this.#index();
    return CHAPTER_IDS.filter((chapterId) => index.has(chapterId));
  }

  #index(): Promise<ReadonlyMap<ChapterId, readonly ChapterKnowledgeChunk[]>> {
    this.#indexPromise ||= this.#buildIndex();
    return this.#indexPromise;
  }

  async #buildIndex(): Promise<ReadonlyMap<ChapterId, readonly ChapterKnowledgeChunk[]>> {
    const loadedSources = await Promise.all(
      PUBLIC_CLASSROOM_SOURCES.map(async (source) => ({
        source,
        value: await loadBrowserGlobal(this.#contentRoot, source),
      }))
    );
    const index = new Map<ChapterId, readonly ChapterKnowledgeChunk[]>();

    for (const chapterId of CHAPTER_IDS) {
      const chunks: ChapterKnowledgeChunk[] = [];
      const titledChapter = loadedSources
        .map(({ value }) => chapterContent(value, chapterId))
        .find(
          (chapter) =>
            chapter &&
            typeof chapter.title === "string" &&
            chapter.title.trim()
        );
      const title = titledChapter
        ? chapterTitle(titledChapter, chapterId)
        : `Python chapter ${chapterId.slice(2)}`;

      for (const { source, value } of loadedSources) {
        const chapter = chapterContent(value, chapterId);
        if (!chapter) continue;

        for (const [sectionKey, sectionValue] of Object.entries(chapter)) {
          if (sectionKey === "title" || isOmittedKey(sectionKey)) continue;
          const paragraphs: string[] = [];
          collectText(sectionValue, [], paragraphs);
          const section = `${source.label} / ${humanize(sectionKey)}`;
          chunkParagraphs(paragraphs, this.#maximumChunkCharacters).forEach(
            (text, chunkIndex) => {
              chunks.push(
                Object.freeze({
                  id: `${chapterId}:${source.source}:${sectionKey}:${chunkIndex + 1}`,
                  chapterId,
                  title,
                  section,
                  text,
                  source: source.source,
                })
              );
            }
          );
        }
      }
      if (chunks.length > 0) index.set(chapterId, Object.freeze(chunks));
    }

    return index;
  }
}
