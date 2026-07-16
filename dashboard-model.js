(function () {
  "use strict";

  function asCount(value) {
    var number = Number(value);
    return Number.isFinite(number) && number > 0 ? Math.floor(number) : 0;
  }

  function asProgress(value) {
    var source = value && typeof value === "object" ? value : {};
    var total = asCount(source.total);
    var done = Math.min(asCount(source.done), total);
    return {
      done: done,
      total: total,
      percent: total ? Math.round(done / total * 100) : 0,
      stars: asCount(source.stars),
      maxStars: asCount(source.maxStars)
    };
  }

  function deriveChapterState(chapter) {
    var exercises = asProgress(chapter && chapter.exercises);
    var guide = asProgress(chapter && chapter.guide);
    var started = exercises.done > 0 || guide.done > 0;
    var exercisesComplete = exercises.total > 0 && exercises.done === exercises.total;
    var guideComplete = guide.total > 0 && guide.done === guide.total;

    if (exercisesComplete && guideComplete) {
      return { id: "mastered", label: "Mastered", tone: "success" };
    }
    if (exercisesComplete) {
      return { id: "review", label: "Review the guide", tone: "warning" };
    }
    if (started) {
      return { id: "active", label: "In progress", tone: "primary" };
    }
    return { id: "upcoming", label: "Not started", tone: "muted" };
  }

  function normalizeChapter(chapter) {
    var source = chapter && typeof chapter === "object" ? chapter : {};
    var exercises = asProgress(source.exercises);
    var guide = asProgress(source.guide);
    var exerciseItems = Array.isArray(source.exerciseItems)
      ? source.exerciseItems
        .filter(function (item) { return item && item.id; })
        .map(function (item) {
          return {
            id: String(item.id),
            title: String(item.title || "Exercise"),
            passed: Boolean(item.passed)
          };
        })
      : [];
    var normalized = {
      id: String(source.id || ""),
      number: asCount(source.number),
      title: String(source.title || "Chapter"),
      summary: String(source.summary || ""),
      topics: Array.isArray(source.topics) ? source.topics.slice(0, 2).map(String) : [],
      exercises: exercises,
      guide: guide,
      exerciseItems: exerciseItems
    };
    normalized.state = deriveChapterState(normalized);
    normalized.combined = {
      done: exercises.done + guide.done,
      total: exercises.total + guide.total
    };
    normalized.combined.percent = normalized.combined.total
      ? Math.round(normalized.combined.done / normalized.combined.total * 100)
      : 0;
    return normalized;
  }

  function deriveResume(chapters, lastExerciseId) {
    var lastId = lastExerciseId ? String(lastExerciseId) : "";
    var lastChapter = null;
    var lastExercise = null;

    chapters.some(function (chapter) {
      var match = chapter.exerciseItems.find(function (exercise) {
        return exercise.id === lastId;
      });
      if (!match) {
        return false;
      }
      lastChapter = chapter;
      lastExercise = match;
      return true;
    });

    if (lastChapter && lastExercise && !lastExercise.passed) {
      return {
        kind: "exercise",
        chapter: lastChapter,
        eyebrow: "Resume your draft",
        title: lastExercise.title,
        description: "Return directly to the editor, run the visible examples, then use the hidden suite as evidence.",
        href: "#exercise/" + encodeURIComponent(lastExercise.id),
        action: "Resume exercise"
      };
    }

    var nextChapter = chapters.find(function (chapter) {
      return chapter.state.id !== "mastered";
    });
    if (!nextChapter) {
      return {
        kind: "achievement",
        chapter: chapters[chapters.length - 1] || null,
        eyebrow: "Path complete",
        title: "Review your constellation",
        description: "Every chapter is mastered. Revisit badges, timed assessments, or any concept you want to sharpen.",
        href: "#profile/badges",
        action: "View achievements"
      };
    }

    var nextExercise = nextChapter.exerciseItems.find(function (exercise) {
      return !exercise.passed;
    });
    var shouldStudy = nextChapter.guide.done === 0 ||
      (nextChapter.guide.done < nextChapter.guide.total && nextChapter.exercises.done === 0);
    if (shouldStudy || !nextExercise) {
      return {
        kind: "guide",
        chapter: nextChapter,
        eyebrow: nextChapter.guide.done ? "Continue the guide" : "Build the model first",
        title: "Chapter " + String(nextChapter.number).padStart(2, "0") + " · " + nextChapter.title,
        description: "Learn the core ideas, trace an analogous example, and mark each section only when you can explain it.",
        href: "#chapter/" + encodeURIComponent(nextChapter.id) + "/tutorials",
        action: nextChapter.guide.done ? "Continue guide" : "Start learning"
      };
    }

    return {
      kind: "exercise",
      chapter: nextChapter,
      eyebrow: "Next useful challenge",
      title: nextExercise.title,
      description: "Apply the chapter model in the editor and turn each test result into a concrete debugging clue.",
      href: "#exercise/" + encodeURIComponent(nextExercise.id),
      action: "Open exercise"
    };
  }

  function deriveJourneyResume(chapters, stages, lastExerciseId) {
    var directResume = deriveResume(chapters, lastExerciseId);
    if (directResume.eyebrow === "Resume your draft") {
      return directResume;
    }
    if (!Array.isArray(stages) || stages.length === 0) {
      return directResume;
    }

    for (var index = 0; index < stages.length; index += 1) {
      var stage = stages[index];
      var stageChapters = Array.isArray(stage.chapters) ? stage.chapters : [];
      var unfinishedChapter = stageChapters.find(function (chapter) {
        return chapter.state.id !== "mastered";
      });
      if (unfinishedChapter) {
        return deriveResume(stageChapters, "");
      }
      if (stageChapters.length > 0 && stage.status.id !== "complete") {
        return {
          kind: "assessment",
          chapter: stageChapters[stageChapters.length - 1],
          eyebrow: stage.assessment.passedModes ? "Continue the checkpoint" : "Checkpoint ready",
          title: stage.title + " checkpoint",
          description: "You mastered every chapter in this stage. Pass both timed rooms at 60/100 or better before moving to the next stage.",
          href: "#assessment/" + encodeURIComponent(stage.assessment.id),
          action: stage.assessment.passedModes ? "Continue checkpoint" : "Open checkpoint"
        };
      }
    }

    return deriveResume(chapters, "");
  }

  function deriveStageStatus(chapters, assessment) {
    var mastered = chapters.length > 0 && chapters.every(function (chapter) {
      return chapter.state.id === "mastered";
    });
    var passedModes = asCount(assessment && assessment.passedModes);
    var totalModes = asCount(assessment && assessment.totalModes);
    var anyProgress = chapters.some(function (chapter) {
      return chapter.combined.done > 0;
    }) || passedModes > 0;

    if (mastered && totalModes > 0 && passedModes === totalModes) {
      return { id: "complete", label: "Stage complete", tone: "success" };
    }
    if (mastered) {
      return { id: "checkpoint", label: "Checkpoint ready", tone: "warning" };
    }
    if (anyProgress) {
      return { id: "active", label: "In progress", tone: "primary" };
    }
    return { id: "upcoming", label: "Upcoming", tone: "muted" };
  }

  function build(input) {
    var source = input && typeof input === "object" ? input : {};
    var chapters = Array.isArray(source.chapters)
      ? source.chapters.map(normalizeChapter).filter(function (chapter) { return chapter.id; })
      : [];
    var chapterById = new Map(chapters.map(function (chapter) {
      return [chapter.id, chapter];
    }));
    var assessmentBlocks = Array.isArray(source.assessmentBlocks) ? source.assessmentBlocks : [];
    var stages = assessmentBlocks.map(function (block, index) {
      var stageChapters = Array.isArray(block.chapters)
        ? block.chapters.map(function (chapterId) { return chapterById.get(String(chapterId)); }).filter(Boolean)
        : [];
      var assessment = {
        id: String(block.id || ""),
        title: String(block.title || "Stage assessment"),
        passedModes: asCount(block.passedModes),
        totalModes: asCount(block.totalModes) || 2
      };
      var combinedDone = stageChapters.reduce(function (total, chapter) {
        return total + chapter.combined.done;
      }, 0);
      var combinedTotal = stageChapters.reduce(function (total, chapter) {
        return total + chapter.combined.total;
      }, 0);
      return {
        id: assessment.id || "stage-" + (index + 1),
        number: asCount(block.number) || index + 1,
        title: assessment.title,
        chapters: stageChapters,
        assessment: assessment,
        status: deriveStageStatus(stageChapters, assessment),
        progress: {
          done: combinedDone,
          total: combinedTotal,
          percent: combinedTotal ? Math.round(combinedDone / combinedTotal * 100) : 0
        }
      };
    });
    var stats = source.stats && typeof source.stats === "object" ? source.stats : {};
    var rank = source.rank && typeof source.rank === "object" ? source.rank : {};
    var nextRank = source.nextRank && typeof source.nextRank === "object" ? source.nextRank : null;
    var passedExercises = asCount(stats.passedExercises);
    var totalExercises = asCount(stats.totalExercises);
    var curriculumMastered = chapters.length > 0 && chapters.every(function (chapter) {
      return chapter.state.id === "mastered";
    });
    var completed = curriculumMastered && (
      stages.length === 0 ||
      stages.every(function (stage) { return stage.status.id === "complete"; })
    );
    var resume = deriveJourneyResume(chapters, stages, source.lastExerciseId);

    return {
      heading: completed
        ? "You built the full Python path."
        : resume.kind === "assessment"
          ? "Your next checkpoint is ready."
        : passedExercises
          ? "Continue " + (resume.chapter ? resume.chapter.title : "your Python path") + "."
          : "Start with " + (resume.chapter ? resume.chapter.title : "Python fundamentals") + ".",
      introduction: completed
        ? "Use the roadmap to revisit weak spots, retake timed checkpoints, or refine an exercise until the code explains itself."
        : "Study the model, predict a fresh example, write the smallest useful step, and let tests tell you what to investigate next.",
      resume: resume,
      rank: {
        level: asCount(rank.level) || 1,
        name: String(rank.name || "PEP Explorer"),
        description: String(rank.description || ""),
        accent: String(rank.accent || "#3ccf91")
      },
      nextRank: nextRank ? {
        level: asCount(nextRank.level),
        name: String(nextRank.name || ""),
        starsRemaining: Math.max(0, asCount(nextRank.minStars) - asCount(stats.earnedStars))
      } : null,
      milestones: [
        { label: "Level", value: "L" + (asCount(rank.level) || 1), detail: String(rank.name || "PEP Explorer") },
        { label: "Stars", value: asCount(stats.earnedStars) + " / " + asCount(stats.maxStars), detail: "difficulty collected" },
        { label: "Badges", value: asCount(source.unlockedBadges) + " / " + asCount(source.totalBadges), detail: "achievements unlocked" },
        { label: "Exercises", value: passedExercises + " / " + totalExercises, detail: "green test suites" },
        { label: "Assessments", value: asCount(source.passedAssessmentModes) + " / " + asCount(source.totalAssessmentModes), detail: "timed rooms passed" }
      ],
      stages: stages,
      note: String(source.note || "")
    };
  }

  window.DASHBOARD_MODEL = Object.freeze({
    build: build,
    deriveChapterState: deriveChapterState,
    deriveJourneyResume: deriveJourneyResume,
    deriveResume: deriveResume,
    deriveStageStatus: deriveStageStatus
  });
})();
