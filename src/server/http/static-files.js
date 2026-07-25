import { createReadStream } from "node:fs";
import { realpath, stat } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
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
  return !segments.some((segment) => segment.startsWith("."));
}

export async function resolveRequestedFile(publicRoot, realPublicRoot, requestUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  } catch {
    return { error: 400, message: "Bad request: the URL is malformed." };
  }

  if (pathname.includes("\0")) return { error: 400, message: "Bad request." };
  if (!isPublicPath(pathname)) return { error: 404, message: "Not found." };

  const publicPath = pathname === "/" ? "/index.html" : pathname;
  const candidatePath = resolve(publicRoot, `.${publicPath}`);
  if (!isInsideRoot(publicRoot, candidatePath)) {
    return { error: 403, message: "Forbidden." };
  }

  try {
    const fileStats = await stat(candidatePath);
    if (!fileStats.isFile()) return { error: 404, message: "Not found." };
    const realFilePath = await realpath(candidatePath);
    if (!isInsideRoot(realPublicRoot, realFilePath)) {
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
