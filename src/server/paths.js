import { resolve } from "node:path";

export const REPOSITORY_ROOT = resolve(import.meta.dirname, "../..");
export const PUBLIC_ROOT = resolve(REPOSITORY_ROOT, "public");
export const PRIVATE_SOLUTIONS_ROOT = resolve(
  REPOSITORY_ROOT,
  "curriculum",
  "solutions"
);
export const MIGRATIONS_ROOT = resolve(REPOSITORY_ROOT, "database", "migrations");
export const DEFAULT_SUBMISSIONS_ROOT = resolve(REPOSITORY_ROOT, "submissions");
