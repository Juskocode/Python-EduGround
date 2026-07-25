import { resolve } from "node:path";

export const REPOSITORY_ROOT = resolve(import.meta.dirname, "../..");
export const PUBLIC_ROOT = resolve(REPOSITORY_ROOT, "public");
export const CURRICULUM_ROOT = resolve(REPOSITORY_ROOT, "curriculum");
export const PRIVATE_SOLUTIONS_ROOT = resolve(CURRICULUM_ROOT, "solutions");
export const GENERATED_CURRICULUM_ROOT = resolve(CURRICULUM_ROOT, "generated");
export const TEST_ROOT = resolve(REPOSITORY_ROOT, "tests");
