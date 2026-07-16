import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";

export const PUBLIC_ROOT_FILES = new Set([
  "audio-feedback.js",
  "class-materials.js",
  "class-page.css",
  "class-page.js",
  "course-app.js",
  "course-ui.css",
  "dashboard-model.js",
  "dashboard-ui.css",
  "dashboard-view.js",
  "exercise-data.js",
  "favicon.svg",
  "index.html",
  "concept-clinic.js",
  "learning-clinic.css",
  "learning-clinics.js",
  "learning-content.js",
  "learning-toolbox.js",
  "rounding-lab.css",
  "rounding-lab.js",
  "rounding-model.js",
  "assessment-data.js",
  "assessment-engine.js",
  "assessment-room.js",
  "assessment-ui.css",
  "python-runner-worker.mjs",
  "starter-code.js",
]);

const PUBLIC_DIRECTORIES = new Set(["assets", "test-data"]);
const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".mjs", "text/javascript; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".txt", "text/plain; charset=utf-8"],
  [".wasm", "application/wasm"],
  [".webp", "image/webp"],
]);

function isInsideRoot(root, candidate) {
  const pathFromRoot = relative(root, candidate);
  return pathFromRoot === "" || (!pathFromRoot.startsWith(`..${sep}`) && pathFromRoot !== "..");
}

function isPublicPath(pathname) {
  if (pathname === "/") return true;
  const segments = pathname.split("/").filter(Boolean);
  if (segments.some((segment) => segment.startsWith("."))) return false;
  if (segments.length === 1) return PUBLIC_ROOT_FILES.has(segments[0]);
  return (
    PUBLIC_DIRECTORIES.has(segments[0]) ||
    (segments[0] === "docs" && segments[1] === "screenshots" && segments.length >= 3)
  );
}

export async function resolveRequestedFile(repositoryRoot, realRepositoryRoot, requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  } catch {
    return { error: 400, message: "Bad request: the URL is malformed." };
  }

  if (pathname.includes("\0")) return { error: 400, message: "Bad request." };
  if (!isPublicPath(pathname)) return { error: 404, message: "Not found." };

  const publicPath = pathname === "/" ? "/index.html" : pathname;
  const candidatePath = resolve(repositoryRoot, `.${publicPath}`);
  if (!isInsideRoot(repositoryRoot, candidatePath)) {
    return { error: 403, message: "Forbidden." };
  }

  try {
    const fileStats = await stat(candidatePath);
    if (!fileStats.isFile()) return { error: 404, message: "Not found." };
    const realFilePath = await realpath(candidatePath);
    if (!isInsideRoot(realRepositoryRoot, realFilePath)) {
      return { error: 403, message: "Forbidden." };
    }
    return { filePath: realFilePath, fileStats };
  } catch (error) {
    if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
      return { error: 404, message: "Not found." };
    }
    throw error;
  }
}

export function streamStaticFile(request, response, result, sendText) {
  const contentType = MIME_TYPES.get(extname(result.filePath).toLowerCase()) || "application/octet-stream";
  response.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": result.fileStats.size,
  });
  if (request.method === "HEAD") {
    response.end();
    return;
  }

  const fileStream = createReadStream(result.filePath);
  fileStream.on("error", (error) => {
    if (!response.headersSent) sendText(response, 500, "Internal server error.");
    else response.destroy(error);
  });
  fileStream.pipe(response);
}
