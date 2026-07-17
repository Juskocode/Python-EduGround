(() => {
  "use strict";

  function createElement(tagName, className, textContent) {
    const node = document.createElement(tagName);
    if (className) {
      node.className = className;
    }
    if (textContent !== undefined && textContent !== null) {
      node.textContent = String(textContent);
    }
    return node;
  }

  function domId(value) {
    return String(value || "clinic")
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/gu, "-")
      .replace(/^-+|-+$/gu, "") || "clinic";
  }

  function renderCodeExample(clinic) {
    const codeBox = createElement("div", "tutorial-code concept-clinic__code");
    const codeHeader = createElement("div", "tutorial-code__header");
    const codeMeta = createElement("span", "tutorial-code__meta");
    const copyButton = createElement("button", "tutorial-copy-button", "Copy example");
    const pre = createElement("pre");
    pre.tabIndex = 0;
    const code = createElement("code", null, clinic.exampleCode || "# Build a small traceable example.");

    copyButton.type = "button";
    copyButton.dataset.copySnippet = "true";
    copyButton.dataset.copyRestingLabel = "Copy example";
    codeMeta.append(createElement("span", null, "Python 3"), copyButton);
    codeHeader.append(createElement("span", null, "concept-clinic.py"), codeMeta);
    pre.append(code);
    codeBox.append(codeHeader, pre);
    return codeBox;
  }

  function renderTrace(clinic, headingBaseId) {
    const block = createElement("section", "concept-clinic__trace");
    const heading = createElement("h4", null, "Worked execution trace");
    const explanation = createElement(
      "p",
      "concept-clinic__section-intro",
      "Read state as evidence: each row explains what changed, what stayed true, and why the next step is valid.",
    );
    const scroller = createElement("div", "concept-clinic__table-scroll");
    const table = createElement("table", "concept-clinic__table");
    const caption = createElement("caption", null, `Worked trace for ${clinic.title || "this concept"}`);
    const head = createElement("thead");
    const headRow = createElement("tr");
    const body = createElement("tbody");
    const headingId = `${headingBaseId}-trace`;

    heading.id = headingId;
    block.setAttribute("aria-labelledby", headingId);
    scroller.tabIndex = 0;
    scroller.setAttribute("role", "region");
    scroller.setAttribute("aria-label", `Scrollable execution trace for ${clinic.title || "concept clinic"}`);

    [
      ["Step", "col"],
      ["State after the step", "col"],
      ["Why this is valid", "col"],
    ].forEach(([label, scope]) => {
      const cell = createElement("th", null, label);
      cell.scope = scope;
      headRow.append(cell);
    });

    (Array.isArray(clinic.trace) ? clinic.trace : []).forEach((row, index) => {
      const tableRow = createElement("tr");
      const step = createElement("th", null, row?.step || `Step ${index + 1}`);
      const state = createElement("td");
      const reasoning = createElement("td", null, row?.reasoning || "");
      step.scope = "row";
      state.append(createElement("code", null, row?.state || ""));
      tableRow.append(step, state, reasoning);
      body.append(tableRow);
    });

    head.append(headRow);
    table.append(caption, head, body);
    scroller.append(table);
    block.append(heading, explanation, scroller);
    return block;
  }

  function renderMisconceptions(clinic, headingBaseId) {
    const block = createElement("section", "concept-clinic__misconceptions");
    const heading = createElement("h4", null, "Misconception clinic");
    const intro = createElement(
      "p",
      "concept-clinic__section-intro",
      "Challenge the tempting shortcut, replace it with a precise rule, then answer the probe without running code.",
    );
    const grid = createElement("div", "concept-clinic__misconception-grid");
    const headingId = `${headingBaseId}-misconceptions`;

    heading.id = headingId;
    block.setAttribute("aria-labelledby", headingId);
    (Array.isArray(clinic.misconceptions) ? clinic.misconceptions : []).forEach((item, index) => {
      const card = createElement("article", "concept-clinic__misconception");
      const cardHeading = createElement("h5", null, `Tempting belief ${String(index + 1).padStart(2, "0")}`);
      const cardHeadingId = `${headingBaseId}-misconception-${index + 1}`;
      const belief = createElement("blockquote", null, item?.belief || "");
      const correction = createElement("div", "concept-clinic__correction");
      const probe = createElement("div", "concept-clinic__probe");

      cardHeading.id = cardHeadingId;
      card.setAttribute("aria-labelledby", cardHeadingId);
      correction.append(
        createElement("strong", null, "Replace it with"),
        createElement("p", null, item?.correction || ""),
      );
      probe.append(
        createElement("strong", null, "Self-check probe"),
        createElement("p", null, item?.probe || ""),
      );
      card.append(cardHeading, belief, correction, probe);
      grid.append(card);
    });

    block.append(heading, intro, grid);
    return block;
  }

  function renderTransferPrompts(clinic, headingBaseId) {
    const block = createElement("section", "concept-clinic__transfer");
    const heading = createElement("h4", null, "Transfer the model");
    const intro = createElement(
      "p",
      "concept-clinic__section-intro",
      "These prompts intentionally change the domain. Explain or trace them before opening an exercise.",
    );
    const list = createElement("ol", "concept-clinic__transfer-list");
    const headingId = `${headingBaseId}-transfer`;

    heading.id = headingId;
    block.setAttribute("aria-labelledby", headingId);
    (Array.isArray(clinic.transferPrompts) ? clinic.transferPrompts : []).forEach((prompt) => {
      list.append(createElement("li", null, prompt));
    });
    block.append(heading, intro, list);
    return block;
  }

  function render(chapter, clinic, options) {
    const material = clinic && typeof clinic === "object" ? clinic : {};
    const settings = options && typeof options === "object" ? options : {};
    const chapterLabel = chapter?.number ? `Chapter ${String(chapter.number).padStart(2, "0")}` : "Chapter";
    const headingBaseId = `concept-clinic-${domId(material.id || chapter?.id)}`;
    const section = createElement("section", "concept-clinic");
    const header = createElement("header", "concept-clinic__header");
    const headerCopy = createElement("div");
    const headerActions = createElement("div", "concept-clinic__header-actions");
    const heading = createElement("h3", null, material.title || "Concept clinic");

    heading.id = headingBaseId;
    section.id = `${headingBaseId}-section`;
    section.dataset.conceptClinic = String(material.id || chapter?.id || "");
    section.setAttribute("aria-labelledby", headingBaseId);
    headerCopy.append(
      createElement("span", "eyebrow", `${chapterLabel} · Concept clinic`),
      heading,
      createElement(
        "p",
        "concept-clinic__description",
        material.description || "Trace a fresh example, correct a misconception, and transfer the model.",
      ),
    );
    headerActions.append(createElement("span", "concept-clinic__badge", "Trace · challenge · transfer"));
    if (settings.action && typeof settings.action.nodeType === "number") {
      headerActions.append(settings.action);
    }
    header.append(headerCopy, headerActions);

    section.append(
      header,
      renderCodeExample(material),
      renderTrace(material, headingBaseId),
      renderMisconceptions(material, headingBaseId),
      renderTransferPrompts(material, headingBaseId),
    );
    return section;
  }

  window.CONCEPT_CLINIC = Object.freeze({ render });
})();
