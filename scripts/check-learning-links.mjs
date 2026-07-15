#!/usr/bin/env node

import path from "node:path";
import { pathToFileURL } from "node:url";

const repoRoot = path.resolve(import.meta.dirname, "..");
globalThis.window = {};
await import(pathToFileURL(path.join(repoRoot, "learning-content.js")));
await import(pathToFileURL(path.join(repoRoot, "assessment-data.js")));

const chapterResources = Object.entries(window.LEARNING_CONTENT.chapters).flatMap(([chapterId, chapter]) =>
  (chapter.documentation || []).map((resource) => ({ chapterId, ...resource })),
);
const assessmentResources = (window.ASSESSMENT_DATA?.blocks || []).flatMap((block) =>
  (block.references || []).map((resource) => ({ chapterId: `assessment/${block.id}`, ...resource })),
);
const resources = [...chapterResources, ...assessmentResources];
const pageCache = new Map();
const errors = [];

async function readPage(url) {
  const pageUrl = new URL(url);
  pageUrl.hash = "";
  if (!pageCache.has(pageUrl.href)) {
    pageCache.set(pageUrl.href, (async () => {
      const response = await fetch(pageUrl, {
        headers: { "user-agent": "Python-EduGround-link-checker/1.0" },
        redirect: "follow",
      });
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response.text();
    })());
  }
  return pageCache.get(pageUrl.href);
}

await Promise.all(resources.map(async (resource) => {
  try {
    const url = new URL(resource.url);
    const html = await readPage(url);
    const fragment = decodeURIComponent(url.hash.slice(1));
    if (fragment && !html.includes(`id="${fragment}"`) && !html.includes(`id='${fragment}'`)) {
      errors.push(`${resource.chapterId}: missing #${fragment} on ${url.origin}${url.pathname}`);
    }
  } catch (error) {
    errors.push(`${resource.chapterId}: ${resource.url} (${error.message})`);
  }
}));

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Checked ${resources.length} references across ${pageCache.size} official Python documentation pages.`);
}
