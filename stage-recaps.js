(() => {
  "use strict";

  const stageRecaps = {
    "py01-py03": {
      id: "py01-py03-recap",
      title: "Inputs, numbers, and controlled flow",
      summary: "Reconnect the complete beginner pipeline: terminal text enters through input(), conversion gives it useful meaning, and conditions or loops decide what happens next.",
      outcomes: [
        "Trace raw input, converted values, calculations, and exact output as separate stages.",
        "Choose integer, decimal, quotient, remainder, floor, ceiling, or nearest rounding from the real-world rule.",
        "Explain which branch runs and why a loop makes measurable progress toward its stopping condition.",
      ],
      recall: [
        {
          prompt: "Why does typing 12 at input() not immediately give the program an integer?",
          answer: "The keyboard supplies characters. input() returns the string \"12\"; int(...) creates a separate whole-number value only when the program asks for that conversion.",
        },
        {
          prompt: "When a container problem needs both complete groups and leftovers, which two operators preserve both facts?",
          answer: "Use // for the number of complete groups and % for the leftover. Check them with total == group_size * complete_groups + leftover.",
        },
        {
          prompt: "What evidence suggests that a while loop will terminate?",
          answer: "Name a quantity used by the condition, show that every relevant path moves it toward a finite boundary, and verify that the boundary eventually makes the condition false.",
        },
      ],
      bridge: "When you can explain all three answers without running code, use the timed rooms to test whether the model survives new wording and a clock.",
    },
    "py04-py06": {
      id: "py04-py06-recap",
      title: "Reusable logic and sequence thinking",
      summary: "Bring functions, strings, tuples, and lists back into one model: define a clear contract, transform a sequence deliberately, and return data another part of the program can test.",
      outcomes: [
        "State a function contract using parameters, return meaning, and boundary behaviour.",
        "Choose indexing, slicing, iteration, or a string method from the transformation the specification requires.",
        "Separate immutable sequence facts from deliberate list mutation and aliasing.",
      ],
      recall: [
        {
          prompt: "Why is print(result) not a substitute for return result inside a reusable function?",
          answer: "print sends text to the terminal and returns None. return sends a value back to the caller so another function or test can use it.",
        },
        {
          prompt: "What does a slice such as values[start:stop] include and exclude?",
          answer: "It includes start and excludes stop. This half-open rule makes the slice length stop - start and lets adjacent slices meet without overlap.",
        },
        {
          prompt: "How can two different variable names unexpectedly change the same list?",
          answer: "Assignment can make both names refer to one mutable list. Use a deliberate copy when the two versions must evolve independently.",
        },
      ],
      bridge: "Before the checkpoint, explain one transformation with a function contract and one trace table instead of relying on familiar-looking syntax.",
    },
    "py07-py09": {
      id: "py07-py09-recap",
      title: "Structured state and recursive reasoning",
      summary: "Review how keyed collections express relationships, sets express membership, recursion shrinks a problem, and functional tools transform collections without hiding the data flow.",
      outcomes: [
        "Select dictionaries for keyed lookup and sets for unique membership or set algebra.",
        "Prove that a recursive call moves toward a base case and combine its returned value correctly.",
        "Trace map, filter, and reduce as explicit transformations with known input and output shapes.",
      ],
      recall: [
        {
          prompt: "When is a dictionary a better model than a list?",
          answer: "Use a dictionary when a stable key identifies the value you need. A list is a better fit when position and ordered traversal are the primary meaning.",
        },
        {
          prompt: "What two obligations make a recursive definition safe enough to trust?",
          answer: "It needs a base case with a direct result, and every recursive call must receive a smaller or otherwise closer-to-base problem.",
        },
        {
          prompt: "What question distinguishes filter from map?",
          answer: "filter asks which existing items remain; map asks what each item becomes. Neither automatically combines the collection into one result.",
        },
      ],
      bridge: "Use the checkpoint only after you can draw the collection shape and the recursive call stack for a fresh, small example.",
    },
    "py10-py11": {
      id: "py10-py11-recap",
      title: "Pure transformations and algorithm design",
      summary: "Finish the path by connecting effect-free code, divide-and-conquer reasoning, greedy counterexamples, memoization, tabulation, and dynamic-programming state design.",
      outcomes: [
        "Keep input and output at a thin boundary while making the core transformation repeatable and testable.",
        "Explain subproblem boundaries, base cases, combination work, and the resulting time and space costs.",
        "Define a dynamic-programming state, transition, base case, evaluation order, and reconstruction evidence.",
      ],
      recall: [
        {
          prompt: "What makes a function effect-free enough to test repeatedly?",
          answer: "Its result depends only on its arguments, it does not mutate shared state, and calling it again with the same values produces the same result.",
        },
        {
          prompt: "Why is a tempting greedy choice not proof of an optimal algorithm?",
          answer: "A locally best choice can block a better global combination. Search for a small counterexample or prove an exchange argument before trusting greediness.",
        },
        {
          prompt: "What must be written down before filling a dynamic-programming table?",
          answer: "Define what one state means, the choices that lead into it, the base cases, and an order in which every dependency is ready before it is read.",
        },
      ],
      bridge: "The final checkpoint asks whether you can choose and defend a strategy—not merely recognize a famous problem name.",
      award: {
        id: "python-pathforger",
        name: "Python Pathforger",
        monogram: "PY∞",
        description: "Awarded after mastering all twelve chapter guides and exercise suites, then passing both rooms in the final timed checkpoint.",
      },
    },
  };

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) {
      return value;
    }
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  window.STAGE_RECAPS = deepFreeze(stageRecaps);
})();
