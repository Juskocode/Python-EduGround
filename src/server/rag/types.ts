export const CHAPTER_IDS = [
  "py01",
  "py02",
  "py03",
  "py04",
  "py05",
  "py06",
  "py07",
  "py08",
  "py09",
  "py10",
  "py11",
  "py12",
  "py13",
] as const;

export type ChapterId = (typeof CHAPTER_IDS)[number];

const CHAPTER_ID_SET = new Set<string>(CHAPTER_IDS);

export function isChapterId(value: unknown): value is ChapterId {
  return typeof value === "string" && CHAPTER_ID_SET.has(value);
}

export interface ChapterKnowledgeChunk {
  readonly id: string;
  readonly chapterId: ChapterId;
  readonly title: string;
  readonly section: string;
  readonly text: string;
  readonly source: "class-materials" | "learning-content";
}

export interface RetrievedKnowledge {
  readonly chunk: ChapterKnowledgeChunk;
  readonly score: number;
}

export interface TutorCitation {
  readonly title: string;
  readonly section: string;
}

export interface TutorChatRequest {
  readonly chapterId: string;
  readonly message: string;
  readonly conversationId?: string;
}

export interface TutorUsage {
  readonly cached: boolean;
  readonly promptTokens?: number;
  readonly completionTokens?: number;
  readonly totalDurationMs?: number;
}

export interface TutorChatResponse {
  readonly answer: string;
  readonly citations: readonly TutorCitation[];
  readonly conversationId: string;
  readonly model: string;
  readonly usage?: TutorUsage;
}

export interface TutorModelMessage {
  readonly role: "system" | "user";
  readonly content: string;
}

export interface TutorModelResult {
  readonly answer: string;
  readonly model: string;
  readonly usage?: Omit<TutorUsage, "cached">;
}

export interface TutorModelClient {
  readonly model: string;
  chat(
    messages: readonly TutorModelMessage[],
    options?: { readonly signal?: AbortSignal }
  ): Promise<TutorModelResult>;
}

export class TutorError extends Error {
  readonly status: number;
  readonly code: string;
  readonly retryAfterSeconds: number | undefined;

  constructor(
    status: number,
    code: string,
    message: string,
    options: { readonly retryAfterSeconds?: number; readonly cause?: unknown } = {}
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "TutorError";
    this.status = status;
    this.code = code;
    this.retryAfterSeconds = options.retryAfterSeconds;
  }
}
