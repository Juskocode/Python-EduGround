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
      topics: Array.isArray(source.topics) ? source.topics.slice(0, 3).map(String) : [],
      recapQuestions: Array.isArray(source.recapQuestions)
        ? source.recapQuestions.filter(Boolean).slice(0, 5).map(String)
        : [],
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

    if (mastered && totalModes === 0) {
      return { id: "complete", label: "Stage complete", tone: "success" };
    }
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

  function normalizeReferences(references) {
    return Array.isArray(references)
      ? references
        .filter(function (reference) {
          return reference && reference.url;
        })
        .map(function (reference) {
          return {
            label: String(reference.label || "Python documentation"),
            description: String(reference.description || ""),
            url: String(reference.url)
          };
        })
      : [];
  }

  function normalizeAssessmentModes(modes, assessmentId) {
    var source = Array.isArray(modes) ? modes : [];
    return ["theory", "practical"].map(function (modeId) {
      var mode = source.find(function (candidate) {
        return candidate && String(candidate.id) === modeId;
      }) || {};
      return {
        id: modeId,
        label: modeId === "theory" ? "Theory room" : "Practical room",
        href: "#assessment/" + encodeURIComponent(assessmentId) + "/" + modeId,
        completed: Boolean(mode.completed),
        active: Boolean(mode.active),
        attempted: Boolean(mode.attempted),
        bestScore: Math.max(0, Math.min(100, Number(mode.bestScore) || 0))
      };
    });
  }

  function deriveRecapState(stageStatus) {
    var statusId = stageStatus && stageStatus.id ? stageStatus.id : "upcoming";
    if (statusId === "complete") {
      return { id: "complete", label: "Checkpoint passed", tone: "success" };
    }
    if (statusId === "checkpoint") {
      return { id: "ready", label: "Ready to prove", tone: "warning" };
    }
    if (statusId === "active") {
      return { id: "learning", label: "Learning in progress", tone: "primary" };
    }
    return { id: "preview", label: "Preview the stage", tone: "muted" };
  }

  function normalizeRecap(sourceRecap, stageId, stageChapters, assessment, stageStatus) {
    var source = sourceRecap && typeof sourceRecap === "object" ? sourceRecap : {};
    var uniqueTopics = [];
    stageChapters.forEach(function (chapter) {
      chapter.topics.forEach(function (topic) {
        if (!uniqueTopics.includes(topic)) {
          uniqueTopics.push(topic);
        }
      });
    });
    var guide = stageChapters.reduce(function (result, chapter) {
      result.done += chapter.guide.done;
      result.total += chapter.guide.total;
      return result;
    }, { done: 0, total: 0 });
    var exercises = stageChapters.reduce(function (result, chapter) {
      result.done += chapter.exercises.done;
      result.total += chapter.exercises.total;
      result.stars += chapter.exercises.stars;
      result.maxStars += chapter.exercises.maxStars;
      return result;
    }, { done: 0, total: 0, stars: 0, maxStars: 0 });
    var chapterPrompts = stageChapters.map(function (chapter) {
      return {
        chapterId: chapter.id,
        chapterNumber: chapter.number,
        chapterTitle: chapter.title,
        prompt: chapter.recapQuestions[0] ||
          "Explain the most important idea from " + chapter.title + " using a fresh example."
      };
    });
    return {
      id: String(source.id || stageId + "-recap"),
      href: "#stage/" + encodeURIComponent(stageId) + "/recap",
      title: String(source.title || "Stage recap"),
      summary: String(source.summary || "Reconnect the stage ideas before opening the timed checkpoint."),
      outcomes: Array.isArray(source.outcomes) ? source.outcomes.filter(Boolean).map(String) : [],
      recall: Array.isArray(source.recall)
        ? source.recall.filter(function (item) { return item && item.prompt; }).map(function (item) {
          return {
            prompt: String(item.prompt),
            answer: String(item.answer || "Explain your reasoning, then verify it with a small example.")
          };
        })
        : [],
      bridge: String(source.bridge || ""),
      topics: uniqueTopics,
      chapterPrompts: chapterPrompts,
      aggregate: {
        guide: guide,
        exercises: exercises
      },
      references: assessment.references,
      assessment: assessment,
      state: deriveRecapState(stageStatus),
      status: stageStatus,
      award: source.award && typeof source.award === "object"
        ? {
          id: String(source.award.id || "python-pathforger"),
          name: String(source.award.name || "Python Pathforger"),
          monogram: String(source.award.monogram || "PY∞"),
          description: String(source.award.description || "")
        }
        : null,
      nextAction: null
    };
  }

  function deriveRecapNextAction(stage, nextStage) {
    var assessment = stage.assessment;
    var activeMode = assessment && assessment.modes.find(function (mode) {
      return mode.active;
    });
    if (activeMode) {
      return {
        kind: "assessment",
        label: "Continue " + activeMode.label.toLowerCase(),
        href: activeMode.href
      };
    }
    var unfinishedGuide = stage.chapters.find(function (chapter) {
      return chapter.guide.done < chapter.guide.total;
    });
    if (unfinishedGuide) {
      return {
        kind: "guide",
        label: unfinishedGuide.guide.done ? "Continue chapter " + padNumber(unfinishedGuide.number) : "Learn chapter " + padNumber(unfinishedGuide.number),
        href: "#chapter/" + encodeURIComponent(unfinishedGuide.id) + "/tutorials"
      };
    }
    var unfinishedExercise = null;
    stage.chapters.some(function (chapter) {
      unfinishedExercise = chapter.exerciseItems.find(function (exercise) {
        return !exercise.passed;
      }) || null;
      return Boolean(unfinishedExercise);
    });
    if (unfinishedExercise) {
      return {
        kind: "exercise",
        label: "Practise " + unfinishedExercise.title,
        href: "#exercise/" + encodeURIComponent(unfinishedExercise.id)
      };
    }
    var unfinishedMode = assessment && assessment.modes.find(function (mode) {
      return !mode.completed;
    });
    if (unfinishedMode) {
      return {
        kind: "assessment",
        label: "Open " + unfinishedMode.label.toLowerCase(),
        href: unfinishedMode.href
      };
    }
    if (nextStage && nextStage.chapters[0]) {
      return {
        kind: "next-stage",
        label: "Begin stage " + padNumber(nextStage.number),
        href: "#chapter/" + encodeURIComponent(nextStage.chapters[0].id) + "/tutorials"
      };
    }
    return {
      kind: "achievement",
      label: "View all achievements",
      href: "#profile/badges"
    };
  }

  function padNumber(value) {
    return String(asCount(value)).padStart(2, "0");
  }

  function deriveStepState(isComplete, isCurrent) {
    if (isComplete) {
      return { id: "complete", label: "Complete" };
    }
    if (isCurrent) {
      return { id: "current", label: "Next" };
    }
    return { id: "upcoming", label: "Later" };
  }

  function attachResumeContext(resume, stages) {
    if (!resume || !resume.chapter) {
      return resume;
    }

    var chapter = resume.chapter;
    var stage = stages.find(function (candidate) {
      return candidate.chapters.some(function (stageChapter) {
        return stageChapter.id === chapter.id;
      });
    }) || null;
    var guideComplete = chapter.guide.total > 0 && chapter.guide.done === chapter.guide.total;
    var exercisesComplete = chapter.exercises.total > 0 &&
      chapter.exercises.done === chapter.exercises.total;
    var assessmentComplete = Boolean(stage && stage.status.id === "complete");
    var currentStep = resume.kind === "assessment"
      ? "assessment"
      : resume.kind === "exercise"
        ? "exercises"
        : "guide";

    resume.stage = stage ? {
      id: stage.id,
      number: stage.number,
      title: stage.title,
      status: stage.status,
      progress: stage.progress
    } : null;
    resume.steps = [
      {
        id: "guide",
        label: "Learn the model",
        detail: chapter.guide.done + " / " + chapter.guide.total + " sections",
        href: "#chapter/" + encodeURIComponent(chapter.id) + "/tutorials",
        state: deriveStepState(guideComplete, currentStep === "guide")
      },
      {
        id: "exercises",
        label: "Practise with tests",
        detail: chapter.exercises.done + " / " + chapter.exercises.total + " passed",
        href: "#chapter/" + encodeURIComponent(chapter.id) + "/exercises",
        state: deriveStepState(exercisesComplete, currentStep === "exercises")
      }
    ];

    if (stage && stage.assessment && stage.assessment.id) {
      resume.steps.push({
        id: "assessment",
        label: "Prove it under time",
        detail: stage.assessment.passedModes + " / " + stage.assessment.totalModes + " rooms",
        href: "#assessment/" + encodeURIComponent(stage.assessment.id),
        state: deriveStepState(assessmentComplete, currentStep === "assessment")
      });
    }
    return resume;
  }

  function deriveOverview(chapters, stages, resume) {
    var combined = chapters.reduce(function (result, chapter) {
      result.done += chapter.combined.done;
      result.total += chapter.combined.total;
      if (chapter.state.id === "mastered") {
        result.mastered += 1;
      } else if (chapter.state.id === "upcoming") {
        result.upcoming += 1;
      } else {
        result.active += 1;
      }
      return result;
    }, { done: 0, total: 0, mastered: 0, active: 0, upcoming: 0 });
    var currentStage = stages.find(function (stage) {
      return stage.status.id !== "complete";
    }) || stages[stages.length - 1] || null;
    var currentChapterIndex = resume && resume.chapter
      ? chapters.findIndex(function (chapter) { return chapter.id === resume.chapter.id; })
      : -1;
    var nextChapter = chapters.slice(Math.max(0, currentChapterIndex + 1)).find(function (chapter) {
      return chapter.state.id !== "mastered";
    }) || null;

    return {
      chapters: chapters.length,
      mastered: combined.mastered,
      active: combined.active,
      upcoming: combined.upcoming,
      progress: {
        done: combined.done,
        total: combined.total,
        percent: combined.total ? Math.round(combined.done / combined.total * 100) : 0
      },
      currentStage: currentStage ? {
        number: currentStage.number,
        title: currentStage.title,
        status: currentStage.status,
        progress: currentStage.progress
      } : null,
      focus: resume && resume.chapter ? {
        id: resume.chapter.id,
        title: resume.chapter.title,
        topics: resume.chapter.topics,
        percent: resume.chapter.combined.percent
      } : null,
      nextChapter: nextChapter ? {
        id: nextChapter.id,
        number: nextChapter.number,
        title: nextChapter.title,
        topics: nextChapter.topics
      } : null
    };
  }

  function deriveSnakeAmbience(chapters, stages) {
    var safeChapters = Array.isArray(chapters) ? chapters : [];
    var safeStages = Array.isArray(stages) ? stages : [];
    var masteredChapters = safeChapters.filter(function (chapter) {
      return chapter && chapter.state && chapter.state.id === "mastered";
    }).length;
    var completedStages = safeStages.filter(function (stage) {
      return stage && stage.status && stage.status.id === "complete";
    }).length;
    var assessmentTotals = safeStages.reduce(function (result, stage) {
      var assessment = stage && stage.assessment;
      if (!assessment) {
        return result;
      }
      var totalModes = asCount(assessment.totalModes);
      result.total += totalModes;
      result.passed += Math.min(asCount(assessment.passedModes), totalModes);
      return result;
    }, { passed: 0, total: 0 });
    var groups = [
      Object.freeze({
        id: "chapters",
        tone: "green",
        label: "Mastered chapters",
        count: masteredChapters,
        total: safeChapters.length
      }),
      Object.freeze({
        id: "stages",
        tone: "blue",
        label: "Completed stages",
        count: completedStages,
        total: safeStages.length
      }),
      Object.freeze({
        id: "tests",
        tone: "yellow",
        label: "Passed timed rooms",
        count: assessmentTotals.passed,
        total: assessmentTotals.total
      })
    ];
    var totalEarned = groups.reduce(function (total, group) {
      return total + group.count;
    }, 0);
    var totalAvailable = groups.reduce(function (total, group) {
      return total + group.total;
    }, 0);
    return Object.freeze({
      groups: Object.freeze(groups),
      totalEarned: totalEarned,
      totalAvailable: totalAvailable,
      percent: totalAvailable ? Math.round(totalEarned / totalAvailable * 100) : 0
    });
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
      var totalModes = asCount(block.totalModes) || 2;
      var assessment = {
        id: String(block.id || ""),
        title: String(block.title || "Stage assessment"),
        passedModes: Math.min(asCount(block.passedModes), totalModes),
        totalModes: totalModes,
        references: normalizeReferences(block.references),
        modes: normalizeAssessmentModes(block.modes, String(block.id || ""))
      };
      var combinedDone = stageChapters.reduce(function (total, chapter) {
        return total + chapter.combined.done;
      }, 0);
      var combinedTotal = stageChapters.reduce(function (total, chapter) {
        return total + chapter.combined.total;
      }, 0);
      var status = deriveStageStatus(stageChapters, assessment);
      var stage = {
        id: assessment.id || "stage-" + (index + 1),
        number: asCount(block.number) || index + 1,
        title: assessment.title,
        chapters: stageChapters,
        assessment: assessment,
        status: status,
        progress: {
          done: combinedDone,
          total: combinedTotal,
          percent: combinedTotal ? Math.round(combinedDone / combinedTotal * 100) : 0
        }
      };
      stage.recap = normalizeRecap(
        block.recap,
        stage.id,
        stageChapters,
        assessment,
        status
      );
      return stage;
    });
    var assignedChapterIds = new Set();
    stages.forEach(function (stage) {
      stage.chapters.forEach(function (chapter) {
        assignedChapterIds.add(chapter.id);
      });
    });
    var independentChapters = chapters.filter(function (chapter) {
      return !assignedChapterIds.has(chapter.id);
    });
    if (independentChapters.length > 0) {
      var isGameProjectStudio = independentChapters.length === 1 &&
        independentChapters[0].id === "py13";
      var combinedDone = independentChapters.reduce(function (total, chapter) {
        return total + chapter.combined.done;
      }, 0);
      var combinedTotal = independentChapters.reduce(function (total, chapter) {
        return total + chapter.combined.total;
      }, 0);
      stages.push({
        id: isGameProjectStudio ? "game-project-studio" : "independent-practice",
        number: stages.length + 1,
        title: isGameProjectStudio ? "Game Project Studio" : "Independent Problem Solving",
        chapters: independentChapters,
        assessment: null,
        status: deriveStageStatus(independentChapters, null),
        progress: {
          done: combinedDone,
          total: combinedTotal,
          percent: combinedTotal ? Math.round(combinedDone / combinedTotal * 100) : 0
        }
      });
    }
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
    stages.forEach(function (stage, index) {
      if (stage.recap) {
        stage.recap.nextAction = deriveRecapNextAction(stage, stages[index + 1] || null);
      }
      stage.snakeAmbience = deriveSnakeAmbience(stage.chapters, [stage]);
      if (stage.recap) {
        stage.recap.snakeAmbience = stage.snakeAmbience;
      }
    });
    var finalStage = stages[stages.length - 1] || null;
    var awardStage = stages.slice().reverse().find(function (stage) {
      return Boolean(stage.recap && stage.recap.award);
    }) || null;
    var finalAwardSource = awardStage && awardStage.recap ? awardStage.recap.award : null;
    var hasTrailingStages = Boolean(
      awardStage && stages.indexOf(awardStage) < stages.length - 1
    );
    var earlierStagesComplete = stages.length > 1 && stages.slice(0, -1).every(function (stage) {
      return stage.status.id === "complete";
    });
    var awardState = completed
      ? { id: "unlocked", label: "Unlocked", tone: "success" }
      : !hasTrailingStages &&
          earlierStagesComplete &&
          finalStage &&
          finalStage.status.id === "checkpoint"
        ? { id: "ready", label: "Ready to earn", tone: "warning" }
        : { id: "locked", label: "Locked", tone: "muted" };
    var completionAward = finalAwardSource ? {
      id: finalAwardSource.id,
      name: finalAwardSource.name,
      monogram: finalAwardSource.monogram,
      description: finalAwardSource.description,
      state: awardState,
      href: awardState.id === "ready" && awardStage && awardStage.assessment
        ? "#assessment/" + encodeURIComponent(awardStage.assessment.id)
        : awardState.id === "unlocked"
          ? "#profile/badges"
          : ""
    } : null;
    if (awardStage && awardStage.recap && completionAward) {
      awardStage.recap.award = completionAward;
    }
    var resume = attachResumeContext(
      deriveJourneyResume(chapters, stages, source.lastExerciseId),
      stages
    );

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
      snakeAmbience: deriveSnakeAmbience(chapters, stages),
      pathComplete: completed,
      completionAward: completionAward,
      overview: deriveOverview(chapters, stages, resume),
      note: String(source.note || "")
    };
  }

  window.DASHBOARD_MODEL = Object.freeze({
    build: build,
    deriveChapterState: deriveChapterState,
    deriveJourneyResume: deriveJourneyResume,
    deriveResume: deriveResume,
    deriveStageStatus: deriveStageStatus,
    deriveSnakeAmbience: deriveSnakeAmbience
  });
})();
