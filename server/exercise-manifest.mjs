const CHAPTERS = [
  {
    id: "py01",
    directory: "Py01 First Programs",
    exercises: [
      "py01-first-programs",
      "py01-fixme",
      "py01-diagram",
      "py01-avoid-sums",
      "py01-uncensor",
      "py01-travelling",
    ],
  },
  {
    id: "py02",
    directory: "Py02 Simple data",
    exercises: [
      "py02-circle-area",
      "py02-hypotenuse",
      "py02-means",
      "py02-trip-cost",
      "py02-repetitions",
      "py02-easy-change",
      "py02-alarm-clock",
      "py02-quadratic-formula",
      "py02-weird-sum",
      "py02-multiples",
    ],
  },
  {
    id: "py03",
    directory: "Py03 Flow, Condicionals & Iteration",
    exercises: [
      "py03-who-needs-for",
      "py03-divisors",
      "py03-octal-to-decimal",
      "py03-looping-numbers",
      "py03-printing-pattern",
      "py03-prime-numbers",
      "py03-combinations",
      "py03-flow-diagram",
      "py03-grading-fp",
      "py03-pi",
    ],
  },
  {
    id: "py04",
    directory: "Py04 Functions",
    exercises: [
      "py04-boolean-function",
      "py04-counting-characters",
      "py04-dogs-age",
      "py04-greatest-number",
      "py04-ugly-number",
      "py04-collatz",
      "py04-pascal",
      "py04-get-positions",
      "py04-digits-average",
      "py04-caesar-fibonacci",
    ],
  },
  {
    id: "py05",
    directory: "Py05 Strings & Tuples",
    exercises: [
      "py05-counting-characters",
      "py05-counting-elements",
      "py05-discard-middle",
      "py05-longest-word",
      "py05-first-repeating-letter",
      "py05-find-treasure",
      "py05-remove-leading-zeros",
      "py05-summary-ranges",
      "py05-palindrome-index",
      "py05-greatest-member",
    ],
  },
  {
    id: "py06",
    directory: "Py06 Lists",
    exercises: [
      "py06-rotating",
      "py06-fibonacci",
      "py06-fetch-middle",
      "py06-bagdiff",
      "py06-nth-lowest",
      "py06-orthogonal-matrices",
      "py06-pattern-hunting",
      "py06-minimizing-path",
      "py06-last-man-standing",
    ],
  },
  {
    id: "py07",
    directory: "Py07 Dictionaries & Sets",
    exercises: [
      "py07-academy-awards",
      "py07-lost-element",
      "py07-most-frequent",
      "py07-sort-by-value",
      "py07-complete-pairs",
      "py07-change",
      "py07-treasure",
      "py07-heroes-villains",
      "py07-budgeting",
      "py07-tfidf",
    ],
  },
  {
    id: "py08",
    directory: "Py08 Recursion",
    exercises: [
      "py08-sum-digits",
      "py08-gcd",
      "py08-find-treasure",
      "py08-juggler",
      "py08-biggest-member",
      "py08-digits-average",
      "py08-no-pairs-of-ones",
      "py08-preorder",
      "py08-last-man-standing",
      "py08-unordered-permutations",
      "py08-knapsack",
    ],
  },
  {
    id: "py09",
    directory: "Py09 FP with collections",
    exercises: [
      "py09-fahrenheit",
      "py09-celsius",
      "py09-polynomials",
      "py09-rearranging",
      "py09-map-filter-reduce",
      "py09-interval-generator",
    ],
  },
  {
    id: "py10",
    directory: "Py10 Effect-free programming",
    exercises: [
      "py10-fahrenheit",
      "py10-celsius",
      "py10-polynomials",
      "py10-rearranging",
      "py10-composites",
      "py10-batch-normalization",
      "py10-shortening-numbers",
    ],
  },
  {
    id: "py11",
    directory: "Py11 Divide and Conquer",
    exercises: ["py11-bubble-sort", "py11-count-zeros", "py11-bitonic-point"],
  },
];

function createManifest() {
  const manifest = new Map();
  for (const chapter of CHAPTERS) {
    chapter.exercises.forEach((exerciseId, index) => {
      if (manifest.has(exerciseId)) throw new Error(`Duplicate exercise id: ${exerciseId}`);
      const filename = `ex${String(index).padStart(2, "0")}.py`;
      manifest.set(
        exerciseId,
        Object.freeze({
          exerciseId,
          chapterId: chapter.id,
          chapterDirectory: chapter.directory,
          filename,
          relativePath: `${chapter.directory}/${filename}`,
        })
      );
    });
  }
  return manifest;
}

const EXERCISE_MANIFEST = createManifest();

export const EXERCISE_COUNT = EXERCISE_MANIFEST.size;

export function getExerciseFile(exerciseId) {
  return EXERCISE_MANIFEST.get(exerciseId) || null;
}

export function listExerciseFiles() {
  return [...EXERCISE_MANIFEST.values()];
}
