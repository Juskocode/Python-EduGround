import { createOllamaClient } from "./ollama-client.js";
import { PublicClassroomRepository } from "./public-classroom-content.js";
import {
  ChapterTutorService,
  readTutorServiceConfiguration,
} from "./tutor-service.js";

export interface ChapterTutorFactoryOptions {
  readonly environment?: NodeJS.ProcessEnv;
  readonly fetchImplementation?: typeof fetch;
}

export function createChapterTutorService(
  options: ChapterTutorFactoryOptions = {}
): ChapterTutorService {
  const environment = options.environment || process.env;
  return new ChapterTutorService({
    repository: new PublicClassroomRepository(),
    modelClient: createOllamaClient({
      environment,
      ...(options.fetchImplementation === undefined
        ? {}
        : { fetchImplementation: options.fetchImplementation }),
    }),
    configuration: readTutorServiceConfiguration(environment),
  });
}
