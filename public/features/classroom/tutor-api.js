(() => {
  "use strict";

  const DEFAULT_ENDPOINT = "/api/tutor/chat";
  const DEFAULT_TIMEOUT_MS = 100000;
  const MAX_MESSAGE_LENGTH = 1200;
  const CHAPTER_ID_PATTERN = /^py(?:0[1-9]|1[0-2])$/u;
  const CLIENT_STORAGE_KEY = "fp-playground.tutor-client.v1";
  const CLIENT_ID_PATTERN = /^[a-f0-9-]{32,80}$/iu;

  class TutorApiError extends Error {
    constructor(message, options) {
      super(message);
      this.name = "TutorApiError";
      this.code = options && options.code ? String(options.code) : "TUTOR_UNAVAILABLE";
      this.status = options && Number.isInteger(options.status) ? options.status : 0;
      this.retryAfterSeconds = options && Number.isFinite(options.retryAfterSeconds)
        ? Math.max(0, Math.round(options.retryAfterSeconds))
        : 0;
    }
  }

  function asText(value, fallback) {
    const text = typeof value === "string" ? value.trim() : "";
    return text || fallback || "";
  }

  function normalizeCitation(value) {
    if (!value || typeof value !== "object") {
      return null;
    }
    const title = asText(value.title).slice(0, 160);
    const section = asText(value.section).slice(0, 220);
    if (!title && !section) {
      return null;
    }
    return Object.freeze({
      title: title || "Chapter material",
      section: section || "Referenced section",
    });
  }

  function normalizeResponse(payload) {
    const source = payload && typeof payload === "object" ? payload : {};
    const answer = asText(source.answer);
    if (!answer) {
      throw new TutorApiError("The tutor returned an empty response.", {
        code: "TUTOR_INVALID_RESPONSE",
      });
    }
    const citations = Array.isArray(source.citations)
      ? source.citations.slice(0, 8).map(normalizeCitation).filter(Boolean)
      : [];
    return Object.freeze({
      answer: answer.slice(0, 8000),
      citations: Object.freeze(citations),
      conversationId: asText(source.conversationId).slice(0, 160),
      model: asText(source.model, "Llama 3.1").slice(0, 120),
      usage: source.usage && typeof source.usage === "object"
        ? Object.freeze({ ...source.usage })
        : null,
    });
  }

  function getTutorClientId(storage, cryptoImplementation) {
    try {
      const existing = storage && storage.getItem
        ? String(storage.getItem(CLIENT_STORAGE_KEY) || "")
        : "";
      if (CLIENT_ID_PATTERN.test(existing)) {
        return existing;
      }
      let generated = "";
      if (
        cryptoImplementation &&
        typeof cryptoImplementation.randomUUID === "function"
      ) {
        generated = cryptoImplementation.randomUUID();
      } else if (
        cryptoImplementation &&
        typeof cryptoImplementation.getRandomValues === "function"
      ) {
        const bytes = new Uint8Array(24);
        cryptoImplementation.getRandomValues(bytes);
        generated = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
      }
      if (!CLIENT_ID_PATTERN.test(generated)) {
        return "";
      }
      if (storage && storage.setItem) {
        storage.setItem(CLIENT_STORAGE_KEY, generated);
      }
      return generated;
    } catch (_error) {
      return "";
    }
  }

  function parseRetryAfter(response, payload) {
    const errorData = payload && payload.error && typeof payload.error === "object"
      ? payload.error
      : {};
    const payloadSeconds = Number(
      errorData.retryAfterSeconds === undefined
        ? payload && payload.retryAfterSeconds
        : errorData.retryAfterSeconds,
    );
    if (Number.isFinite(payloadSeconds) && payloadSeconds >= 0) {
      return payloadSeconds;
    }
    const header = response && response.headers && response.headers.get
      ? Number(response.headers.get("Retry-After"))
      : Number.NaN;
    return Number.isFinite(header) && header >= 0 ? header : 0;
  }

  function createClient(options) {
    const settings = options && typeof options === "object" ? options : {};
    const fetchImpl = settings.fetch || window.fetch.bind(window);
    const endpoint = asText(settings.endpoint, DEFAULT_ENDPOINT);
    let storage = null;
    let cryptoImplementation = null;
    try {
      storage = Object.prototype.hasOwnProperty.call(settings, "sessionStorage")
        ? settings.sessionStorage
        : window.sessionStorage;
    } catch (_error) {
      storage = null;
    }
    try {
      cryptoImplementation = Object.prototype.hasOwnProperty.call(settings, "crypto")
        ? settings.crypto
        : window.crypto;
    } catch (_error) {
      cryptoImplementation = null;
    }
    const tutorClientId = getTutorClientId(storage, cryptoImplementation);
    const timeoutMs = Number.isFinite(Number(settings.timeoutMs))
      ? Math.max(1000, Math.round(Number(settings.timeoutMs)))
      : DEFAULT_TIMEOUT_MS;

    async function ask(request) {
      const chapterId = asText(request && request.chapterId).toLowerCase();
      const message = asText(request && request.message);
      const conversationId = asText(request && request.conversationId);
      if (!CHAPTER_ID_PATTERN.test(chapterId)) {
        throw new TutorApiError("Choose a valid course chapter before asking the tutor.", {
          code: "INVALID_INPUT",
        });
      }
      if (!message || message.length > MAX_MESSAGE_LENGTH) {
        throw new TutorApiError(
          `Questions must contain between 1 and ${MAX_MESSAGE_LENGTH} characters.`,
          { code: "INVALID_INPUT" },
        );
      }

      const controller = new AbortController();
      const timer = window.setTimeout(() => controller.abort(), timeoutMs);
      let response;
      let payload = null;
      try {
        const headers = {
          Accept: "application/json",
          "Content-Type": "application/json",
        };
        if (tutorClientId) {
          headers["X-EduGround-Tutor-Client"] = tutorClientId;
        }
        response = await fetchImpl(endpoint, {
          method: "POST",
          headers,
          body: JSON.stringify({
            chapterId,
            message,
            ...(conversationId ? { conversationId } : {}),
          }),
          credentials: "same-origin",
          signal: controller.signal,
        });
        try {
          payload = await response.json();
        } catch (_error) {
          payload = null;
        }
      } catch (error) {
        if (error && error.name === "AbortError") {
          throw new TutorApiError("The tutor took too long to respond.", {
            code: "TUTOR_TIMEOUT",
          });
        }
        if (error instanceof TutorApiError) {
          throw error;
        }
        throw new TutorApiError("The chapter tutor is temporarily unavailable.", {
          code: "TUTOR_UNAVAILABLE",
        });
      } finally {
        window.clearTimeout(timer);
      }

      if (!response.ok) {
        const errorData = payload && payload.error && typeof payload.error === "object"
          ? payload.error
          : {};
        const fallbackCode = response.status === 429
          ? "TUTOR_RATE_LIMITED"
          : response.status === 503
            ? "TUTOR_UNAVAILABLE"
            : "TUTOR_UNAVAILABLE";
        throw new TutorApiError(
          asText(errorData.message, `Tutor request failed with status ${response.status}.`),
          {
            code: asText(errorData.code, fallbackCode),
            status: response.status,
            retryAfterSeconds: parseRetryAfter(response, payload),
          },
        );
      }
      return normalizeResponse(payload);
    }

    return Object.freeze({ ask });
  }

  window.CHAPTER_TUTOR_API = Object.freeze({
    CHAPTER_ID_PATTERN,
    CLIENT_STORAGE_KEY,
    MAX_MESSAGE_LENGTH,
    TutorApiError,
    createClient,
    getTutorClientId,
    normalizeCitation,
    normalizeResponse,
  });
})();
