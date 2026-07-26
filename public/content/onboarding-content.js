(() => {
  "use strict";

  const tutorialId = (title) => `tutorial-${title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")}`;

  const section = (
    title,
    explanation,
    exampleCode,
    checklist,
    takeaway,
    commonPitfall,
  ) => ({
    id: tutorialId(title),
    title,
    explanation,
    exampleCode,
    checklist,
    takeaway,
    commonPitfall,
    sampleInput: [],
  });

  const runStep = (phase, action, evidence, why, whenStuck) => ({
    phase,
    action,
    evidence,
    why,
    whenStuck,
  });

  const chapter = {
    id: "py00",
    number: "00",
    title: "Launch Python",
    kind: "onboarding",
    summary: "Set up one safe workspace, make your first editable run, and learn how to recover when the result surprises you. No experience or local installation is required.",
    topics: [
      "motivation",
      "browser setup",
      "optional local Python",
      "editor and terminal",
      "first run",
      "errors as evidence",
    ],
  };

  const material = {
    id: "py00-launch-python-class",
    title: "Launch Python",
    subtitle: chapter.summary,
    audience: "Complete beginners who may never have used a code editor, terminal, programming language, or command-line instruction before.",
    prerequisites: [
      "No programming or terminal experience is required; this room introduces each workspace part before asking you to use it.",
      "You only need a modern browser, a keyboard, and an internet connection while the browser downloads Python for the first run.",
    ],
    estimatedMinutes: 40,
    preparation: [
      "Open this room through an http or https address so the browser worker can load Python; a file address may block required runtime files.",
      "Keep passwords, API keys, private files, and other secrets outside every practice editor and sample-input box.",
      "Choose a quiet ten-minute window in which you can predict, run, inspect, and change one small example without rushing.",
    ],
    pageSummary: [
      "Programming is a learnable process of turning a goal into small instructions, testing one idea, and improving it with observable evidence rather than memorizing every command.",
      "The browser route is the recommended start because it needs no Python installation; a local Python setup becomes useful later for operating-system files, packages, Pygame windows, and larger projects.",
      "The editor changes saved source text, Run asks the Python interpreter to execute the current instructions, and the terminal shows printed output or an error report from that execution.",
      "A sustainable learning loop is predict, run, compare, explain, change one thing, and run again; errors belong inside that loop and do not mean that the course is damaged.",
    ],
    startHere: {
      title: "Welcome — your first win is one Run away",
      description: "This room teaches the workspace before asking you to remember Python. Follow one small action at a time and keep the evidence visible.",
      steps: [
        {
          label: "Choose a destination",
          detail: "Pick games, automation, data, or problem solving as one personal reason to keep learning when a later exercise becomes difficult.",
        },
        {
          label: "Find the writing area",
          detail: "Click inside the Python editor; its blinking cursor marks where the next typed character will enter the source.",
        },
        {
          label: "Run one safe example",
          detail: "Predict the message, press Run, and allow extra time while the browser prepares its Python runtime for the first execution.",
        },
        {
          label: "Change one thing",
          detail: "Edit only one word between the quotation marks, predict the new message, and Run again before moving on.",
        },
      ],
      reassurance: "You cannot damage the course by experimenting here. Errors are messages, Reset restores the authored starter, and drafts save automatically. Never place secrets or private information in practice code.",
    },
    objectives: [
      "Connect one personal goal to a later course destination such as Snake, a platformer, automation, data work, or algorithmic problem solving.",
      "Choose the no-install browser route now and describe when an optional local Python installation becomes useful.",
      "Distinguish a program, source file, editor, interpreter, Run control, Reset control, and terminal during one execution.",
      "Edit and run a harmless Python program, then use the terminal result or traceback as evidence for one next change.",
      "Use the repeatable predict → run → compare → explain learning loop and distinguish experimentation with Run from verification with Check task.",
    ],
    lessonPlan: [
      {
        label: "Mission 0 · choose a reason",
        minutes: 5,
        purpose: "Connect one personal outcome to a later course project so the learner has a concrete reason to practise through unfamiliar syntax.",
      },
      {
        label: "Mission 1 · choose today's workspace",
        minutes: 8,
        purpose: "Compare browser and local Python accurately, then begin through the no-install route without treating optional setup as a barrier.",
      },
      {
        label: "Mission 2 · meet one execution",
        minutes: 8,
        purpose: "Identify the editor, source, interpreter, controls, and terminal while predicting where code and observable evidence belong.",
      },
      {
        label: "Mission 3 · make an editable first run",
        minutes: 12,
        purpose: "Predict, run, change one word, run again, and use Reset so each interface action has one visible and explainable consequence.",
      },
      {
        label: "Mission 4 · build a recovery habit",
        minutes: 7,
        purpose: "Read a safe traceback from its final line, distinguish Run from Check task, and choose a short repeatable practice rhythm.",
      },
    ],
    lectureDemo: {
      title: "Send your first signal to Python",
      setup: "This program already works. Do not memorize its punctuation yet: predict the message, press Run, then change only the words between the quotation marks and run it again.",
      filename: "first-signal.py",
      code: "print(\"My Python journey starts here.\")",
      stdin: [],
      expectedOutput: "My Python journey starts here.",
      teachingPoints: [
        "The editor contains the current instruction, while the terminal contains evidence produced by a particular run.",
        "Run asks the Python interpreter to execute the current source from the beginning and does not rewrite an earlier terminal result.",
        "The print call publishes the quoted message and normally finishes that output line.",
        "Reset restores the authored starter when several experiments make the current source difficult to understand.",
      ],
      questions: [
        "What exact line will appear before you press Run?",
        "Which part changes when you replace here with now: the source, the old terminal result, or the next execution?",
        "What will Reset restore after your experiment?",
      ],
    },
    roomTasks: [
      {
        id: "py00-choose-a-goal",
        title: "Choose your learning compass",
        summary: "A concrete destination gives today's small instruction a reason to exist.",
        explanation: [
          "Python can automate repeated work, explore data, express algorithms, and power game rules such as movement, collision, scoring, and level state.",
          "The destination can change later; choosing one now simply gives you a useful question to return to when practice feels abstract.",
        ],
        kind: "answer",
        prompt: "Choose one route you would most like Python to help you explore: games, automation, data, or problem solving.",
        acceptedAnswers: ["games", "automation", "data", "problem solving", "problem-solving"],
        placeholder: "Type one displayed route",
        hint: "There is no best route. Type the one that makes you most curious today.",
        success: "That goal is now your learning compass; return to it when a difficult exercise feels disconnected.",
      },
      {
        id: "py00-browser-or-local",
        title: "Choose the no-install start",
        summary: "The browser is enough for the first chapters, while local Python remains an optional later tool.",
        explanation: [
          "Browser Python runs in a dedicated worker and may take longer on its first launch because the runtime must be downloaded.",
          "Local Python becomes useful for real Pygame windows, operating-system files, third-party packages, and projects that must run outside this course.",
        ],
        kind: "answer",
        prompt: "Which setup path lets you run this class without installing Python on your computer?",
        acceptedAnswers: ["browser", "browser python", "in-browser", "in browser"],
        placeholder: "Type the setup path",
        hint: "It is the recommended path already built into this course page.",
        success: "Browser Python is enough to begin; local installation remains an optional later step.",
      },
      {
        id: "py00-workspace-interpreter",
        title: "Name what executes the source",
        summary: "Editing, executing, and observing are separate parts of one programming workspace.",
        explanation: [
          "The editor changes readable source code and the terminal shows communication from a running program.",
          "Between them, the Python interpreter reads valid instructions and carries them out in order.",
        ],
        kind: "answer",
        prompt: "What one-word component reads the current Python instructions after you press Run?",
        acceptedAnswers: ["interpreter", "python interpreter"],
        placeholder: "Type the component name",
        hint: "It is not the editor and not the terminal.",
        success: "You separated the editor that changes source from the interpreter that executes it and the terminal that shows evidence.",
      },
      {
        id: "py00-first-signal",
        title: "Publish an existing message",
        summary: "Use one provided name so you can focus on the edit-run-observe loop instead of inventing a program.",
        explanation: [
          "Assignment stores a value under a useful name but does not automatically display it.",
          "A print call publishes the value inside its parentheses to the terminal.",
        ],
        kind: "code",
        prompt: "Replace the unfinished line with one print call that publishes the existing message exactly once.",
        starterCode: [
          "message = \"My Python journey starts now.\"",
          "# TODO: make the existing message visible in the terminal.",
        ].join("\n"),
        stdin: [],
        expectedOutput: "My Python journey starts now.",
        requirements: [
          "Keep the supplied message unchanged.",
          "Publish message exactly once.",
          "Do not request input.",
        ],
        sourceRules: [
          {
            id: "prints-existing-message",
            label: "Publish the existing message through print().",
            target: "code",
            pattern: "\\bprint\\s*\\(\\s*message\\s*\\)",
            flags: "u",
            minMatches: 1,
            maxMatches: 1,
            passFeedback: "The stored message crosses the output boundary exactly once.",
            failFeedback: "Add one print(message) call beneath the existing assignment.",
          },
          {
            id: "does-not-read-input",
            label: "Keep this first signal independent of input.",
            target: "code",
            pattern: "\\binput\\s*\\(",
            flags: "u",
            minMatches: 0,
            maxMatches: 0,
            passFeedback: "The first signal runs without waiting for input.",
            failFeedback: "Remove input(); this first signal only publishes the supplied message.",
          },
        ],
        hint: "Use the function name print, parentheses, and the existing variable name without quotation marks.",
        success: "You changed source, ran the program, and used terminal evidence to verify one exact line.",
      },
      {
        id: "py00-read-the-error",
        title: "Turn red text into a clue",
        summary: "A traceback records where execution stopped and names the rule Python could not follow.",
        explanation: [
          "Preserve the message before editing so you do not erase the most useful evidence.",
          "The final traceback line normally names the exception and gives a short explanation; then the referenced source line shows where to investigate.",
        ],
        kind: "answer",
        prompt: "When Python shows a traceback, which line should you read first to find the exception name?",
        acceptedAnswers: ["last line", "final line", "bottom line", "the last line", "the final line", "the bottom line"],
        placeholder: "Type the line position",
        hint: "Start at the bottom of the traceback, then work upward to the source location.",
        success: "Red text is evidence: preserve it, read the final line, and change one likely cause.",
      },
      {
        id: "py00-run-before-check",
        title: "Separate experiments from verification",
        summary: "Use the least consequential control while exploring, then ask the authored checkpoint to verify your result.",
        explanation: [
          "Run executes the current editor and input as an experiment without recording a task pass.",
          "Check task restores the authored input, checks exact output and required technique, then records completion only when all evidence agrees.",
        ],
        kind: "answer",
        prompt: "Which control lets you experiment without recording task completion: Run or Check task?",
        acceptedAnswers: ["run", "run code"],
        placeholder: "Type one control",
        hint: "Use this control repeatedly while predicting and changing one thing.",
        success: "Run is your laboratory; Check task verifies the authored case only when you are ready.",
      },
    ],
    classActivities: [
      {
        title: "Map one run without jargon",
        format: "Solo trace",
        minutes: 5,
        prompt: "Point to the source, editor, Run control, interpreter role, and terminal, then explain the journey of the quoted message in everyday language.",
        evidence: "A five-part explanation that separates what is stored, what executes, and what becomes visible.",
      },
      {
        title: "Choose one sustainable session",
        format: "Personal plan",
        minutes: 5,
        prompt: "Choose a recurring fifteen-minute window and write the smallest action that will begin it, such as opening the next lesson and making one prediction.",
        evidence: "One realistic time, one visible first action, and one rule for stopping after a useful small win.",
      },
    ],
    independentPractice: [
      "Change one word in the lecture demo, predict the exact new line, run it, and explain why the earlier terminal text did not change.",
      "Use Reset after an experiment and identify which authored source returned and which saved terminal evidence remained separate.",
      "Write the six workspace words on paper and explain each one without copying the definition from the page.",
      "Choose one fifteen-minute practice window and begin it with a prediction rather than an unplanned code edit.",
    ],
    recapQuestions: [
      "What do you want Python to help you build or understand?",
      "Why is browser Python the recommended starting path?",
      "How do source code, editor, interpreter, and terminal differ?",
      "What new execution begins when you press Run?",
      "When is Reset more useful than another random edit?",
      "What should you inspect first in a traceback?",
      "Why should only one thing change between experiments?",
      "How is Run different from Check task?",
    ],
    homework: {
      brief: "Make one tiny, repeatable learning promise before Chapter 1 rather than attempting a large project immediately.",
      deliverables: [
        "One sentence naming the project or problem that currently motivates you.",
        "One fifteen-minute study window with a visible first action.",
        "One successful edited run and a short note describing the editor-to-terminal journey.",
      ],
      selfReview: [
        "I can locate the editor, Run control, Reset control, sample input, and terminal without guessing.",
        "I know that an error is evidence from one execution rather than damage to the course.",
        "I can explain why browser Python is enough now and when local Python may become useful.",
      ],
    },
    nextSteps: [
      "I can locate the editor, Run control, and terminal.",
      "I have changed and run Python successfully.",
      "I know that an error is evidence, not damage.",
      "I can use Reset and distinguish Run from Check task.",
      "I have one personal reason to keep learning.",
    ],
  };

  const learning = {
    title: "Launch Python",
    subtitle: "Build a safe first workspace, make one editable run, and leave with a learning rhythm instead of a list of commands to memorize.",
    objectives: material.objectives,
    tutorial: [
      section(
        "Why programming is learnable",
        "Programming is not a memory contest. It is the practice of turning a goal into smaller instructions, predicting what those instructions should do, and using evidence to improve them. Professional programmers still consult documentation, run tiny experiments, and make mistakes. Your first goal can be a game such as Snake or a platformer, a repetitive task you want to automate, a dataset you want to understand, or a problem-solving pattern such as dynamic programming. Every one of those paths starts with the same small skill: explain one instruction, run it, and inspect what actually happened.",
        "destination = \"a small game\"\nnext_step = \"run one clear instruction\"\nprint(destination)\nprint(next_step)",
        [
          "Choose one personal destination without treating it as a permanent commitment.",
          "Break that destination into the smallest action you can complete today.",
          "Expect to use documentation and experiments instead of memorizing every command.",
          "Measure progress by what you can predict, explain, and adapt.",
        ],
        "Motivation becomes durable when a large destination is connected to one small action that can succeed today.",
        "Waiting until you understand all of Python before building anything turns curiosity into an impossible prerequisite.",
      ),
      section(
        "Start in the browser and install locally later",
        "The browser route is recommended because this page already provides an editor, an isolated Python worker, sample input, and a terminal. The first run needs a network connection while the Python runtime downloads and may take longer than later runs. Use an http or https address rather than opening the page as a local file. A local Python installation is optional for these first lessons. Add it later when you want a real Pygame window, operating-system file access, third-party packages, or a project that runs outside the course. On macOS or Linux, python3 --version checks a local installation; on Windows, py --version is common. Only install from python.org or a trusted managed environment.",
        "workspace = \"browser\"\ninstallation_required = False\nprint(workspace)\nprint(installation_required)",
        [
          "Use the browser route now unless a teacher or workplace already provides a managed local environment.",
          "Allow extra time and network access for the first browser-Python run.",
          "Keep secrets and private data outside every practice editor.",
          "Choose local Python later for packages, files, Pygame windows, or standalone projects.",
        ],
        "Setup is a tool choice, not a test: browser Python removes the installation barrier while local Python remains available when a project needs it.",
        "A browser worker reduces risk but is not permission to execute unknown code or paste credentials into a program.",
      ),
      section(
        "Meet the parts of one run",
        "A program is an organized sequence of instructions. Source code is its readable text, and a source file stores that text. The editor is where you change the source. Run starts a new execution and asks the Python interpreter to follow the current instructions. The terminal is a communication area that shows printed output, accepts requested input, and displays error reports. These parts cooperate, but they are not interchangeable: changing old terminal text does not edit the source, and assigning a value in source does not make it visible until an instruction such as print publishes it.",
        "message = \"Editor to interpreter to terminal\"\nprint(message)",
        [
          "Point to the editor and terminal before pressing a control.",
          "Describe Run as the start of a new execution of the current source.",
          "Keep saved instructions separate from output produced by one run.",
          "Identify print as the instruction that publishes the selected value.",
        ],
        "One run flows from current source through the interpreter to observable terminal evidence.",
        "Treating the terminal as the source file makes it unclear whether an edit changes future instructions or only visible evidence from a past run.",
      ),
      section(
        "Run, change one thing, and reset deliberately",
        "Begin by predicting the exact message. Press Run once and let the result remain visible. Change one word between the quotation marks in the editor, predict again, and start a second run. Comparing two controlled runs makes the cause of the difference obvious. If several edits create confusion, Reset restores the authored starter so you can begin from known source. Copy is useful for moving code you understand, but pasted code should still be read and predicted before it is trusted.",
        "signal = \"Ready for one small step\"\nprint(signal)",
        [
          "Predict exact capitalization, spaces, punctuation, and line count.",
          "Change only one source detail between two runs.",
          "Use Reset to return to a known starter instead of stacking guesses.",
          "Read and explain copied code before running it.",
        ],
        "Controlled experiments preserve cause and effect: one edit, one prediction, one run, one comparison.",
        "Changing many lines after a surprise erases the first difference that could have explained the result.",
      ),
      section(
        "Use errors as evidence and build a learning rhythm",
        "When Python cannot follow an instruction, it reports an exception and often a traceback. Preserve the message. Read the final line first to find the exception name and short explanation, then inspect the referenced source line. Change one likely cause and predict the next result before running again. Use Run for experiments; use Check task when you want the room to compare exact output and required technique and record completion. A repeatable fifteen-minute session—one concept, one prediction, one run, one explanation—builds more skill than an occasional exhausting sprint.",
        "message = \"Evidence beats guessing\"\nprint(message)",
        [
          "Preserve a traceback before editing and read its final line first.",
          "Use Run while exploring and Check task only when ready to verify.",
          "Change one likely cause and predict again.",
          "Schedule a short session with one visible starting action.",
        ],
        "The durable loop is predict → run → compare → explain → change one thing → run again.",
        "Reading red text as a verdict encourages random edits; reading it as evidence makes the next experiment smaller and more precise.",
      ),
    ],
    deepDive: {
      mentalModel: {
        title: "Two setup paths, one learning loop",
        body: "Browser and local Python are different containers for the same reasoning process. Begin with the route that removes friction, then switch only when a project requirement gives you a reason.",
        steps: [
          { label: "Browser now", detail: "Use the built-in editor, worker, input panel, and terminal without installing Python." },
          { label: "Predict", detail: "Write the exact result you expect before pressing Run." },
          { label: "Observe", detail: "Keep output or the complete traceback as evidence from that execution." },
          { label: "Explain", detail: "Name the first difference and the rule that produced it." },
          { label: "Local later", detail: "Install from python.org when files, packages, standalone programs, or a Pygame window require it." },
        ],
      },
      guidedPractice: [
        {
          title: "Design a tiny launch message",
          prompt: "Choose a new message that names your motivation, predict it exactly, then change only the quoted text in the starter.",
          starterCode: "print(\"I want to build a small game.\")",
          questions: [
            "Which characters belong to source syntax and which characters should appear in the terminal?",
            "What one edit will make the next run different?",
            "How will you prove that the earlier terminal result came from a previous run?",
          ],
          reveal: "Keep the print call stable and change only its string literal. The next execution publishes the new characters, while the older result remains evidence of the previous source.",
        },
      ],
      glossary: [
        { term: "program", definition: "An organized sequence of instructions intended for a computer to execute." },
        { term: "source code", definition: "Readable text that expresses program instructions." },
        { term: "editor", definition: "The workspace used to view and change source code." },
        { term: "interpreter", definition: "The program that reads Python source and carries out valid instructions." },
        { term: "terminal", definition: "A text interface that shows output, accepts requested input, and displays error reports." },
        { term: "execution", definition: "One run of the current program from its starting state." },
        { term: "traceback", definition: "Python's report of the calls and source locations involved when an exception stops execution." },
      ],
      debugChecklist: [
        "Confirm the page is served through http or https and the first runtime download has network access.",
        "Confirm the editor contains the source you intended to run.",
        "Write the expected terminal line before pressing Run.",
        "If an error appears, preserve it and read the final traceback line first.",
        "Change only one likely cause before predicting and running again.",
        "Use Reset when the current source no longer has one clear, explainable change.",
      ],
      checkpoint: {
        question: "Which action gives the clearest evidence after a surprising first run?",
        options: [
          "Change several lines immediately",
          "Preserve the result and find the first difference from the prediction",
          "Delete the traceback before reading it",
          "Install a different Python version",
        ],
        answerIndex: 1,
        explanation: "Preserving the first result keeps the evidence needed to connect one source line or rule to the surprise.",
      },
    },
    coachConversation: [
      { learner: "Do I need to install Python before I begin?", coach: "No. Start with browser Python. Install locally later when a project needs files, packages, a standalone command, or a real Pygame window." },
      { learner: "Do real programmers remember every command?", coach: "No. They build mental models, read documentation, test small examples, and keep useful evidence when an assumption is wrong." },
      { learner: "Can an error damage the course?", coach: "A syntax or runtime error only stops that execution. Preserve the message, read its final line, and use Reset whenever you want the authored starter back." },
      { learner: "Why are Run and Check task separate?", coach: "Run is a laboratory for any current code and input. Check task verifies the authored case and technique, then records completion only when the evidence passes." },
      { learner: "What if I only have fifteen minutes?", coach: "That is enough for one useful loop: read one idea, predict one result, run once, and explain the first difference." },
    ],
    documentation: [
      { label: "Using Python", description: "Official platform-specific guidance for installing and invoking Python when you later choose a local setup.", url: "https://docs.python.org/3/using/index.html" },
      { label: "The Python interpreter", description: "Official introduction to starting Python and how the interpreter reads instructions.", url: "https://docs.python.org/3/tutorial/interpreter.html" },
      { label: "An informal introduction to Python", description: "Official first examples of values, text, and simple interactive experimentation.", url: "https://docs.python.org/3/tutorial/introduction.html" },
      { label: "Built-in print()", description: "Official reference for the function that publishes values to the output stream.", url: "https://docs.python.org/3/library/functions.html#print" },
    ],
    runbook: [
      runStep("1. Choose one reason", "Name a project, repeated task, dataset, or problem that makes one small Python session worthwhile.", "One personal destination and the smallest useful action for today.", "A concrete destination gives unfamiliar syntax a reason without requiring a large project immediately.", "Choose games, automation, data, or problem solving from the displayed paths and allow the choice to change later."),
      runStep("2. Orient the workspace", "Point to the editor, current source, Run and Reset controls, interpreter role, sample input, and terminal before executing.", "A spoken or written map that separates instructions, execution, and observable evidence.", "Workspace clarity prevents terminal output, source code, and control actions from blending into one confusing surface.", "Describe each part in everyday words and use the page labels instead of trying to memorize technical definitions."),
      runStep("3. Predict and run once", "Write the exact output, press Run, and keep the terminal result or traceback visible without editing immediately.", "One untouched prediction beside one observed result.", "The first comparison creates evidence; repeated unplanned changes erase the cause of a difference.", "Allow extra time on the first run while browser Python downloads, then check the connection if the worker cannot start."),
      runStep("4. Explain one difference", "Compare prediction and observation, read the final traceback line when present, and name the first source detail or rule that differs.", "A one-sentence explanation tied to one visible line or message.", "The earliest mismatch is usually causal, while later surprises may only be consequences.", "Use Reset to recover known source, then repeat with only one controlled edit."),
      runStep("5. Continue sustainably", "Use Check task when ready, record one useful idea, and schedule the next fifteen-minute session with a visible first action.", "A completed checkpoint, one reflection, and one realistic next session.", "Short repeatable loops build prediction and explanation skills without making motivation depend on a long free evening.", "Stop after one clear win, then continue with Chapter 1 when you can locate the workspace and recover from a surprise."),
    ],
  };

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) {
      return value;
    }
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  window.ONBOARDING_CONTENT = deepFreeze({
    chapter,
    material,
    learning,
    handoff: {
      eyebrow: "Ready for code",
      title: "Continue to Chapter 1 · First Programs",
      description: "Chapter 0 taught you how to operate the room. Chapter 1 explains what the instructions mean and introduces exact output, variables, input, and deliberate conversion.",
      action: "Start Chapter 1",
      href: "#chapter/py01/tutorials",
      tocLabel: "Chapter 1 handoff",
    },
  });
})();
