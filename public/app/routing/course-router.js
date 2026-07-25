(function (global) {
  "use strict";

  if (!global) {
    return;
  }

  function has(registry, identifier) {
    return Boolean(
      registry &&
      typeof registry.has === "function" &&
      registry.has(identifier)
    );
  }

  function get(registry, identifier) {
    return registry && typeof registry.get === "function"
      ? registry.get(identifier)
      : undefined;
  }

  function parseRoute(hash, registries) {
    var source = registries && typeof registries === "object"
      ? registries
      : {};
    var chapterById = source.chapterById;
    var exerciseById = source.exerciseById;
    var chapterForExercise = source.chapterForExercise;
    var assessmentById = source.assessmentById;
    var rawHash = String(hash || "").replace(/^#/, "");
    var decoded;

    try {
      decoded = decodeURIComponent(rawHash);
    } catch (error) {
      decoded = rawHash;
    }

    decoded = decoded.replace(/^\/+|\/+$/g, "");
    if (!decoded || decoded === "welcome") {
      return { name: "landing" };
    }
    if (decoded === "home") {
      return { name: "home" };
    }

    if (has(chapterById, decoded)) {
      return { redirect: "#chapter/" + encodeURIComponent(decoded) };
    }

    var parts = decoded.split("/");
    if (parts[0] === "chapter" && has(chapterById, parts[1])) {
      var chapter = get(chapterById, parts[1]);
      if (!parts[2]) {
        return { name: "chapter", chapter: chapter };
      }
      if (parts[2] === "exercises") {
        return { name: "exercises", chapter: chapter };
      }
      if (
        parts[2] === "tutorials" ||
        parts[2] === "tutorial" ||
        parts[2] === "runbook"
      ) {
        return { name: "tutorial", chapter: chapter };
      }
    }

    if (parts[0] === "exercise" && has(exerciseById, parts[1])) {
      return {
        name: "exercise",
        exercise: get(exerciseById, parts[1]),
        chapter: get(chapterForExercise, parts[1])
      };
    }

    if (decoded === "profile/badges") {
      return { name: "badges" };
    }

    if (decoded === "assessments") {
      return { name: "assessments" };
    }

    if (
      parts[0] === "stage" &&
      has(assessmentById, parts[1]) &&
      parts[2] === "recap"
    ) {
      return {
        name: "stage-recap",
        block: get(assessmentById, parts[1])
      };
    }

    if (parts[0] === "assessment" && has(assessmentById, parts[1])) {
      var block = get(assessmentById, parts[1]);
      if (!parts[2]) {
        return { name: "assessment-block", block: block };
      }
      if (parts[2] === "theory" || parts[2] === "practical") {
        return {
          name: "assessment-mode",
          block: block,
          mode: parts[2]
        };
      }
    }

    return { redirect: "#home" };
  }

  function getRouteAnnouncement(route) {
    var current = route && typeof route === "object" ? route : {};
    if (current.name === "landing") {
      return "Opened the Python EduGround welcome page.";
    }
    if (current.name === "chapter") {
      return "Opened " + current.chapter.title + ".";
    }
    if (current.name === "exercises") {
      return "Opened the " + current.chapter.title + " exercise list.";
    }
    if (current.name === "tutorial") {
      return "Opened the " + current.chapter.title + " class materials.";
    }
    if (current.name === "exercise") {
      return "Opened " + current.exercise.title + ".";
    }
    if (current.name === "badges") {
      return "Opened all badges.";
    }
    if (current.name === "assessments") {
      return "Opened the timed assessment rooms.";
    }
    if (current.name === "assessment-block") {
      return "Opened " + current.block.title + ".";
    }
    if (current.name === "assessment-mode") {
      return "Opened the " + current.mode + " room for " + current.block.title + ".";
    }
    if (current.name === "stage-recap") {
      return "Opened the stage recap for " + current.block.title + ".";
    }
    return "Opened the chapter dashboard.";
  }

  global.COURSE_ROUTER = Object.freeze({
    getRouteAnnouncement: getRouteAnnouncement,
    parseRoute: parseRoute
  });
})(typeof window !== "undefined" ? window : null);
