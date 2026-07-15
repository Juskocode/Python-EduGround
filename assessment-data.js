(() => {
  "use strict";

  const theoryQuestion = (id, prompt, options, correct, explanation, code) => {
    const question = { id, prompt, options, correct, explanation };
    if (code) question.code = code;
    return question;
  };

  const testCase = (id, name, call, expected, hidden = false) => ({
    id,
    name,
    call,
    expected,
    hidden,
  });

  window.ASSESSMENT_DATA = {
    version: 1,
    passingScore: 60,
    theoryDurationMinutes: 20,
    practicalDurationMinutes: 60,
    blocks: [
      {
        id: "py01-py03",
        number: 1,
        revision: 1,
        title: "Core Python Control Flow",
        chapters: ["py01", "py02", "py03"],
        sourceNote: "Practical prompts are independently paraphrased from PE01 (17 October 2019), supplied by the user. Reference solutions are intentionally excluded.",
        references: [
          {
            label: "Built-in input()",
            description: "How Python reads a line of user input as text.",
            url: "https://docs.python.org/3/library/functions.html#input",
          },
          {
            label: "Numeric types",
            description: "Integer and floating-point operations, conversions, and comparisons.",
            url: "https://docs.python.org/3/library/stdtypes.html#numeric-types-int-float-complex",
          },
          {
            label: "Arithmetic expressions",
            description: "Operator precedence and the semantics of division, remainder, and powers.",
            url: "https://docs.python.org/3/reference/expressions.html#binary-arithmetic-operations",
          },
          {
            label: "Control-flow tools",
            description: "Official tutorial for conditions, loops, range, break, and continue.",
            url: "https://docs.python.org/3/tutorial/controlflow.html",
          },
          {
            label: "Built-in round()",
            description: "Precision, return types, and tie behavior for Python rounding.",
            url: "https://docs.python.org/3/library/functions.html#round",
          },
        ],
        theory: {
          durationSeconds: 1200,
          passPercent: 60,
          questions: [
            theoryQuestion(
              "a1-theory-01",
              "Which statements about reading and converting console input are correct? Select every correct answer.",
              [
                "input() returns a string after removing the trailing newline.",
                "input() automatically detects whether the user entered an int or float.",
                "int(text) can raise ValueError when text is not a valid integer literal.",
                "float(text) always produces an exact decimal representation.",
              ],
              [0, 2],
              "Console input arrives as text. Convert it explicitly, and be prepared for invalid text; binary floating-point values are not exact representations of every decimal fraction."
            ),
            theoryQuestion(
              "a1-theory-02",
              "What does this program print?",
              ["123", "15", "12 + 3", "A TypeError"],
              [1],
              "int converts the text to the integer 12 before numeric addition, so the result is 15.",
              "value = int(\"12\")\nprint(value + 3)"
            ),
            theoryQuestion(
              "a1-theory-03",
              "For positive integers a and b, what does a % b represent?",
              [
                "The integer quotient of a divided by b",
                "The remainder after dividing a by b",
                "a raised to the power b",
                "The decimal part of a / b",
              ],
              [1],
              "The remainder operator is useful for extracting digits, testing divisibility, and wrapping values into a fixed range."
            ),
            theoryQuestion(
              "a1-theory-04",
              "Which observations about this output are correct? Select every correct answer.",
              [
                "It prints 1 7.",
                "It prints 1.7.",
                "Both displayed values are integers.",
                "The remainder expression removes the final digit from n.",
              ],
              [0, 2],
              "Floor division by 10 removes the last decimal digit, while remainder by 10 extracts it. Both operations return integers here.",
              "n = 17\nprint(n // 10, n % 10)"
            ),
            theoryQuestion(
              "a1-theory-05",
              "Why is the order of if/elif conditions important?",
              [
                "Python evaluates every branch and combines their results.",
                "Only the first true branch in the chain runs.",
                "elif conditions run before the opening if condition.",
                "An else branch is required after every elif.",
              ],
              [1],
              "An if/elif/else chain stops at the first true branch, so put higher-priority or more specific checks before broader ones."
            ),
            theoryQuestion(
              "a1-theory-06",
              "Which statements about range(2, 8, 2) are correct? Select every correct answer.",
              [
                "It produces 2, 4, and 6 during iteration.",
                "The stop value 8 is excluded.",
                "Its step is 1 because that is the default.",
                "It can be used directly in a for loop without first making a list.",
              ],
              [0, 1, 3],
              "range uses an inclusive start, exclusive stop, and the supplied step. It is itself iterable, so list conversion is optional."
            ),
            theoryQuestion(
              "a1-theory-07",
              "What value is printed?",
              ["3", "6", "7", "A NameError"],
              [1],
              "The accumulator starts at zero and receives 1, then 2, then 3, producing 6.",
              "total = 0\nfor value in range(1, 4):\n    total += value\nprint(total)"
            ),
            theoryQuestion(
              "a1-theory-08",
              "What is the main job of a loop invariant when reasoning about a loop?",
              [
                "It describes a fact that remains true before and after each iteration.",
                "It forces the loop to execute exactly once.",
                "It replaces the need for a stopping condition.",
                "It converts a while loop into a function automatically.",
              ],
              [0],
              "An invariant connects the processed and unprocessed state and helps justify that the final result is correct."
            ),
            theoryQuestion(
              "a1-theory-09",
              "What sequence is printed?",
              ["3 2 1", "3 2 1 0", "2 1 0", "The loop never ends"],
              [0],
              "The body prints before subtracting one. When n becomes zero, the condition is false and zero is not printed.",
              "n = 3\nwhile n > 0:\n    print(n, end=\" \" )\n    n -= 1"
            ),
            theoryQuestion(
              "a1-theory-10",
              "Which practices help a while loop terminate predictably? Select every correct answer.",
              [
                "Define a condition that eventually becomes false.",
                "Update the state used by that condition on every relevant path.",
                "Use continue before every state update.",
                "Identify a quantity that moves toward a finite boundary.",
              ],
              [0, 1, 3],
              "A terminating loop needs measurable progress toward its stopping state. A premature continue can accidentally skip that progress."
            ),
            theoryQuestion(
              "a1-theory-11",
              "What is the difference between / and // for positive integers?",
              [
                "/ returns true division, while // returns the floored quotient.",
                "/ extracts a remainder, while // raises to a power.",
                "They always return the same value and type.",
                "// is only valid for strings.",
              ],
              [0],
              "True division produces a floating-point result. Floor division returns the quotient rounded down, which is useful for digit processing."
            ),
            theoryQuestion(
              "a1-theory-12",
              "Why does this code avoid a ZeroDivisionError?",
              [
                "Python silently changes 10 / x into zero.",
                "The and expression short-circuits after the false value of x.",
                "The comparison catches every exception.",
                "Division by zero is allowed inside an if statement.",
              ],
              [1],
              "and evaluates from left to right and stops after a false operand, so 10 / x is never evaluated.",
              "x = 0\nif x and 10 / x > 1:\n    print(\"large\")\nelse:\n    print(\"safe\")"
            ),
            theoryQuestion(
              "a1-theory-13",
              "Which statements about Python numeric values are correct? Select every correct answer.",
              [
                "bool is a subclass of int, although booleans should normally express truth values.",
                "Adding an int to a float normally produces a float.",
                "Every decimal fraction has an exact binary float representation.",
                "Exponentiation uses the ** operator.",
              ],
              [0, 1, 3],
              "Python interoperates between integer and floating-point values, but binary floats approximate many decimals. The power operator is **."
            ),
            theoryQuestion(
              "a1-theory-14",
              "How many hash characters are printed?",
              ["2", "3", "6", "9"],
              [2],
              "The outer loop runs three times and the inner loop twice for each outer iteration: 3 × 2 = 6.",
              "for row in range(3):\n    for column in range(2):\n        print(\"#\", end=\"\")"
            ),
            theoryQuestion(
              "a1-theory-15",
              "Which calls change how print separates or terminates values? Select every correct answer.",
              [
                "print(1, 2, sep=\"-\")",
                "print(\"ready\", end=\"\")",
                "print(\"x\".upper())",
                "print(str(5))",
              ],
              [0, 1],
              "sep controls text placed between multiple arguments, while end controls what follows the last argument. The other calls transform values before printing."
            ),
          ],
        },
        practical: {
          durationSeconds: 3600,
          passPercent: 60,
          questions: [
            {
              id: "a1-practical-01",
              title: "Reverse an integer arithmetically",
              points: 20,
              prompt: "Implement a function that reverses the decimal digits of a non-negative integer and returns the resulting integer.",
              contract: [
                "Define reverse_integer(num).",
                "Return an int whose digits appear in reverse order.",
                "Return 0 when num is 0.",
              ],
              constraints: [
                "Do not convert the number to str, bytes, a list, or another sequence.",
                "Use arithmetic digit extraction.",
                "Inputs are non-negative integers.",
              ],
              examples: [
                { call: "reverse_integer(766)", expected: "667" },
                { call: "reverse_integer(45654)", expected: "45654" },
              ],
              starterCode: "def reverse_integer(num):\n    # Build the reversed value one decimal digit at a time.\n    pass\n",
              mode: "function",
              tests: [
                testCase("a1-p1-visible-standard", "Several distinct digits", "reverse_integer(789)", "987"),
                testCase("a1-p1-visible-zero", "Zero", "reverse_integer(0)", "0"),
                testCase("a1-p1-hidden-trailing", "Trailing zeros", "reverse_integer(1200)", "21", true),
              ],
            },
            {
              id: "a1-practical-02",
              title: "Filter and square decimal digits",
              points: 20,
              prompt: "Return the sum of the squares of every decimal digit in num that is strictly greater than the one-digit threshold d.",
              contract: [
                "Define sum_large_digit_squares(d, num).",
                "Inspect each decimal digit independently.",
                "Return an int accumulator; return 0 when no digit qualifies.",
              ],
              constraints: [
                "d is an integer from 0 through 9.",
                "num is a non-negative integer.",
                "Do not convert num to a string or sequence.",
              ],
              examples: [
                { call: "sum_large_digit_squares(2, 135)", expected: "34" },
                { call: "sum_large_digit_squares(5, 135)", expected: "0" },
              ],
              starterCode: "def sum_large_digit_squares(d, num):\n    # Examine num with integer arithmetic and accumulate qualifying squares.\n    pass\n",
              mode: "function",
              tests: [
                testCase("a1-p2-visible-mixed", "Some digits qualify", "sum_large_digit_squares(3, 135)", "25"),
                testCase("a1-p2-visible-none", "No digits qualify", "sum_large_digit_squares(9, 9870)", "0"),
                testCase("a1-p2-hidden-repeat", "Repeated qualifying digits", "sum_large_digit_squares(4, 50556)", "111", true),
              ],
            },
            {
              id: "a1-practical-03",
              title: "Build a number triangle",
              points: 20,
              prompt: "Construct the text for a number triangle with rows 1 through n - 1. Row i contains the decimal digit i repeated i times.",
              contract: [
                "Define number_triangle(n).",
                "Return one string with newline characters between rows and no trailing newline.",
                "Return an empty string when n is 1.",
              ],
              constraints: [
                "n is an integer from 1 through 9.",
                "Keep the rows in ascending order.",
              ],
              examples: [
                { call: "number_triangle(3)", expected: "'1\\n22'" },
                { call: "number_triangle(4)", expected: "'1\\n22\\n333'" },
              ],
              starterCode: "def number_triangle(n):\n    # Create each row, then combine the rows with newline characters.\n    pass\n",
              mode: "function",
              tests: [
                testCase("a1-p3-visible-empty", "Minimum height", "number_triangle(1)", "''"),
                testCase("a1-p3-visible-three", "Three rows", "number_triangle(4)", "'1\\n22\\n333'"),
                testCase("a1-p3-hidden-five", "Five rows", "number_triangle(6)", "'1\\n22\\n333\\n4444\\n55555'", true),
              ],
            },
            {
              id: "a1-practical-04",
              title: "Evaluate a triathlon result",
              points: 20,
              prompt: "Evaluate a three-stage triathlon. A valid performance finishes 1.5 km swimming, 40 km cycling, and 10 km running in no more than four total hours while meeting each minimum speed.",
              contract: [
                "Define triathlon_result(t_s, t_c, t_r).",
                "Return the total time as a float when every requirement passes.",
                "Otherwise return the first applicable string in this priority: Time, Swimming, Cycling, Running.",
              ],
              constraints: [
                "All three inputs are positive hour values.",
                "Minimum speeds are 2 km/h swimming, 20 km/h cycling, and 8 km/h running.",
                "Exactly four hours and exactly the minimum speed both pass.",
              ],
              examples: [
                { call: "triathlon_result(0.4, 1.2, 0.4)", expected: "2.0" },
                { call: "triathlon_result(1.0, 1.0, 4.0)", expected: "'Time'" },
              ],
              starterCode: "def triathlon_result(t_s, t_c, t_r):\n    # Check the total-time rule before stage speeds, in the stated priority.\n    pass\n",
              mode: "function",
              tests: [
                testCase("a1-p4-visible-boundaries", "Exact time and speed boundaries qualify", "triathlon_result(0.75, 2.0, 1.25)", "4.0"),
                testCase("a1-p4-visible-run", "Running speed failure", "triathlon_result(0.5, 1.0, 2.2)", "'Running'"),
                testCase(
                  "a1-p4-hidden-branches",
                  "Stage failures and total-time priority",
                  "(triathlon_result(0.8, 1.0, 1.0), triathlon_result(0.5, 2.1, 1.0), triathlon_result(1.0, 3.0, 1.0))",
                  "('Swimming', 'Cycling', 'Time')",
                  true
                ),
              ],
            },
            {
              id: "a1-practical-05",
              title: "Convert quaternary digits",
              points: 20,
              prompt: "Convert the base-4 numeral encoded by the decimal digits of quat into its base-10 integer value.",
              contract: [
                "Define quaternary_to_decimal(quat).",
                "Return the corresponding base-10 int.",
                "Return 0 for quat equal to 0.",
              ],
              constraints: [
                "quat is a non-negative integer whose digits are only 0, 1, 2, or 3.",
                "Process the place values without calling int with a base argument.",
              ],
              examples: [
                { call: "quaternary_to_decimal(123)", expected: "27" },
                { call: "quaternary_to_decimal(112233)", expected: "1455" },
              ],
              starterCode: "def quaternary_to_decimal(quat):\n    # Accumulate each base-4 digit at its positional value.\n    pass\n",
              mode: "function",
              tests: [
                testCase("a1-p5-visible-small", "Two base-four digits", "quaternary_to_decimal(11)", "5"),
                testCase("a1-p5-visible-zero", "Zero", "quaternary_to_decimal(0)", "0"),
                testCase("a1-p5-hidden-place", "Several place values", "quaternary_to_decimal(3021)", "201", true),
              ],
            },
          ],
        },
      },
      {
        id: "py04-py06",
        number: 2,
        revision: 1,
        title: "Functions and Sequences",
        chapters: ["py04", "py05", "py06"],
        sourceNote: "Practical prompts are independently paraphrased from PE02 (7 November 2019), supplied by the user. Reference solutions are intentionally excluded.",
        references: [
          {
            label: "Defining functions",
            description: "Parameters, local names, return values, and function definitions.",
            url: "https://docs.python.org/3/tutorial/controlflow.html#defining-functions",
          },
          {
            label: "Common sequence operations",
            description: "Indexing, slicing, concatenation, membership, and sequence length.",
            url: "https://docs.python.org/3/library/stdtypes.html#common-sequence-operations",
          },
          {
            label: "String methods",
            description: "Official behavior for join, split, replace, casing, and related text tools.",
            url: "https://docs.python.org/3/library/stdtypes.html#string-methods",
          },
          {
            label: "Tuples and sequences",
            description: "Tuple packing, unpacking, and idiomatic sequence use.",
            url: "https://docs.python.org/3/tutorial/datastructures.html#tuples-and-sequences",
          },
          {
            label: "Sorting HOWTO",
            description: "Key functions, compound keys, direction, and stable sorting.",
            url: "https://docs.python.org/3/howto/sorting.html",
          },
        ],
        theory: {
          durationSeconds: 1200,
          passPercent: 60,
          questions: [
            theoryQuestion(
              "a2-theory-01",
              "Which statements about Python functions are correct? Select every correct answer.",
              [
                "A return statement ends the current function call.",
                "A function without an executed return statement returns None.",
                "Local variables are automatically available in every other function.",
                "A function can return a tuple containing several related values.",
              ],
              [0, 1, 3],
              "return exits the current call and supplies a value. Falling off the end returns None, and tuples are a common way to group returned values."
            ),
            theoryQuestion(
              "a2-theory-02",
              "What is printed?",
              ["yth", "ytho", "Pyth", "tho"],
              [1],
              "The start index is included and the stop index is excluded, so positions 1 through 4 form the string ytho, which print displays without quotes.",
              "word = \"Python\"\nprint(word[1:5])"
            ),
            theoryQuestion(
              "a2-theory-03",
              "Which property distinguishes a tuple from a list?",
              [
                "A tuple is immutable after construction.",
                "A tuple cannot contain strings.",
                "A tuple always contains exactly two values.",
                "A tuple cannot be iterated.",
              ],
              [0],
              "Tuple item references cannot be replaced after construction, although a tuple may still contain mutable objects."
            ),
            theoryQuestion(
              "a2-theory-04",
              "Which statements about this code are correct? Select every correct answer.",
              [
                "It prints [3, 1, 2] [1, 2, 3].",
                "sorted changes values in place.",
                "ordered is a new list.",
                "values and ordered refer to the same list object.",
              ],
              [0, 2],
              "sorted returns a new list and leaves the source iterable unchanged. list.sort would mutate a list in place.",
              "values = [3, 1, 2]\nordered = sorted(values)\nprint(values, ordered)"
            ),
            theoryQuestion(
              "a2-theory-05",
              "What happens after b = a when a is a list?",
              [
                "a and b initially refer to the same list object.",
                "Python immediately creates a deep copy for b.",
                "a becomes a tuple.",
                "b can no longer be reassigned.",
              ],
              [0],
              "Assignment binds another name to the same object. Use an explicit copy when later mutations must be independent."
            ),
            theoryQuestion(
              "a2-theory-06",
              "Which statements about zip and reversed are correct? Select every correct answer.",
              [
                "zip pairs items by position from multiple iterables.",
                "zip stops when its shortest input is exhausted.",
                "reversed(seq) necessarily copies seq into a list.",
                "reversed can traverse a suitable sequence without changing it.",
              ],
              [0, 1, 3],
              "zip aligns items lazily and stops at the shortest input. reversed returns a reverse iterator for supported objects without mutating the source."
            ),
            theoryQuestion(
              "a2-theory-07",
              "What value is printed?",
              ["5", "10", "15", "A TypeError"],
              [2],
              "The omitted second argument uses its default value 10, so the function returns 5 + 10.",
              "def add_bonus(score, bonus=10):\n    return score + bonus\n\nprint(add_bonus(5))"
            ),
            theoryQuestion(
              "a2-theory-08",
              "Why are helper functions useful in a larger sequence-processing task?",
              [
                "They give one named responsibility a reusable, testable contract.",
                "They guarantee that no edge cases exist.",
                "They make all variables global.",
                "They remove the need to return results.",
              ],
              [0],
              "A focused helper isolates one rule, making the overall algorithm easier to explain, test, and reuse."
            ),
            theoryQuestion(
              "a2-theory-09",
              "What string is printed?",
              ["Ada: 3", "{name}: {count}", "Ada 3", "A KeyError"],
              [0],
              "An f-string evaluates the expressions inside braces and keeps the surrounding punctuation.",
              "name = \"Ada\"\ncount = 3\nprint(f\"{name}: {count}\")"
            ),
            theoryQuestion(
              "a2-theory-10",
              "Which statements about Python strings are correct? Select every correct answer.",
              [
                "Strings are immutable sequences of Unicode characters.",
                "join combines an iterable of strings using a separator.",
                "Assigning word[0] = 'X' mutates the string in place.",
                "A slice can produce a new substring.",
              ],
              [0, 1, 3],
              "String operations create new values rather than changing characters in place. join and slicing are standard construction tools."
            ),
            theoryQuestion(
              "a2-theory-11",
              "For a leaderboard sorted by best score descending and attempts ascending, which key idea is appropriate?",
              [
                "Use a tuple key that represents both criteria in priority order.",
                "Convert every score to a string before comparing.",
                "Sort only by the student's name.",
                "Use a set because sets preserve ranking order.",
              ],
              [0],
              "A tuple key compares its components left to right, making the ranking priorities explicit. A transformed sign can express descending order."
            ),
            theoryQuestion(
              "a2-theory-12",
              "Which name is printed?",
              ["Ada", "Grace", "Linus", "The list itself"],
              [1],
              "max compares the values returned by the key function, so the record with score 95 wins.",
              "records = [(\"Ada\", 88), (\"Grace\", 95), (\"Linus\", 90)]\nprint(max(records, key=lambda item: item[1])[0])"
            ),
            theoryQuestion(
              "a2-theory-13",
              "Which statements about slicing seq[start:stop:step] are correct? Select every correct answer.",
              [
                "stop is normally excluded.",
                "A negative step can traverse toward lower indexes.",
                "Omitted bounds use defaults appropriate to the step direction.",
                "A step of zero means use every item.",
              ],
              [0, 1, 2],
              "Slices exclude the stop and support positive or negative traversal. A zero step is invalid and raises ValueError."
            ),
            theoryQuestion(
              "a2-theory-14",
              "What does the second line of output contain?",
              ["0 red", "1 blue", "2 blue", "1 red"],
              [1],
              "enumerate starts from the supplied start value. The second item therefore receives index 1.",
              "colors = [\"red\", \"blue\"]\nfor index, color in enumerate(colors):\n    print(index, color)"
            ),
            theoryQuestion(
              "a2-theory-15",
              "Which details belong in a clear function contract? Select every correct answer.",
              [
                "Accepted inputs and preconditions",
                "The returned value and its meaning",
                "Important side effects or mutation",
                "A promise that one exact implementation must be used when no such constraint exists",
              ],
              [0, 1, 2],
              "A contract describes observable behavior: inputs, outputs, and side effects. It should not unnecessarily prescribe an internal solution."
            ),
          ],
        },
        practical: {
          durationSeconds: 3600,
          passPercent: 60,
          questions: [
            {
              id: "a2-practical-01",
              title: "Render aligned records in reverse",
              points: 20,
              prompt: "Combine parallel tuples of names, phone numbers, and email addresses into one line per person, visiting the records in reverse order.",
              contract: [
                "Define iterate_rev(names, numbers, emails).",
                "Return lines formatted exactly as name - number - email.",
                "Separate lines with newline characters and do not add a trailing newline.",
              ],
              constraints: [
                "The three tuples always have equal length.",
                "Names and emails are strings; phone numbers are integers.",
                "Return an empty string for three empty tuples.",
              ],
              examples: [
                { call: "iterate_rev(('Ana', 'Ben'), (111, 222), ('a@x.pt', 'b@x.pt'))", expected: "'Ben - 222 - b@x.pt\\nAna - 111 - a@x.pt'" },
              ],
              starterCode: "def iterate_rev(names, numbers, emails):\n    # Visit matching tuple positions from the end toward the start.\n    pass\n",
              mode: "function",
              tests: [
                testCase("a2-p1-visible-two", "Two records", "iterate_rev(('Ana', 'Ben'), (111, 222), ('a@x.pt', 'b@x.pt'))", "'Ben - 222 - b@x.pt\\nAna - 111 - a@x.pt'"),
                testCase("a2-p1-visible-empty", "No records", "iterate_rev((), (), ())", "''"),
                testCase("a2-p1-hidden-one", "Single record", "iterate_rev(('Cris',), (935001001,), ('c@x.pt',))", "'Cris - 935001001 - c@x.pt'", true),
              ],
            },
            {
              id: "a2-practical-02",
              title: "Form every group of three",
              points: 20,
              prompt: "Return all unique groups of three students that can be selected from the input tuple.",
              contract: [
                "Define groups(students).",
                "Return a tuple whose items are three-name tuples.",
                "Preserve the combination order induced by the original student order.",
              ],
              constraints: [
                "Student names are unique within the input tuple.",
                "Do not return permutations of the same three positions.",
                "Return an empty tuple when fewer than three students are supplied.",
              ],
              examples: [
                { call: "groups(('Ana', 'Ben', 'Cris', 'Diogo'))", expected: "(('Ana', 'Ben', 'Cris'), ('Ana', 'Ben', 'Diogo'), ('Ana', 'Cris', 'Diogo'), ('Ben', 'Cris', 'Diogo'))" },
              ],
              starterCode: "def groups(students):\n    # Select increasing index triples so each group appears exactly once.\n    pass\n",
              mode: "function",
              tests: [
                testCase("a2-p2-visible-four", "Four students", "groups(('A', 'B', 'C', 'D'))", "(('A', 'B', 'C'), ('A', 'B', 'D'), ('A', 'C', 'D'), ('B', 'C', 'D'))"),
                testCase("a2-p2-visible-small", "Too few students", "groups(('A', 'B'))", "()"),
                testCase("a2-p2-hidden-count", "Five-student group count", "len(groups(('A', 'B', 'C', 'D', 'E')))", "10", true),
              ],
            },
            {
              id: "a2-practical-03",
              title: "Order decimal digits",
              points: 20,
              prompt: "Return every decimal digit of a non-negative integer in decreasing order as a tuple of integers.",
              contract: [
                "Define order_digits(n).",
                "Keep repeated digits.",
                "Represent zero as the one-item tuple (0,).",
              ],
              constraints: [
                "n is a non-negative integer.",
                "The result must be a tuple, not a string or list.",
              ],
              examples: [
                { call: "order_digits(9013322)", expected: "(9, 3, 3, 2, 2, 1, 0)" },
              ],
              starterCode: "def order_digits(n):\n    # Collect every digit, including repeats, and return descending order.\n    pass\n",
              mode: "function",
              tests: [
                testCase("a2-p3-visible-mixed", "Repeated digits", "order_digits(9013322)", "(9, 3, 3, 2, 2, 1, 0)"),
                testCase("a2-p3-visible-zero", "Zero", "order_digits(0)", "(0,)"),
                testCase("a2-p3-hidden-zeros", "Several zeros", "order_digits(10004)", "(4, 1, 0, 0, 0)", true),
              ],
            },
            {
              id: "a2-practical-04",
              title: "Rank assessment attempts",
              points: 20,
              prompt: "Sort leaderboard records by their best score, then by efficiency, then alphabetically.",
              contract: [
                "Define sort_leaders(records).",
                "Return a tuple of the original records.",
                "Rank maximum score descending, number of attempts ascending, then name ascending.",
              ],
              constraints: [
                "Each record is (name, scores_tuple).",
                "Every scores tuple is non-empty and contains integers from 0 through 100.",
                "Do not mutate the supplied tuple or its score tuples.",
              ],
              examples: [
                { call: "sort_leaders((('Jo', (80, 90, 100)), ('Ana', (90, 100)), ('Jose', (100,))))", expected: "(('Jose', (100,)), ('Ana', (90, 100)), ('Jo', (80, 90, 100)))" },
              ],
              starterCode: "def sort_leaders(records):\n    # Express all three ranking rules in a deterministic sort key.\n    pass\n",
              mode: "function",
              tests: [
                testCase("a2-p4-visible-priority", "Best score then attempts", "sort_leaders((('Jo', (80, 90, 100)), ('Ana', (90, 100)), ('Jose', (100,))))", "(('Jose', (100,)), ('Ana', (90, 100)), ('Jo', (80, 90, 100)))"),
                testCase("a2-p4-visible-name", "Alphabetical final tie", "sort_leaders((('Rui', (50, 90)), ('Ana', (50, 90))))", "(('Ana', (50, 90)), ('Rui', (50, 90)))"),
                testCase("a2-p4-hidden-score", "Best score outranks attempt count", "sort_leaders((('A', (99,)), ('B', (50, 100, 0))))", "(('B', (50, 100, 0)), ('A', (99,)))", true),
              ],
            },
            {
              id: "a2-practical-05",
              title: "Count balanced growth patterns",
              points: 20,
              prompt: "Count contiguous substrings in which the number of adjacent character increases equals the number of adjacent character decreases.",
              contract: [
                "Define subpatterns(astring).",
                "Consider every contiguous substring of length at least two.",
                "Return exactly: The string '<value>' contains <count> substring patterns.",
              ],
              constraints: [
                "Compare characters using Python's normal lexicographic ordering.",
                "Equal adjacent characters count as neither an increase nor a decrease.",
                "Overlapping substrings are counted independently.",
              ],
              examples: [
                { call: "subpatterns('aghljcb')", expected: "\"The string 'aghljcb' contains 3 substring patterns.\"" },
              ],
              starterCode: "def subpatterns(astring):\n    # Examine each substring of length at least two and count balanced changes.\n    pass\n",
              mode: "function",
              tests: [
                testCase("a2-p5-visible-source", "Mixed changes", "subpatterns('aghljcb')", "\"The string 'aghljcb' contains 3 substring patterns.\""),
                testCase("a2-p5-visible-simple", "One balanced turn", "subpatterns('aba')", "\"The string 'aba' contains 1 substring patterns.\""),
                testCase("a2-p5-hidden-equal", "Equal characters", "subpatterns('aa')", "\"The string 'aa' contains 1 substring patterns.\"", true),
              ],
            },
          ],
        },
      },
      {
        id: "py07-py09",
        number: 3,
        revision: 1,
        title: "Mappings, Sets, and Recursion",
        chapters: ["py07", "py08", "py09"],
        sourceNote: "Practical prompts are independently paraphrased from PE03 (29 November 2019), supplied by the user. Reference solutions are intentionally excluded.",
        references: [
          {
            label: "Mapping type: dict",
            description: "Dictionary lookup, views, insertion order, and standard methods.",
            url: "https://docs.python.org/3/library/stdtypes.html#mapping-types-dict",
          },
          {
            label: "Set types",
            description: "Membership, union, intersection, difference, and immutable sets.",
            url: "https://docs.python.org/3/library/stdtypes.html#set-types-set-frozenset",
          },
          {
            label: "Data structures tutorial",
            description: "Lists, tuples, sets, dictionaries, and looping techniques in context.",
            url: "https://docs.python.org/3/tutorial/datastructures.html",
          },
          {
            label: "Defining functions",
            description: "Function calls, parameters, return values, and recursive definitions.",
            url: "https://docs.python.org/3/tutorial/controlflow.html#defining-functions",
          },
          {
            label: "Recursion-depth safeguard",
            description: "The interpreter limit that protects Python from unbounded recursion.",
            url: "https://docs.python.org/3/library/sys.html#sys.getrecursionlimit",
          },
        ],
        theory: {
          durationSeconds: 1200,
          passPercent: 60,
          questions: [
            theoryQuestion(
              "a3-theory-01",
              "Which statements about dictionaries and sets are correct? Select every correct answer.",
              [
                "Dictionary keys must be hashable.",
                "A set stores each equal value at most once.",
                "Dictionary values must all have the same type.",
                "Membership in a dictionary tests keys by default.",
              ],
              [0, 1, 3],
              "Dictionaries map unique hashable keys to arbitrary values. Sets also use hashable elements and remove equality-based duplicates."
            ),
            theoryQuestion(
              "a3-theory-02",
              "What set is assigned to result?",
              ["{1, 2, 3, 4}", "{3}", "{1, 2, 4}", "set()"],
              [1],
              "The & operator computes intersection, keeping only values present in both sets.",
              "left = {1, 2, 3}\nright = {3, 4}\nresult = left & right"
            ),
            theoryQuestion(
              "a3-theory-03",
              "What is the purpose of a recursive base case?",
              [
                "It produces a result without making another recursive call.",
                "It makes every recursive function infinite.",
                "It converts local variables into globals.",
                "It requires a for loop.",
              ],
              [0],
              "The base case ends one branch of recursion. Recursive cases must move their input toward a base case."
            ),
            theoryQuestion(
              "a3-theory-04",
              "Which observations about this code are correct? Select every correct answer.",
              [
                "counts becomes {2: 2, 1: 1}.",
                "dict.get returns None even though a default of 0 is supplied.",
                "The first occurrence of a value does not raise KeyError.",
                "The loop removes duplicate values from the input tuple.",
              ],
              [0, 2],
              "get(key, 0) supplies zero for a missing key, then each occurrence increments that key's independent count.",
              "counts = {}\nfor digit in (2, 1, 2):\n    counts[digit] = counts.get(digit, 0) + 1"
            ),
            theoryQuestion(
              "a3-theory-05",
              "In a deterministic finite-state machine represented by transition dictionaries, what determines the next state?",
              [
                "The current state and the next input symbol",
                "Only the length of the complete input",
                "A random choice among all states",
                "The alphabetical order of dictionary keys",
              ],
              [0],
              "The current state selects a transition table, and the next symbol selects one outgoing transition from that table."
            ),
            theoryQuestion(
              "a3-theory-06",
              "Which properties support a correct recursive design? Select every correct answer.",
              [
                "Every recursive branch eventually reaches a base case.",
                "The recursive call works on a smaller or simpler state.",
                "The result of the smaller call is combined according to the contract.",
                "Every call receives exactly the same unchanged argument forever.",
              ],
              [0, 1, 2],
              "Termination requires progress, while correctness requires that the current result be built from a correct smaller result."
            ),
            theoryQuestion(
              "a3-theory-07",
              "What is printed?",
              ["2", "3", "507", "The recursion never reaches zero"],
              [1],
              "Each call removes one decimal digit with // 10. The values 507, 50, and 5 contribute three before zero ends the recursion.",
              "def digit_count(n):\n    if n == 0:\n        return 0\n    return 1 + digit_count(n // 10)\n\nprint(digit_count(507))"
            ),
            theoryQuestion(
              "a3-theory-08",
              "What does the Cartesian product of sets A and B contain?",
              [
                "Ordered pairs (a, b) for every a in A and b in B",
                "Only values shared by A and B",
                "Only unordered two-element sets",
                "The numeric products a * b only",
              ],
              [0],
              "A Cartesian product contains every ordered pair. For finite sets, its size is exactly len(A) multiplied by len(B)."
            ),
            theoryQuestion(
              "a3-theory-09",
              "What final state is printed?",
              ["0", "1", "2", "-1"],
              [0],
              "Starting at 0, symbol a moves to state 1; symbol b then uses state 1's table to return to state 0.",
              "transitions = [{'a': 1}, {'b': 0}]\nstate = 0\nfor symbol in 'ab':\n    state = transitions[state][symbol]\nprint(state)"
            ),
            theoryQuestion(
              "a3-theory-10",
              "Which statements about a logical expression tree are correct? Select every correct answer.",
              [
                "A leaf can represent a variable.",
                "A unary negation node has one child expression.",
                "Binary conjunction and disjunction nodes each have two child expressions.",
                "Every expression must be stored as a flat string to be recursive.",
              ],
              [0, 1, 2],
              "A recursive tuple grammar mirrors the tree: leaves stop recursion, unary nodes have one subtree, and binary nodes have two."
            ),
            theoryQuestion(
              "a3-theory-11",
              "Which expression is equivalent to NOT (a AND b) by De Morgan's law?",
              [
                "(NOT a) OR (NOT b)",
                "(NOT a) AND (NOT b)",
                "a OR b",
                "NOT (a OR b)",
              ],
              [0],
              "Negating a conjunction changes it to a disjunction and negates each operand."
            ),
            theoryQuestion(
              "a3-theory-12",
              "What is printed?",
              ["¬", "∧", "b", "('¬', 'b')"],
              [2],
              "expr[2] selects the right subtree ('¬', 'b'), and index 1 selects the string b, which print displays without quotes.",
              "expr = ('∧', 'a', ('¬', 'b'))\nprint(expr[2][1])"
            ),
            theoryQuestion(
              "a3-theory-13",
              "A task forbids loops and global variables. Which approaches respect those constraints? Select every correct answer.",
              [
                "Use recursive calls with local state.",
                "Return accumulated results instead of storing them globally.",
                "Hide a for loop inside an unrelated helper.",
                "Define a clear base case for termination.",
              ],
              [0, 1, 3],
              "Constraints apply to the whole submitted design. Recursion can carry state through parameters and return values without a loop or global mutation."
            ),
            theoryQuestion(
              "a3-theory-14",
              "Which set does this comprehension create?",
              ["{0, 1, 2, 3, 4, 5}", "{0, 2, 4}", "{2, 4, 6}", "{1, 3, 5}"],
              [1],
              "The condition keeps the even values from range(6), whose stop value is excluded.",
              "evens = {value for value in range(6) if value % 2 == 0}"
            ),
            theoryQuestion(
              "a3-theory-15",
              "Which checks improve a recursive tree or state-machine function? Select every correct answer.",
              [
                "Handle each valid node or state representation explicitly.",
                "Ensure every recursive descent reaches a smaller subtree.",
                "Define the result for a missing transition.",
                "Depend on dictionary display order for semantic correctness.",
              ],
              [0, 1, 2],
              "Explicit cases, structural progress, and defined error behavior make the function predictable. Display order should not determine meaning."
            ),
          ],
        },
        practical: {
          durationSeconds: 3600,
          passPercent: 60,
          questions: [
            {
              id: "a3-practical-01",
              title: "Reconstruct positioned characters",
              points: 20,
              prompt: "Reconstruct a word from character-position pairs whose positions identify where each character belongs.",
              contract: [
                "Define reorder(items).",
                "Return the reconstructed string.",
                "Interpret positions as one-based indexes.",
              ],
              constraints: [
                "Each item is a pair (single_character, position).",
                "Positions are unique and cover every position from 1 through len(items).",
                "The pairs may arrive in any order.",
              ],
              examples: [
                { call: "reorder([('g', 3), ('d', 1), ('o', 2)])", expected: "'dog'" },
              ],
              starterCode: "def reorder(items):\n    # Place each character at its one-based target position.\n    pass\n",
              mode: "function",
              tests: [
                testCase("a3-p1-visible-dog", "Unordered positions", "reorder([('g', 3), ('d', 1), ('o', 2)])", "'dog'"),
                testCase("a3-p1-visible-one", "One character", "reorder([('x', 1)])", "'x'"),
                testCase("a3-p1-hidden-word", "Longer word", "reorder([('r', 5), ('c', 1), ('o', 2), ('d', 3), ('e', 4)])", "'coder'", true),
              ],
            },
            {
              id: "a3-practical-02",
              title: "Evaluate set commands",
              points: 20,
              prompt: "Evaluate an alternating sequence of sets and operator symbols from left to right.",
              contract: [
                "Define process(commands).",
                "Return the resulting set.",
                "Support | for union, & for intersection, - for difference, and x for Cartesian product.",
              ],
              constraints: [
                "commands starts and ends with a set and alternates set/operator/set.",
                "Cartesian product creates ordered tuple pairs.",
                "Evaluation is strictly left to right, without mathematical precedence.",
              ],
              examples: [
                { call: "process([{1, 3, 4}, '|', {2, 5}])", expected: "{1, 2, 3, 4, 5}" },
              ],
              starterCode: "def process(commands):\n    # Apply each operator to the current set and the next set.\n    pass\n",
              mode: "function",
              tests: [
                testCase("a3-p2-visible-union", "Union", "process([{1, 3, 4}, '|', {2, 5}])", "{1, 2, 3, 4, 5}"),
                testCase("a3-p2-visible-product", "Cartesian product", "process([{1, 2}, 'x', {3, 4}])", "{(1, 3), (1, 4), (2, 3), (2, 4)}"),
                testCase("a3-p2-hidden-left", "Left-to-right operations", "process([{1, 2, 3}, '&', {2, 3, 4}, '-', {3}])", "{2}", true),
              ],
            },
            {
              id: "a3-practical-03",
              title: "Count digits recursively",
              points: 20,
              prompt: "Count the frequency of each decimal digit in a positive integer and return the frequencies in a dictionary.",
              contract: [
                "Define count_digits(n).",
                "Return a dictionary mapping each present digit to its occurrence count.",
                "Include zero digits that occur inside or at the end of n.",
              ],
              constraints: [
                "n is a positive integer.",
                "Do not use for or while loops, comprehensions, or global variables.",
                "Use recursive progress through the decimal digits.",
              ],
              examples: [
                { call: "count_digits(12231)", expected: "{1: 2, 2: 2, 3: 1}" },
              ],
              starterCode: "def count_digits(n):\n    # Use a smaller integer in each recursive call and return local state.\n    pass\n",
              mode: "function",
              tests: [
                testCase("a3-p3-visible-repeat", "Repeated digits", "count_digits(12231)", "{1: 2, 2: 2, 3: 1}"),
                testCase("a3-p3-visible-single", "Single digit", "count_digits(7)", "{7: 1}"),
                testCase("a3-p3-hidden-zero", "Embedded and trailing zeros", "count_digits(1002)", "{1: 1, 0: 2, 2: 1}", true),
              ],
            },
            {
              id: "a3-practical-04",
              title: "Run a finite-state machine",
              points: 20,
              prompt: "Follow a deterministic finite-state machine represented by one transition dictionary per state.",
              contract: [
                "Define fsm(transitions, input_text).",
                "Start in state 0 and return the final state after consuming the complete string.",
                "Return -1 immediately when the current state has no transition for a symbol.",
              ],
              constraints: [
                "Every transition target is a valid list index.",
                "An empty input string returns state 0.",
                "Do not modify the transition dictionaries.",
              ],
              examples: [
                { call: "fsm([{'a': 1}, {'b': 2}, {'a': 1, 'b': 2}], 'ab')", expected: "2" },
              ],
              starterCode: "def fsm(transitions, input_text):\n    # Track the current state while consuming one symbol at a time.\n    pass\n",
              mode: "function",
              tests: [
                testCase("a3-p4-visible-route", "Recognized route", "fsm([{'a': 1}, {'b': 2}, {'a': 1, 'b': 2}], 'ab')", "2"),
                testCase("a3-p4-visible-missing", "Missing transition", "fsm([{'a': 1}, {'b': 0}], 'aa')", "-1"),
                testCase("a3-p4-hidden-empty", "Empty input", "fsm([{'a': 0}], '')", "0", true),
              ],
            },
            {
              id: "a3-practical-05",
              title: "Push negations to variables",
              points: 20,
              prompt: "Simplify a recursive logical expression so that negation nodes occur only directly above variables.",
              contract: [
                "Define simplify(expr).",
                "Apply De Morgan transformations and remove double negations recursively.",
                "Return the equivalent expression using the same tuple grammar.",
              ],
              constraints: [
                "A variable is a one-character string from a through z.",
                "Nodes are ('¬', expr), ('∧', left, right), or ('∨', left, right).",
                "Preserve left-to-right operand order.",
              ],
              examples: [
                { call: "simplify(('¬', ('∧', 'a', ('¬', 'b'))))", expected: "('∨', ('¬', 'a'), 'b')" },
              ],
              starterCode: "def simplify(expr):\n    # Distinguish variable, unary, and binary nodes, then recurse structurally.\n    pass\n",
              mode: "function",
              tests: [
                testCase("a3-p5-visible-demorgan", "Negated conjunction", "simplify(('¬', ('∧', 'a', ('¬', 'b'))))", "('∨', ('¬', 'a'), 'b')"),
                testCase("a3-p5-visible-double", "Double negation", "simplify(('¬', ('¬', 'x')))", "'x'"),
                testCase("a3-p5-hidden-disjunction", "Negated disjunction", "simplify(('¬', ('∨', 'a', 'b')))", "('∧', ('¬', 'a'), ('¬', 'b'))", true),
              ],
            },
          ],
        },
      },
      {
        id: "py10-py11",
        number: 4,
        revision: 1,
        title: "Functional Tools and Lazy Algorithms",
        chapters: ["py10", "py11"],
        sourceNote: "Practical prompts are independently paraphrased from PE04 (19 December 2019), supplied by the user. Reference solutions and source screenshots are intentionally excluded.",
        references: [
          {
            label: "Functional Programming HOWTO",
            description: "Iterators, generators, mapping, filtering, and composable functions.",
            url: "https://docs.python.org/3/howto/functional.html",
          },
          {
            label: "List comprehensions",
            description: "Readable transformation and filtering expressions for new lists.",
            url: "https://docs.python.org/3/tutorial/datastructures.html#list-comprehensions",
          },
          {
            label: "Generators",
            description: "Lazy functions that yield values while preserving local state.",
            url: "https://docs.python.org/3/tutorial/classes.html#generators",
          },
          {
            label: "itertools",
            description: "Efficient iterator building blocks for lazy data pipelines.",
            url: "https://docs.python.org/3/library/itertools.html",
          },
          {
            label: "functools.reduce()",
            description: "Cumulative reduction of an iterable into one result.",
            url: "https://docs.python.org/3/library/functools.html#functools.reduce",
          },
        ],
        theory: {
          durationSeconds: 1200,
          passPercent: 60,
          questions: [
            theoryQuestion(
              "a4-theory-01",
              "Which statements about generator functions are correct? Select every correct answer.",
              [
                "Calling one returns a generator object without running the whole body immediately.",
                "yield pauses execution while preserving local state for the next request.",
                "A generator must build a complete list before yielding its first item.",
                "A generator is exhausted after it finishes unless a new generator is created.",
              ],
              [0, 1, 3],
              "Generators produce values on demand. Their state resumes after each yield, and an exhausted generator cannot be rewound."
            ),
            theoryQuestion(
              "a4-theory-02",
              "What list is printed?",
              ["[1, 2]", "[1, 2, 3]", "[0, 1, 2]", "[]"],
              [1],
              "The generator yields 1, 2, and 3 before its for loop ends, and list consumes those values.",
              "def steps():\n    for value in range(1, 4):\n        yield value\n\nprint(list(steps()))"
            ),
            theoryQuestion(
              "a4-theory-03",
              "What does a list comprehension primarily produce?",
              [
                "A new list from an expression and optional filters",
                "A mutable view into an existing list",
                "A generator object in every case",
                "A dictionary whose keys are list indexes",
              ],
              [0],
              "A list comprehension eagerly constructs a new list. A generator expression uses parentheses for lazy production."
            ),
            theoryQuestion(
              "a4-theory-04",
              "Which statements describe a sparse-vector dictionary correctly? Select every correct answer.",
              [
                "Stored keys identify positions with non-zero values.",
                "An absent position is interpreted as zero.",
                "Every zero must be stored explicitly.",
                "A zero result should be omitted to keep the representation sparse.",
              ],
              [0, 1, 3],
              "Sparse storage records only meaningful non-zero entries. Missing keys supply the implicit zero value."
            ),
            theoryQuestion(
              "a4-theory-05",
              "What is functools.reduce designed to do?",
              [
                "Combine iterable values cumulatively into one result",
                "Keep only values for which a predicate is true",
                "Create every Cartesian-product pair",
                "Pause a function at a yield expression",
              ],
              [0],
              "reduce repeatedly applies a two-argument combining function, optionally starting from an initializer."
            ),
            theoryQuestion(
              "a4-theory-06",
              "Which statements about iterators are correct? Select every correct answer.",
              [
                "next(iterator) requests one value at a time.",
                "An exhausted iterator raises StopIteration.",
                "Every iterator can be indexed with iterator[0].",
                "Many iterator operations avoid storing the full result in memory.",
              ],
              [0, 1, 3],
              "The iterator protocol is sequential: next requests values until StopIteration. Indexing is not generally part of that protocol."
            ),
            theoryQuestion(
              "a4-theory-07",
              "What value is printed?",
              ["-1", "0", "1", "2"],
              [2],
              "The value 2 has two repetitions beyond its first occurrence; 3 has one odd repetition; 4 has none, so 2 - 1 = 1.",
              "values = [2, 2, 2, 3, 3, 4]\neven_repeats = len([x for x in values if x % 2 == 0]) - len({x for x in values if x % 2 == 0})\nodd_repeats = len([x for x in values if x % 2]) - len({x for x in values if x % 2})\nprint(even_repeats - odd_repeats)"
            ),
            theoryQuestion(
              "a4-theory-08",
              "What do map and filter return in modern Python?",
              [
                "Lazy iterator objects",
                "Lists that are always fully populated immediately",
                "Only Boolean values",
                "Dictionary views",
              ],
              [0],
              "map and filter return iterators. Convert them to a concrete collection only when materialization is needed."
            ),
            theoryQuestion(
              "a4-theory-09",
              "What set is assigned to keys?",
              ["{1}", "{2}", "{1, 2}", "{5, 7}"],
              [2],
              "Dictionary key views support set-like union, producing the keys present in either dictionary.",
              "left = {1: 5}\nright = {2: 7}\nkeys = left.keys() | right.keys()"
            ),
            theoryQuestion(
              "a4-theory-10",
              "Which rules are appropriate when recursively searching a quadrant map? Select every correct answer.",
              [
                "Descend only into child rectangles that overlap the search rectangle.",
                "Treat None as an empty leaf.",
                "Visit every quadrant even when geometry proves it cannot overlap.",
                "Return object labels in a set so a label is not duplicated.",
              ],
              [0, 1, 3],
              "Geometry prunes irrelevant branches. Empty leaves contribute nothing, and set union combines discovered labels."
            ),
            theoryQuestion(
              "a4-theory-11",
              "For componentwise multiplication of two sparse vectors, what is the result at a position missing from either vector?",
              [
                "Zero, so that position is omitted",
                "One, because missing values are multiplicative identities",
                "The key itself",
                "A nested tuple",
              ],
              [0],
              "Sparse-vector absence means numeric zero. Multiplication by that implicit zero produces zero, which is not stored."
            ),
            theoryQuestion(
              "a4-theory-12",
              "What list is printed?",
              ["[2, 5]", "[2, 3, 5]", "[2, 3, 4, 5]", "[3, 5]"],
              [1],
              "Each interval includes both endpoints. The first yields 2 and 3, and the second yields 5.",
              "def interval_values(intervals):\n    for low, high in intervals:\n        for value in range(low, high + 1):\n            yield value\n\nprint(list(interval_values([(2, 3), (5, 5)])))"
            ),
            theoryQuestion(
              "a4-theory-13",
              "A task forbids explicit loops but permits functional tools and comprehensions. Which choices comply? Select every correct answer.",
              [
                "A list comprehension with a filter condition",
                "map or filter with a side-effect-free callable",
                "A hidden while loop inside a helper",
                "functools.reduce for an appropriate cumulative result",
              ],
              [0, 1, 3],
              "The stated alternatives express iteration without explicit for or while statements. Hiding a forbidden loop does not satisfy the constraint."
            ),
            theoryQuestion(
              "a4-theory-14",
              "What value is printed?",
              ["2", "3", "4", "5"],
              [1],
              "Zero occurs twice and contributes one repetition; three occurs three times and contributes two, for a total of three.",
              "values = [0, 0, 3, 3, 3]\nrepetitions = sum(values.count(value) - 1 for value in set(values))\nprint(repetitions)"
            ),
            theoryQuestion(
              "a4-theory-15",
              "Which choices can reduce unnecessary memory or work? Select every correct answer.",
              [
                "Yield interval values lazily instead of building a large list.",
                "Store only non-zero sparse-vector entries.",
                "Expand every quadrant even when it cannot intersect the query.",
                "Stop consuming an iterator when the required result is known.",
              ],
              [0, 1, 3],
              "Lazy production, sparse representation, geometric pruning, and early termination all avoid materializing or processing irrelevant data."
            ),
          ],
        },
        practical: {
          durationSeconds: 3600,
          passPercent: 60,
          questions: [
            {
              id: "a4-practical-01",
              title: "Count list occurrences present in a set",
              points: 20,
              prompt: "Count how many list occurrences have a value that is a member of the supplied set.",
              contract: [
                "Define common_items(alist, aset).",
                "Return an integer count.",
                "Count each qualifying list position, including repeated equal values.",
              ],
              constraints: [
                "Do not mutate the list or set.",
                "An empty list returns 0.",
              ],
              examples: [
                { call: "common_items([1, 2, 2, 4], {2, 3})", expected: "2" },
              ],
              starterCode: "def common_items(alist, aset):\n    # Count qualifying list positions; duplicate positions count separately.\n    pass\n",
              mode: "function",
              tests: [
                testCase("a4-p1-visible-duplicates", "Repeated member", "common_items([1, 2, 2, 4], {2, 3})", "2"),
                testCase("a4-p1-visible-empty", "Empty list", "common_items([], {1, 2})", "0"),
                testCase("a4-p1-hidden-all", "Every position qualifies", "common_items([0, 0, 1, 2], {0, 1, 2})", "4", true),
              ],
            },
            {
              id: "a4-practical-02",
              title: "Process sparse-vector operations",
              points: 20,
              prompt: "Evaluate an alternating sequence of sparse-vector dictionaries and named componentwise operations.",
              contract: [
                "Define process(commands).",
                "Support add, sub, and mul from left to right.",
                "Return a dictionary containing only non-zero result entries.",
              ],
              constraints: [
                "A missing key represents the value zero.",
                "commands starts and ends with a dictionary and alternates dictionary/operator/dictionary.",
                "Do not mutate the input dictionaries.",
              ],
              examples: [
                { call: "process([{1: 5}, 'add', {2: 7}])", expected: "{1: 5, 2: 7}" },
                { call: "process([{1: 5}, 'mul', {1: 3}])", expected: "{1: 15}" },
              ],
              starterCode: "def process(commands):\n    # Combine one sparse vector at a time and omit every zero result.\n    pass\n",
              mode: "function",
              tests: [
                testCase("a4-p2-visible-add", "Disjoint addition", "process([{1: 5}, 'add', {2: 7}])", "{1: 5, 2: 7}"),
                testCase("a4-p2-visible-cancel", "Subtraction removes zero", "process([{1: 5, 2: 3}, 'sub', {1: 5}])", "{2: 3}"),
                testCase("a4-p2-hidden-chain", "Left-to-right chain", "process([{0: 2, 1: 3}, 'mul', {1: 4, 2: 5}, 'add', {0: 7}])", "{0: 7, 1: 12}", true),
              ],
            },
            {
              id: "a4-practical-03",
              title: "Compare even and odd repetitions",
              points: 20,
              prompt: "Return the number of repeated even occurrences minus the number of repeated odd occurrences.",
              contract: [
                "Define repeated(nlist).",
                "A value occurring n times contributes n - 1 repetitions.",
                "Treat zero as even.",
              ],
              constraints: [
                "Do not use explicit for or while statements.",
                "Use map, filter, reduce, comprehensions, or suitable collection operations.",
                "The input contains integers and may be empty.",
              ],
              examples: [
                { call: "repeated([2, 2, 2, 3, 3, 4])", expected: "1" },
              ],
              starterCode: "def repeated(nlist):\n    # Compare duplicate counts by parity without an explicit loop statement.\n    pass\n",
              mode: "function",
              tests: [
                testCase("a4-p3-visible-mixed", "Even and odd repeats", "repeated([2, 2, 2, 3, 3, 4])", "1"),
                testCase("a4-p3-visible-zero", "Zero is even", "repeated([0, 0, 1])", "1"),
                testCase("a4-p3-hidden-odd", "More odd repetitions", "repeated([1, 1, 2, 2, 2, 3, 3, 3, 3])", "-2", true),
              ],
            },
            {
              id: "a4-practical-04",
              title: "Yield inclusive interval values",
              points: 20,
              prompt: "Create a generator that yields the integer values represented by an ordered list of disjoint inclusive intervals.",
              contract: [
                "Define generator(intlist).",
                "Yield each integer from every interval, including both endpoints.",
                "Yield nothing for an empty interval list.",
              ],
              constraints: [
                "Each tuple is (minimum, maximum) with integer minimum <= maximum.",
                "Intervals are disjoint and appear in increasing order.",
                "Return a generator; do not return a fully built list.",
              ],
              examples: [
                { call: "list(generator([(1, 1), (3, 5)]))", expected: "[1, 3, 4, 5]" },
              ],
              starterCode: "def generator(intlist):\n    # Yield values lazily in interval order.\n    pass\n",
              mode: "function",
              tests: [
                testCase("a4-p4-visible-ranges", "Separated intervals", "list(generator([(1, 1), (3, 5), (10, 12)]))", "[1, 3, 4, 5, 10, 11, 12]"),
                testCase("a4-p4-visible-generator", "Generator type and empty input", "(__import__('inspect').isgenerator(generator([])), list(generator([])))", "(True, [])"),
                testCase("a4-p4-hidden-negative", "Negative interval", "list(generator([(-2, 0), (2, 2)]))", "[-2, -1, 0, 2]", true),
              ],
            },
            {
              id: "a4-practical-05",
              title: "Search a recursive quadrant map",
              points: 20,
              prompt: "Search a recursive four-quadrant map and return the object labels whose leaf regions overlap a query rectangle.",
              contract: [
                "Define search_map(amap, map_rectangle, search_rectangle).",
                "Return a set of matching object-name strings.",
                "Interpret each quadrant tuple in the order (Q1, Q2, Q3, Q4).",
              ],
              constraints: [
                "The coordinate origin is bottom-left: Q1 bottom-left, Q2 bottom-right, Q3 top-right, Q4 top-left.",
                "A node is a four-item quadrant tuple, an object-name string, or None.",
                "Rectangles are (x, y, width, height) with positive dimensions; touching boundaries count as overlap.",
                "Recurse only into quadrants that overlap the search rectangle.",
              ],
              examples: [
                { call: "search_map(('A', 'B', 'C', 'D'), (0, 0, 100, 100), (0, 0, 49, 49))", expected: "{'A'}" },
              ],
              starterCode: "def search_map(amap, map_rectangle, search_rectangle):\n    # Handle empty/object leaves, then recurse into overlapping child rectangles.\n    pass\n",
              mode: "function",
              tests: [
                testCase("a4-p5-visible-one", "One quadrant", "search_map(('A', 'B', 'C', 'D'), (0, 0, 100, 100), (0, 0, 49, 49))", "{'A'}"),
                testCase(
                  "a4-p5-visible-quadrants",
                  "Map the other three quadrants",
                  "(search_map(('A', 'B', 'C', 'D'), (0, 0, 100, 100), (51, 0, 49, 49)), search_map(('A', 'B', 'C', 'D'), (0, 0, 100, 100), (51, 51, 49, 49)), search_map(('A', 'B', 'C', 'D'), (0, 0, 100, 100), (0, 51, 49, 49)))",
                  "({'B'}, {'C'}, {'D'})"
                ),
                testCase(
                  "a4-p5-hidden-nested-boundary",
                  "Nested quadrant and inclusive seam overlap",
                  "(search_map((('A', None, 'B', None), None, 'C', 'D'), (0, 0, 100, 100), (0, 0, 24, 24)), search_map(('A', 'B', 'C', 'D'), (0, 0, 100, 100), (25, 50, 10, 10)))",
                  "({'A'}, {'A', 'D'})",
                  true
                ),
              ],
            },
          ],
        },
      },
    ],
  };
})();
