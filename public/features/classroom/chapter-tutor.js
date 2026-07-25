(() => {
  "use strict";

  const MAX_TRANSCRIPT_MESSAGES = 18;
  const ERROR_MESSAGES = Object.freeze({
    CHAPTER_NOT_FOUND: "This chapter is not available to the tutor yet.",
    TUTOR_DISABLED: "The chapter tutor is not enabled in this environment.",
    TUTOR_TIMEOUT: "The tutor took too long to respond. Your question is still in the box—please try again.",
    TUTOR_UNAVAILABLE: "The chapter tutor is temporarily unavailable. Keep learning from the class notes and try again shortly.",
    TUTOR_INVALID_RESPONSE: "The tutor returned an incomplete response. Please try a shorter question.",
  });

  function createElement(tagName, className, text) {
    const node = document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    if (text !== undefined && text !== null) {
      node.textContent = String(text);
    }
    return node;
  }

  function getErrorMessage(error) {
    const code = error && error.code ? String(error.code) : "TUTOR_UNAVAILABLE";
    if (code === "INVALID_INPUT") {
      return error && error.message
        ? String(error.message)
        : "Write a short chapter question before sending it.";
    }
    if (code === "TUTOR_RATE_LIMITED") {
      const wait = Number(error && error.retryAfterSeconds);
      return Number.isFinite(wait) && wait > 0
        ? `The classroom request limit is active. Try again in about ${Math.round(wait)} seconds.`
        : "The classroom request limit is active. Pause for a moment, then try again.";
    }
    return ERROR_MESSAGES[code] || ERROR_MESSAGES.TUTOR_UNAVAILABLE;
  }

  function renderCitations(citations) {
    const source = Array.isArray(citations) ? citations : [];
    if (!source.length) {
      return null;
    }
    const region = createElement("section", "chapter-tutor__citations");
    const list = createElement("ul");
    region.setAttribute("aria-label", "Chapter sources used");
    region.append(createElement("strong", null, "Grounded in this chapter"));
    source.forEach((citation) => {
      const item = createElement("li");
      item.append(
        createElement("span", null, citation.title || "Chapter material"),
        createElement("small", null, citation.section || "Referenced section"),
      );
      list.append(item);
    });
    region.append(list);
    return region;
  }

  function createMessage(role, text, metadata) {
    const item = createElement(
      "article",
      `chapter-tutor__message chapter-tutor__message--${role}`,
    );
    const header = createElement("header");
    const copy = createElement("p", null, text);
    const label = role === "user" ? "You" : "Chapter tutor";
    header.append(
      createElement("strong", null, label),
      role === "assistant" && metadata && metadata.model
        ? createElement("span", null, metadata.model)
        : createElement("span", null, role === "user" ? "Question" : "Study coach"),
    );
    item.append(header, copy);
    if (role === "assistant") {
      const citations = renderCitations(metadata && metadata.citations);
      if (citations) {
        item.append(citations);
      }
    }
    return item;
  }

  function trimTranscript(transcript) {
    const messages = Array.from(
      transcript.querySelectorAll(".chapter-tutor__message"),
    );
    messages.slice(0, Math.max(0, messages.length - MAX_TRANSCRIPT_MESSAGES))
      .forEach((message) => message.remove());
  }

  function setBusy(form, busy) {
    const panel = form.closest("[data-chapter-tutor]");
    const submit = form.querySelector("button[type='submit']");
    const textarea = form.querySelector("textarea");
    form.dataset.tutorBusy = busy ? "true" : "false";
    panel.setAttribute("aria-busy", busy ? "true" : "false");
    submit.disabled = busy;
    textarea.readOnly = busy;
    panel.querySelectorAll(
      "button[data-chapter-tutor-clear], button[data-chapter-tutor-prompt]",
    ).forEach((button) => {
      button.disabled = busy;
    });
    submit.textContent = busy ? "Thinking…" : "Ask tutor";
  }

  function createController(options) {
    const settings = options && typeof options === "object" ? options : {};
    const root = settings.root || document;
    const client = settings.client;
    if (!client || typeof client.ask !== "function") {
      throw new TypeError("Chapter tutor controller requires an API client.");
    }
    let started = false;

    async function submit(form) {
      if (form.dataset.tutorBusy === "true") {
        return;
      }
      const panel = form.closest("[data-chapter-tutor]");
      const transcript = panel.querySelector("[data-chapter-tutor-transcript]");
      const textarea = form.querySelector("textarea[data-chapter-tutor-question]");
      const status = panel.querySelector("[data-chapter-tutor-status]");
      const message = String(textarea.value || "").trim();
      const chapterId = String(panel.dataset.chapterTutor || "");
      if (!message) {
        textarea.setAttribute("aria-invalid", "true");
        status.className = "chapter-tutor__status is-error";
        status.textContent = "Write a chapter question before sending it.";
        textarea.focus();
        return;
      }

      textarea.removeAttribute("aria-invalid");
      setBusy(form, true);
      status.className = "chapter-tutor__status is-loading";
      status.textContent = "Searching this chapter’s class material…";
      const pendingQuestion = createMessage("user", message);
      transcript.append(pendingQuestion);
      trimTranscript(transcript);

      try {
        const result = await client.ask({
          chapterId,
          message,
          conversationId: panel.dataset.tutorConversationId || "",
        });
        panel.dataset.tutorConversationId = result.conversationId || "";
        transcript.append(createMessage("assistant", result.answer, {
          citations: result.citations,
          model: result.model,
        }));
        trimTranscript(transcript);
        textarea.value = "";
        status.className = "chapter-tutor__status is-success";
        status.textContent = result.citations.length
          ? `Answer ready with ${result.citations.length} chapter ${result.citations.length === 1 ? "source" : "sources"}.`
          : "Answer ready. Verify important details against the class notes.";
      } catch (error) {
        pendingQuestion.remove();
        status.className = "chapter-tutor__status is-error";
        status.textContent = getErrorMessage(error);
      } finally {
        setBusy(form, false);
        textarea.focus();
      }
    }

    function clear(panel) {
      const transcript = panel.querySelector("[data-chapter-tutor-transcript]");
      const messages = transcript.querySelectorAll(".chapter-tutor__message");
      Array.from(messages).slice(1).forEach((message) => message.remove());
      panel.dataset.tutorConversationId = "";
      const status = panel.querySelector("[data-chapter-tutor-status]");
      status.className = "chapter-tutor__status";
      status.textContent = "Conversation cleared. Ready for a chapter question.";
      panel.querySelector("textarea[data-chapter-tutor-question]").focus();
    }

    function onSubmit(event) {
      const form = event.target.closest
        ? event.target.closest("form[data-chapter-tutor-form]")
        : null;
      if (!form) {
        return;
      }
      event.preventDefault();
      submit(form);
    }

    function onClick(event) {
      const prompt = event.target.closest
        ? event.target.closest("button[data-chapter-tutor-prompt]")
        : null;
      if (prompt) {
        const panel = prompt.closest("[data-chapter-tutor]");
        const textarea = panel.querySelector("textarea[data-chapter-tutor-question]");
        textarea.value = String(prompt.dataset.chapterTutorPrompt || "");
        textarea.focus();
        return;
      }
      const clearButton = event.target.closest
        ? event.target.closest("button[data-chapter-tutor-clear]")
        : null;
      if (clearButton) {
        clear(clearButton.closest("[data-chapter-tutor]"));
      }
    }

    function onKeyDown(event) {
      const textarea = event.target.closest
        ? event.target.closest("textarea[data-chapter-tutor-question]")
        : null;
      if (textarea && event.ctrlKey && event.key === "Enter") {
        event.preventDefault();
        submit(textarea.closest("form[data-chapter-tutor-form]"));
      }
    }

    function start() {
      if (started) {
        return;
      }
      root.addEventListener("submit", onSubmit);
      root.addEventListener("click", onClick);
      root.addEventListener("keydown", onKeyDown);
      started = true;
    }

    function stop() {
      if (!started) {
        return;
      }
      root.removeEventListener("submit", onSubmit);
      root.removeEventListener("click", onClick);
      root.removeEventListener("keydown", onKeyDown);
      started = false;
    }

    return Object.freeze({ start, stop, submit });
  }

  const api = window.CHAPTER_TUTOR_API;
  if (api && document && typeof document.addEventListener === "function") {
    const controller = createController({
      root: document,
      client: api.createClient(),
    });
    controller.start();
  }

  window.CHAPTER_TUTOR = Object.freeze({
    createController,
    createMessage,
    getErrorMessage,
    renderCitations,
  });
})();
