(() => {
  window.EXERCISE_TESTS = window.EXERCISE_TESTS || {};

  Object.assign(window.EXERCISE_TESTS, {
    "py01-first-programs": {
      description: "Create a complete Python script whose only visible effect is one exact greeting. This exercise establishes how string literals, capitalization, punctuation, and print's newline all form part of an output contract.",
      success: [
        "Prints exactly `Hello world!` with matching capitalization and punctuation.",
        "Produces one line and does not request input or add extra text.",
      ],
      visual: "io",
      mode: "script",
      tests: [
        { id: "py01-first-programs-public-exact", name: "Exact greeting", hidden: false, input: [], expectedOutput: "Hello world!\n" },
        { id: "py01-first-programs-public-repeat", name: "Deterministic rerun", hidden: false, input: [], expectedOutput: "Hello world!\n" },
        { id: "py01-first-programs-hidden-basic", name: "Hidden output case", hidden: true, input: [], expectedOutput: "Hello world!\n" },
      ],
    },

    "py01-fixme": {
      description: "Build the greeting by assigning `Hello` to one variable and combining it with the remaining characters in another. The final program should demonstrate string concatenation without changing the exact text shown to the user.",
      success: [
        "Combines string values into `Hello world!`.",
        "Prints the completed greeting once with no prompts or extra output.",
      ],
      visual: "text",
      mode: "script",
      tests: [
        { id: "py01-fixme-public-greeting", name: "Combined greeting", hidden: false, input: [], expectedOutput: "Hello world!\n" },
        { id: "py01-fixme-public-format", name: "Exact spacing", hidden: false, input: [], expectedOutput: "Hello world!\n" },
        { id: "py01-fixme-hidden-basic", name: "Hidden output case", hidden: true, input: [], expectedOutput: "Hello world!\n" },
      ],
    },

    "py01-diagram": {
      description: "Read two integer inputs and translate the arithmetic diagram into the expression `a - 5 + 2 * b`. Preserve the intended operation order so positive, zero, and negative values all follow the same rule.",
      success: [
        "Consumes exactly two integer inputs in `a`, then `b`, order.",
        "Prints the integer value of `a - 5 + 2 * b`.",
        "Handles zero and negative operands without special cases.",
      ],
      visual: "math",
      mode: "script",
      tests: [
        { id: "py01-diagram-public-positive", name: "Positive operands", hidden: false, input: ["10", "3"], expectedOutput: "11\n" },
        { id: "py01-diagram-public-zero", name: "Zero operands", hidden: false, input: ["0", "0"], expectedOutput: "-5\n" },
        { id: "py01-diagram-hidden-signed", name: "Hidden signed case", hidden: true, input: ["-4", "-3"], expectedOutput: "-15\n" },
      ],
    },

    "py01-avoid-sums": {
      description: "Compute the mathematical sum of two integers without using binary addition. Reframe addition as subtracting the negation of the second operand, then verify that the identity also works for signed values.",
      success: [
        "Reads two integers and prints their mathematical sum.",
        "Uses subtraction and unary negation instead of the binary `+` operator.",
        "Returns the correct result for mixed and negative signs.",
      ],
      visual: "math",
      mode: "script",
      tests: [
        { id: "py01-avoid-sums-public-positive", name: "Two positive integers", hidden: false, input: ["7", "5"], expectedOutput: "12\n" },
        { id: "py01-avoid-sums-public-mixed", name: "Mixed signs", hidden: false, input: ["9", "-4"], expectedOutput: "5\n" },
        { id: "py01-avoid-sums-hidden-negative", name: "Hidden signed case", hidden: true, input: ["-8", "-6"], expectedOutput: "-14\n" },
      ],
    },

    "py01-uncensor": {
      description: "Read two integers, add them first, and multiply that total by the named constant 10. Parentheses should make the intended grouping explicit and keep the calculation correct for signed inputs.",
      success: [
        "Reads two integer values in order.",
        "Prints exactly `10 * (a + b)` as an integer.",
        "Keeps 10 as the fixed multiplier for every input pair.",
      ],
      visual: "math",
      mode: "script",
      tests: [
        { id: "py01-uncensor-public-positive", name: "Positive total", hidden: false, input: ["2", "3"], expectedOutput: "50\n" },
        { id: "py01-uncensor-public-cancel", name: "Operands cancel", hidden: false, input: ["7", "-7"], expectedOutput: "0\n" },
        { id: "py01-uncensor-hidden-negative", name: "Hidden signed case", hidden: true, input: ["-4", "-6"], expectedOutput: "-100\n" },
      ],
    },

    "py01-travelling": {
      description: "Convert the supplied hours and minutes into one elapsed time measured in hours, then divide 313 kilometres by that duration. Round the resulting average speed to the nearest whole kilometre per hour before printing it.",
      success: [
        "Converts minutes using `minutes / 60` before adding them to hours.",
        "Computes average speed as 313 divided by total hours.",
        "Prints one rounded integer with no explanatory label.",
      ],
      visual: "math",
      mode: "script",
      tests: [
        { id: "py01-travelling-public-hours", name: "Whole-hour journey", hidden: false, input: ["3", "0"], expectedOutput: "104\n" },
        { id: "py01-travelling-public-minutes", name: "Hours and minutes", hidden: false, input: ["2", "30"], expectedOutput: "125\n" },
        { id: "py01-travelling-hidden-short", name: "Hidden boundary case", hidden: true, input: ["0", "30"], expectedOutput: "626\n" },
      ],
    },

    "py02-circle-area": {
      description: "Calculate a circle's area from a numeric radius using the exercise constant `pi = 3.14159`. Round only the final area to two decimal places so intermediate precision is not lost.",
      success: [
        "Accepts integer or decimal radius input.",
        "Uses `3.14159 * radius ** 2` for the area.",
        "Prints the result rounded to at most two decimal places.",
      ],
      visual: "math",
      mode: "script",
      tests: [
        { id: "py02-circle-area-public-integer", name: "Integer radius", hidden: false, input: ["2"], expectedOutput: "12.57\n" },
        { id: "py02-circle-area-public-zero", name: "Zero radius", hidden: false, input: ["0"], expectedOutput: "0.0\n" },
        { id: "py02-circle-area-hidden-decimal", name: "Hidden decimal case", hidden: true, input: ["1.5"], expectedOutput: "7.07\n" },
      ],
    },

    "py02-hypotenuse": {
      description: "Treat the input as the common leg length of a right isosceles triangle. Apply the Pythagorean theorem and round `sqrt(2 * n ** 2)` to two decimal places.",
      success: [
        "Reads one whole-number leg length.",
        "Calculates the hypotenuse from both equal legs.",
        "Prints the rounded numeric result without a label.",
      ],
      visual: "math",
      mode: "script",
      tests: [
        { id: "py02-hypotenuse-public-three", name: "Three-unit legs", hidden: false, input: ["3"], expectedOutput: "4.24\n" },
        { id: "py02-hypotenuse-public-zero", name: "Zero-length boundary", hidden: false, input: ["0"], expectedOutput: "0.0\n" },
        { id: "py02-hypotenuse-hidden-five", name: "Hidden numeric case", hidden: true, input: ["5"], expectedOutput: "7.07\n" },
      ],
    },

    "py02-means": {
      description: "Read three integers and compute their arithmetic mean by dividing their sum by three. Round the final value to two decimal places while allowing fractional and negative results.",
      success: [
        "Consumes exactly three integer inputs.",
        "Divides the complete sum by 3 rather than rounding individual terms.",
        "Prints a result rounded to at most two decimal places.",
      ],
      visual: "math",
      mode: "script",
      tests: [
        { id: "py02-means-public-whole", name: "Whole-number mean", hidden: false, input: ["2", "4", "6"], expectedOutput: "4.0\n" },
        { id: "py02-means-public-fraction", name: "Fractional mean", hidden: false, input: ["1", "2", "2"], expectedOutput: "1.67\n" },
        { id: "py02-means-hidden-signed", name: "Hidden signed case", hidden: true, input: ["-3", "0", "3"], expectedOutput: "0.0\n" },
      ],
    },

    "py02-trip-cost": {
      description: "Convert distance into units of 100 kilometres, then multiply by fuel consumption and price per litre. Round the total monetary cost to two decimal places and print only that numeric value.",
      success: [
        "Uses `distance / 100 * litres_per_100km * price_per_litre`.",
        "Accepts decimal values for consumption and price.",
        "Prints the final cost rounded to cents.",
      ],
      visual: "math",
      mode: "script",
      tests: [
        { id: "py02-trip-cost-public-unit", name: "One hundred kilometres", hidden: false, input: ["100", "5", "2"], expectedOutput: "10.0\n" },
        { id: "py02-trip-cost-public-distance", name: "Longer decimal-cost trip", hidden: false, input: ["300", "7.5", "1.8"], expectedOutput: "40.5\n" },
        { id: "py02-trip-cost-hidden-zero", name: "Hidden boundary case", hidden: true, input: ["0", "6.2", "1.75"], expectedOutput: "0.0\n" },
      ],
    },

    "py02-repetitions": {
      description: "Repeat the supplied text exactly `n` times on one line and place one hyphen only between neighbouring copies. Treat zero repetitions as an empty line rather than printing the text once.",
      success: [
        "Preserves the input text exactly in every copy.",
        "Uses single hyphens between copies with no leading or trailing hyphen.",
        "Prints an empty line when `n` is zero.",
      ],
      visual: "text",
      mode: "script",
      tests: [
        { id: "py02-repetitions-public-three", name: "Three repetitions", hidden: false, input: ["go", "3"], expectedOutput: "go-go-go\n" },
        { id: "py02-repetitions-public-one", name: "Single repetition", hidden: false, input: ["hello world", "1"], expectedOutput: "hello world\n" },
        { id: "py02-repetitions-hidden-zero", name: "Hidden boundary case", hidden: true, input: ["unused", "0"], expectedOutput: "\n" },
      ],
    },

    "py02-easy-change": {
      description: "Subtract the price from the received amount and decompose the change greedily into 50, 20, 10, and 5-value notes. Print the four note counts from largest denomination to smallest, including zeros where a note is not used.",
      success: [
        "Computes non-negative change as `received - price`.",
        "Uses as many larger notes as possible before smaller notes.",
        "Prints four integer counts separated by single spaces.",
      ],
      visual: "sequence",
      mode: "script",
      tests: [
        { id: "py02-easy-change-public-mixed", name: "Mixed denominations", hidden: false, input: ["35", "170"], expectedOutput: "2 1 1 1\n" },
        { id: "py02-easy-change-public-none", name: "Exact payment", hidden: false, input: ["80", "80"], expectedOutput: "0 0 0 0\n" },
        { id: "py02-easy-change-hidden-notes", name: "Hidden denomination case", hidden: true, input: ["15", "100"], expectedOutput: "1 1 1 1\n" },
      ],
    },

    "py02-alarm-clock": {
      description: "Add exactly 6 hours and 51 minutes to a valid 24-hour clock time. Wrap across midnight when necessary and always format the answer as zero-padded `HH:MM`.",
      success: [
        "Adds both the hour and minute offsets to the supplied time.",
        "Wraps results at 24 hours.",
        "Prints two digits for both hour and minute.",
      ],
      visual: "sequence",
      mode: "script",
      tests: [
        { id: "py02-alarm-clock-public-daytime", name: "Same-day result", hidden: false, input: ["10", "0"], expectedOutput: "16:51\n" },
        { id: "py02-alarm-clock-public-midnight", name: "Crosses midnight", hidden: false, input: ["20", "30"], expectedOutput: "03:21\n" },
        { id: "py02-alarm-clock-hidden-late", name: "Hidden boundary case", hidden: true, input: ["23", "59"], expectedOutput: "06:50\n" },
      ],
    },

    "py02-quadratic-formula": {
      description: "Use the quadratic formula to compute both real roots for non-zero `a` and a non-negative discriminant. Round each root to two decimal places and report the plus-square-root result before the minus-square-root result.",
      success: [
        "Calculates the discriminant as `b ** 2 - 4 * a * c`.",
        "Divides both complete numerators by `2 * a`.",
        "Prints `The solutions are r1 and r2` with both rounded roots.",
      ],
      visual: "math",
      mode: "script",
      tests: [
        { id: "py02-quadratic-public-positive", name: "Two positive roots", hidden: false, input: ["1", "-3", "2"], expectedOutput: "The solutions are 2.0 and 1.0\n" },
        { id: "py02-quadratic-public-negative", name: "Two negative roots", hidden: false, input: ["1", "5", "6"], expectedOutput: "The solutions are -2.0 and -3.0\n" },
        { id: "py02-quadratic-hidden-repeat", name: "Hidden boundary case", hidden: true, input: ["1", "2", "1"], expectedOutput: "The solutions are -1.0 and -1.0\n" },
      ],
    },

    "py02-weird-sum": {
      description: "Compute `a + b`, then choose a result from the sum's parity without writing an explicit `if` statement. Even sums produce twice the sum, while odd sums produce the sum plus `a * b`.",
      success: [
        "Classifies parity from `(a + b) % 2`.",
        "Prints `2 * (a + b)` for an even sum.",
        "Prints `a + b + a * b` for an odd sum, including signed inputs.",
      ],
      visual: "math",
      mode: "script",
      tests: [
        { id: "py02-weird-sum-public-even", name: "Even sum branch", hidden: false, input: ["2", "4"], expectedOutput: "12\n" },
        { id: "py02-weird-sum-public-odd", name: "Odd sum branch", hidden: false, input: ["2", "3"], expectedOutput: "11\n" },
        { id: "py02-weird-sum-hidden-signed", name: "Hidden signed case", hidden: true, input: ["-2", "1"], expectedOutput: "-3\n" },
      ],
    },

    "py02-multiples": {
      description: "Inspect every integer from zero through `n`, including the upper bound, and accumulate values divisible by 3 or 5. Count a value such as 15 only once even though it is divisible by both numbers.",
      success: [
        "Includes `n` itself when it is a qualifying multiple.",
        "Adds numbers satisfying either divisibility rule exactly once.",
        "Prints zero when the interval contains no positive qualifying values.",
      ],
      visual: "loop",
      mode: "script",
      tests: [
        { id: "py02-multiples-public-five", name: "Includes upper bound", hidden: false, input: ["5"], expectedOutput: "8\n" },
        { id: "py02-multiples-public-ten", name: "Several multiples", hidden: false, input: ["10"], expectedOutput: "33\n" },
        { id: "py02-multiples-hidden-small", name: "Hidden boundary case", hidden: true, input: ["2"], expectedOutput: "0\n" },
      ],
    },

    "py03-who-needs-for": {
      description: "Generate the arithmetic sequence beginning at 4 and increasing by 3 with a `while` loop. Print every term below 50 on its own line, making 49 the final value.",
      success: [
        "Starts at 4 and increments by exactly 3.",
        "Prints one number per line in ascending order.",
        "Stops after 49 without printing 52 or looping forever.",
      ],
      visual: "loop",
      mode: "script",
      tests: [
        { id: "py03-who-needs-for-public-sequence", name: "Complete sequence", hidden: false, input: [], expectedOutput: "4\n7\n10\n13\n16\n19\n22\n25\n28\n31\n34\n37\n40\n43\n46\n49\n" },
        { id: "py03-who-needs-for-public-repeat", name: "Deterministic rerun", hidden: false, input: [], expectedOutput: "4\n7\n10\n13\n16\n19\n22\n25\n28\n31\n34\n37\n40\n43\n46\n49\n" },
        { id: "py03-who-needs-for-hidden-basic", name: "Hidden output case", hidden: true, input: [], expectedOutput: "4\n7\n10\n13\n16\n19\n22\n25\n28\n31\n34\n37\n40\n43\n46\n49\n" },
      ],
    },

    "py03-divisors": {
      description: "Find every positive divisor of `n`, including 1 and `n`, and add those divisors together. The loop may stop after `n // 2` because no other proper divisor can be larger.",
      success: [
        "Tests divisibility using a zero remainder.",
        "Includes both proper divisors and `n` exactly once.",
        "Returns 1 for the boundary input `n = 1`.",
      ],
      visual: "loop",
      mode: "script",
      tests: [
        { id: "py03-divisors-public-composite", name: "Composite number", hidden: false, input: ["6"], expectedOutput: "12\n" },
        { id: "py03-divisors-public-one", name: "Smallest positive input", hidden: false, input: ["1"], expectedOutput: "1\n" },
        { id: "py03-divisors-hidden-prime", name: "Hidden boundary case", hidden: true, input: ["13"], expectedOutput: "14\n" },
      ],
    },

    "py03-octal-to-decimal": {
      description: "Interpret a string of octal digits by multiplying each digit by its positional power of eight. Reject the whole input with `Not a valid number.` when any digit is 8 or 9, without using Python's base-conversion shortcut.",
      success: [
        "Computes valid octal place values from right to left or by accumulation.",
        "Accepts zero and leading zeroes.",
        "Prints the exact validation message if an 8 or 9 appears.",
      ],
      visual: "math",
      mode: "script",
      tests: [
        { id: "py03-octal-public-standard", name: "Valid octal value", hidden: false, input: ["17"], expectedOutput: "15\n" },
        { id: "py03-octal-public-leading-zero", name: "Leading zeroes", hidden: false, input: ["0007"], expectedOutput: "7\n" },
        { id: "py03-octal-hidden-invalid", name: "Hidden validation case", hidden: true, input: ["128"], expectedOutput: "Not a valid number.\n" },
      ],
    },

    "py03-looping-numbers": {
      description: "Check each adjacent pair of digits and require a step of one forward, including the wrap from 9 to 0, or one backward. Classify the entire string as looping only when every pair satisfies one of those movements.",
      success: [
        "Checks every adjacent pair rather than only the first transition.",
        "Recognizes the forward wrap from 9 to 0.",
        "Prints exactly one of the two required classification messages.",
      ],
      visual: "sequence",
      mode: "script",
      tests: [
        { id: "py03-looping-public-wrap", name: "Forward sequence with wrap", hidden: false, input: ["78901"], expectedOutput: "Looping number\n" },
        { id: "py03-looping-public-invalid", name: "Broken sequence", hidden: false, input: ["135"], expectedOutput: "Not a looping number\n" },
        { id: "py03-looping-hidden-backward", name: "Hidden direction case", hidden: true, input: ["543210"], expectedOutput: "Looping number\n" },
      ],
    },

    "py03-printing-pattern": {
      description: "Print `n` descending rows, starting with the numbers from `n` down to 1 and removing the first number on each next row. Separate values with one space and avoid trailing spaces so the textual pattern has a precise shape.",
      success: [
        "Produces exactly `n` output rows.",
        "Counts down to 1 on every row and starts each row one lower.",
        "Uses single internal spaces with no trailing whitespace.",
      ],
      visual: "loop",
      mode: "script",
      tests: [
        { id: "py03-pattern-public-three", name: "Three-row pattern", hidden: false, input: ["3"], expectedOutput: "3 2 1\n2 1\n1\n" },
        { id: "py03-pattern-public-one", name: "Single-row boundary", hidden: false, input: ["1"], expectedOutput: "1\n" },
        { id: "py03-pattern-hidden-four", name: "Hidden size case", hidden: true, input: ["4"], expectedOutput: "4 3 2 1\n3 2 1\n2 1\n1\n" },
      ],
    },

    "py03-prime-numbers": {
      description: "Identify prime numbers in the inclusive interval from `lower` to `upper`, remembering that primes are integers greater than 1 with exactly two positive divisors. Keep the required heading and append each discovered prime in ascending order separated by one space.",
      success: [
        "Includes both interval endpoints when they are prime.",
        "Excludes 0, 1, and every composite number.",
        "Prints `Prime numbers between lower and upper are:` followed by ordered primes.",
      ],
      visual: "loop",
      mode: "script",
      tests: [
        { id: "py03-primes-public-range", name: "Mixed interval", hidden: false, input: ["2", "10"], expectedOutput: "Prime numbers between 2 and 10 are: 2 3 5 7" },
        { id: "py03-primes-public-empty", name: "Interval with no primes", hidden: false, input: ["14", "16"], expectedOutput: "Prime numbers between 14 and 16 are:" },
        { id: "py03-primes-hidden-low", name: "Hidden boundary case", hidden: true, input: ["0", "3"], expectedOutput: "Prime numbers between 0 and 3 are: 2 3" },
      ],
    },

    "py03-combinations": {
      description: "Implement `factorial(n)` with iterative multiplication and use it to define the binomial coefficient function `C(n, r)`. The functions should return integers for valid inputs where `0 <= r <= n`, including zero-factorial and edge selections.",
      success: [
        "Returns 1 from `factorial(0)` and the correct product for positive integers.",
        "Computes `C(n, r)` from three factorial values.",
        "Returns an integer for edge cases `r = 0` and `r = n`.",
      ],
      visual: "function",
      mode: "function",
      tests: [
        { id: "py03-combinations-public-factorial", name: "Positive factorial", hidden: false, call: "factorial(5)", expected: "120" },
        { id: "py03-combinations-public-zero", name: "Zero factorial", hidden: false, call: "factorial(0)", expected: "1" },
        { id: "py03-combinations-public-choice", name: "Choose two from five", hidden: false, call: "C(5, 2)", expected: "10" },
        { id: "py03-combinations-hidden-edge", name: "Hidden boundary case", hidden: true, call: "C(10, 10)", expected: "1" },
      ],
    },

    "py03-flow-diagram": {
      description: "Translate the subtraction-based Euclidean flow diagram into a program that finds the greatest common divisor of two positive integers. Repeatedly reduce the larger working value until the common remainder reaches zero, regardless of input order.",
      success: [
        "Accepts two positive integer inputs in either order.",
        "Uses repeated subtraction to reduce the pair while preserving the gcd.",
        "Prints the positive greatest common divisor once.",
      ],
      visual: "loop",
      mode: "script",
      tests: [
        { id: "py03-flow-diagram-public-standard", name: "Common divisor", hidden: false, input: ["48", "18"], expectedOutput: "6\n" },
        { id: "py03-flow-diagram-public-reversed", name: "Reversed input order", hidden: false, input: ["18", "48"], expectedOutput: "6\n" },
        { id: "py03-flow-diagram-hidden-equal", name: "Hidden boundary case", hidden: true, input: ["7", "7"], expectedOutput: "7\n" },
      ],
    },

    "py03-grading-fp": {
      description: "Validate that all four component grades lie in the inclusive range from 0 through 100 before applying any grading rule. Print `RFF` when PE or TE is below 40; otherwise print the rounded weighted result `(LE + RE + 13*PE + 5*TE) / 100`.",
      success: [
        "Prints `Input error` when any grade is below 0 or above 100.",
        "Applies the PE/TE fail rule only after successful validation.",
        "Rounds and prints the weighted final grade for eligible inputs.",
      ],
      visual: "mapping",
      mode: "script",
      tests: [
        { id: "py03-grading-public-result", name: "Weighted final grade", hidden: false, input: ["50", "60", "70", "80"], expectedOutput: "14\n" },
        { id: "py03-grading-public-rff", name: "Fundamental fail rule", hidden: false, input: ["80", "80", "39", "90"], expectedOutput: "RFF\n" },
        { id: "py03-grading-public-high", name: "Grade above range", hidden: false, input: ["101", "50", "70", "70"], expectedOutput: "Input error\n" },
        { id: "py03-grading-hidden-low", name: "Hidden validation case", hidden: true, input: ["-1", "50", "70", "70"], expectedOutput: "Input error\n" },
      ],
    },

    "py03-pi": {
      description: "Evaluate terms zero through 50 of Ramanujan's rapidly converging series for the reciprocal of pi. Invert the accumulated reciprocal and print pi rounded to exactly the exercise's eight-decimal numeric value.",
      success: [
        "Includes both endpoints of the 0-to-50 term range.",
        "Applies the series scale factor before taking the reciprocal.",
        "Prints `3.14159265` with no prompts or labels.",
      ],
      visual: "loop",
      mode: "script",
      tests: [
        { id: "py03-pi-public-value", name: "Eight-decimal approximation", hidden: false, input: [], expectedOutput: "3.14159265\n" },
        { id: "py03-pi-public-repeat", name: "Deterministic rerun", hidden: false, input: [], expectedOutput: "3.14159265\n" },
        { id: "py03-pi-hidden-basic", name: "Hidden output case", hidden: true, input: [], expectedOutput: "3.14159265\n" },
      ],
    },
  });
})();
