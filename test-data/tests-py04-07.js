(() => {
  window.EXERCISE_TESTS = window.EXERCISE_TESTS || {};

  Object.assign(window.EXERCISE_TESTS, {
    "py04-boolean-function": {
      description: "Validate both the numeric type and the inclusive grade range before returning. The result must be a real Boolean so callers can rely on a stable contract.",
      success: [
        "Accepts int and float grades from 0 through 100",
        "Rejects out-of-range and non-numeric values without raising",
        "Returns an object whose exact type is bool",
      ],
      visual: "function",
      mode: "function",
      tests: [
        { id: "py04-bool-valid", name: "Valid grade", hidden: false, call: "validate(87.5)", expected: "True" },
        { id: "py04-bool-invalid", name: "Invalid text grade", hidden: false, call: "validate('87')", expected: "False" },
        { id: "py04-bool-type", name: "Hidden return-type case", hidden: true, call: "type(validate(50)) is bool", expected: "True" },
      ],
    },
    "py04-counting-characters": {
      description: "Count exact, case-sensitive occurrences of one character across the whole word. Use -1 as the sentinel only when no occurrence exists.",
      success: [
        "Counts every matching character",
        "Treats uppercase and lowercase as different characters",
        "Returns -1 rather than zero for an absent character",
      ],
      visual: "text",
      mode: "function",
      tests: [
        { id: "py04-count-many", name: "Repeated character", hidden: false, call: "count_chars('banana', 'a')", expected: "3" },
        { id: "py04-count-missing", name: "Missing character", hidden: false, call: "count_chars('banana', 'x')", expected: "-1" },
        { id: "py04-count-case", name: "Hidden case-sensitive case", hidden: true, call: "count_chars('AaA', 'A')", expected: "2" },
      ],
    },
    "py04-dogs-age": {
      description: "Apply 10.5 dog years to each of the first two human years. Add four dog years for every human year after that breakpoint.",
      success: [
        "Uses the first-two-years rule at the boundary",
        "Uses the later-years rule only for the remaining age",
        "Supports fractional human ages",
      ],
      visual: "math",
      mode: "function",
      tests: [
        { id: "py04-dogs-young", name: "First year", hidden: false, call: "dogs(1)", expected: "10.5" },
        { id: "py04-dogs-adult", name: "Adult dog", hidden: false, call: "dogs(5)", expected: "33.0" },
        { id: "py04-dogs-boundary", name: "Hidden breakpoint case", hidden: true, call: "dogs(2)", expected: "21.0" },
      ],
    },
    "py04-greatest-number": {
      description: "Reorder every decimal digit from greatest to smallest without inventing or dropping digits. Convert the arranged digit sequence back to an integer for the result.",
      success: [
        "Sorts digits in descending order",
        "Preserves repeated digits",
        "Handles zero as a valid non-negative input",
      ],
      visual: "sequence",
      mode: "function",
      tests: [
        { id: "py04-greatest-basic", name: "Mixed digits", hidden: false, call: "greatest(31042)", expected: "43210" },
        { id: "py04-greatest-repeat", name: "Repeated digits", hidden: false, call: "greatest(90919)", expected: "99910" },
        { id: "py04-greatest-zero", name: "Hidden zero case", hidden: true, call: "greatest(0)", expected: "0" },
      ],
    },
    "py04-ugly-number": {
      description: "An ugly number is positive and reduces to one after removing every factor of 2, 3, and 5. Any remaining prime factor makes the answer false.",
      success: [
        "Accepts products made only from 2, 3, and 5",
        "Rejects values containing another prime factor",
        "Recognizes 1 as the multiplicative base case",
      ],
      visual: "loop",
      mode: "function",
      tests: [
        { id: "py04-ugly-true", name: "Ugly composite", hidden: false, call: "ugly(60)", expected: "True" },
        { id: "py04-ugly-false", name: "Forbidden factor", hidden: false, call: "ugly(14)", expected: "False" },
        { id: "py04-ugly-one", name: "Hidden base case", hidden: true, call: "ugly(1)", expected: "True" },
      ],
    },
    "py04-collatz": {
      description: "Generate every Collatz value beginning with the positive input and ending with one. Return the complete sequence as comma-separated text with no spaces.",
      success: [
        "Applies 3n + 1 to odd values and halves even values",
        "Includes both the starting value and final 1",
        "Uses commas with no extra whitespace",
      ],
      visual: "loop",
      mode: "function",
      tests: [
        { id: "py04-collatz-six", name: "Multi-step sequence", hidden: false, call: "collatz(6)", expected: "'6,3,10,5,16,8,4,2,1'" },
        { id: "py04-collatz-two", name: "Single halving", hidden: false, call: "collatz(2)", expected: "'2,1'" },
        { id: "py04-collatz-one", name: "Hidden terminal case", hidden: true, call: "collatz(1)", expected: "'1'" },
      ],
    },
    "py04-pascal": {
      description: "Build the first n rows of Pascal's triangle using binomial coefficients. Separate values with one space and terminate every row, including the last, with a newline.",
      success: [
        "Produces exactly n rows",
        "Uses one space between adjacent coefficients",
        "Ends each generated row with a newline",
      ],
      visual: "math",
      mode: "function",
      tests: [
        { id: "py04-pascal-one", name: "One row", hidden: false, call: "pascal(1)", expected: "'1\\n'" },
        { id: "py04-pascal-four", name: "Four rows", hidden: false, call: "pascal(4)", expected: "'1\\n1 1\\n1 2 1\\n1 3 3 1\\n'" },
        { id: "py04-pascal-empty", name: "Hidden zero-row case", hidden: true, call: "pascal(0)", expected: "''" },
      ],
    },
    "py04-get-positions": {
      description: "Split the sentence into words and translate each word to its first zero-based index in word_list. Return clean space-separated indexes, or an empty string if any word cannot be mapped.",
      success: [
        "Maps every sentence word in its original order",
        "Uses the first index when word_list contains duplicates",
        "Returns no partial mapping when a word is absent",
      ],
      visual: "search",
      mode: "function",
      tests: [
        { id: "py04-positions-basic", name: "Complete mapping", hidden: false, call: "get_positions('red blue', ['red', 'blue', 'green'])", expected: "'0 1'" },
        { id: "py04-positions-missing", name: "Incomplete mapping", hidden: false, call: "get_positions('red gold', ['red', 'blue'])", expected: "''" },
        { id: "py04-positions-many", name: "Hidden multi-word case", hidden: true, call: "get_positions('fox fox owl', ['owl', 'fox', 'fox'])", expected: "'1 1 0'" },
      ],
    },
    "py04-digits-average": {
      description: "Replace each adjacent digit pair with the ceiling of its arithmetic mean to make a number with one fewer digit. Repeat that reduction until exactly one digit remains.",
      success: [
        "Averages adjacent digits rather than disjoint pairs",
        "Rounds every pair upward independently",
        "Reduces two-digit inputs to one digit",
      ],
      visual: "recursion",
      mode: "function",
      tests: [
        { id: "py04-average-two", name: "Two digits", hidden: false, call: "digits_average(42)", expected: "3" },
        { id: "py04-average-chain", name: "Repeated reduction", hidden: false, call: "digits_average(1234)", expected: "4" },
        { id: "py04-average-ten", name: "Hidden boundary case", hidden: true, call: "digits_average(10)", expected: "1" },
      ],
    },
    "py04-caesar-fibonacci": {
      description: "Shift each uppercase letter backward by the Fibonacci number at that character's zero-based position. Preserve non-letters while still letting their positions advance the Fibonacci sequence.",
      success: [
        "Uses Fibonacci shifts 0, 1, 1, 2, 3, and onward",
        "Wraps backward shifts within A through Z",
        "Preserves punctuation and counts its position",
      ],
      visual: "text",
      mode: "function",
      tests: [
        { id: "py04-caesar-basic", name: "Fibonacci shifts", hidden: false, call: "caesar('ABCDE')", expected: "'AABBB'" },
        { id: "py04-caesar-wrap", name: "Alphabet wrap", hidden: false, call: "caesar('AAAAA')", expected: "'AZZYX'" },
        { id: "py04-caesar-symbol", name: "Hidden punctuation case", hidden: true, call: "caesar('AB-CD')", expected: "'AA-AA'" },
      ],
    },

    "py05-counting-characters": {
      description: "Classify every character as alphabetic, numeric, or other and count the three groups independently. Return the counts in that exact order as one tuple.",
      success: [
        "Counts Unicode-aware letters with isalpha",
        "Counts digits separately from letters",
        "Includes spaces and punctuation in the other count",
      ],
      visual: "text",
      mode: "function",
      tests: [
        { id: "py05-chars-mixed", name: "Mixed characters", hidden: false, call: "count_chars('Hello 2026!')", expected: "(5, 4, 2)" },
        { id: "py05-chars-empty", name: "Empty string", hidden: false, call: "count_chars('')", expected: "(0, 0, 0)" },
        { id: "py05-chars-unicode", name: "Hidden Unicode case", hidden: true, call: "count_chars('Olá²?')", expected: "(3, 1, 1)" },
      ],
    },
    "py05-counting-elements": {
      description: "Scan the outer tuple from left to right and stop at the first element whose exact type is tuple. Return its zero-based index, or -1 when no nested tuple exists.",
      success: [
        "Returns the first nested-tuple index",
        "Does not confuse lists with tuples",
        "Returns -1 after a complete unsuccessful scan",
      ],
      visual: "search",
      mode: "function",
      tests: [
        { id: "py05-until-nested", name: "Nested tuple found", hidden: false, call: "count_until(('a', 7, ('x',), ('y',)))", expected: "2" },
        { id: "py05-until-none", name: "No nested tuple", hidden: false, call: "count_until((1, 'x', [2]))", expected: "-1" },
        { id: "py05-until-first", name: "Hidden first-position case", hidden: true, call: "count_until(((), 'later'))", expected: "0" },
      ],
    },
    "py05-discard-middle": {
      description: "For a string longer than three characters, keep only its first two and final two characters. Return the empty string for lengths zero through three.",
      success: [
        "Combines the first-two and last-two slices",
        "Keeps a four-character string unchanged",
        "Applies the short-input guard before slicing",
      ],
      visual: "text",
      mode: "function",
      tests: [
        { id: "py05-discard-long", name: "Discard a middle", hidden: false, call: "discard_middle('programming')", expected: "'prng'" },
        { id: "py05-discard-four", name: "Four characters", hidden: false, call: "discard_middle('code')", expected: "'code'" },
        { id: "py05-discard-short", name: "Hidden short case", hidden: true, call: "discard_middle('cat')", expected: "''" },
      ],
    },
    "py05-longest-word": {
      description: "Split a non-empty sentence on arbitrary whitespace and measure each resulting word. Return only the greatest word length, keeping the first maximum implicitly when lengths tie.",
      success: [
        "Returns an integer length rather than the word",
        "Handles repeated spaces and line breaks",
        "Works for a one-word sentence",
      ],
      visual: "text",
      mode: "function",
      tests: [
        { id: "py05-longest-basic", name: "Several words", hidden: false, call: "longest('A short sentence')", expected: "8" },
        { id: "py05-longest-spaces", name: "Repeated whitespace", hidden: false, call: "longest('  red   elephant  ') ", expected: "8" },
        { id: "py05-longest-one", name: "Hidden single-word case", hidden: true, call: "longest('python')", expected: "6" },
      ],
    },
    "py05-first-repeating-letter": {
      description: "Read characters from left to right and identify the first one that occurs somewhere later. Return None when every character appears only once.",
      success: [
        "Chooses by first position, not by second occurrence",
        "Treats character case as significant",
        "Returns None when no repetition exists",
      ],
      visual: "search",
      mode: "function",
      tests: [
        { id: "py05-repeat-basic", name: "First repeated character", hidden: false, call: "repeated_letter('abca')", expected: "'a'" },
        { id: "py05-repeat-order", name: "Leftmost candidate wins", hidden: false, call: "repeated_letter('cabbdc')", expected: "'c'" },
        { id: "py05-repeat-none", name: "Hidden no-repeat case", hidden: true, call: "repeated_letter('Python')", expected: "None" },
      ],
    },
    "py05-find-treasure": {
      description: "Begin at the supplied Cartesian coordinate and apply each hyphen-separated direction in order. Horizontal moves change x and vertical moves change y by exactly one.",
      success: [
        "Parses every hyphen-separated step",
        "Updates the correct coordinate axis",
        "Returns a new final coordinate tuple",
      ],
      visual: "mapping",
      mode: "function",
      tests: [
        { id: "py05-map-basic", name: "Mixed route", hidden: false, call: "map((0, 0), 'up-right-right-down')", expected: "(2, 0)" },
        { id: "py05-map-offset", name: "Non-zero start", hidden: false, call: "map((3, -2), 'left-up')", expected: "(2, -1)" },
        { id: "py05-map-cancel", name: "Hidden cancelling route", hidden: true, call: "map((5, 5), 'up-down-left-right')", expected: "(5, 5)" },
      ],
    },
    "py05-remove-leading-zeros": {
      description: "Normalize each dot-separated component independently by removing only its leading zeros. Preserve one zero when a component consists entirely of zeros, then rejoin the components with dots.",
      success: [
        "Removes leading zeros without changing later digits",
        "Preserves one zero for an all-zero component",
        "Keeps the original number of components",
      ],
      visual: "text",
      mode: "function",
      tests: [
        { id: "py05-leading-ip", name: "Mixed components", hidden: false, call: "remove_leading('001.020.300.000')", expected: "'1.20.300.0'" },
        { id: "py05-leading-clean", name: "Already normalized", hidden: false, call: "remove_leading('10.0.5')", expected: "'10.0.5'" },
        { id: "py05-leading-zeros", name: "Hidden all-zero case", hidden: true, call: "remove_leading('000.00.0')", expected: "'0.0.0'" },
      ],
    },
    "py05-summary-ranges": {
      description: "Read the ascending comma-separated integers and group maximal runs whose values increase by one. Format multi-value runs as start->end while leaving isolated values unchanged.",
      success: [
        "Detects maximal consecutive runs",
        "Keeps singleton values unadorned",
        "Supports negative integers",
      ],
      visual: "sequence",
      mode: "function",
      tests: [
        { id: "py05-ranges-basic", name: "Runs and singletons", hidden: false, call: "summary_ranges('1,2,3,5,7,8')", expected: "'1->3,5,7->8'" },
        { id: "py05-ranges-single", name: "One value", hidden: false, call: "summary_ranges('9')", expected: "'9'" },
        { id: "py05-ranges-negative", name: "Hidden negative range", hidden: true, call: "summary_ranges('-3,-2,-1,1')", expected: "'-3->-1,1'" },
      ],
    },
    "py05-palindrome-index": {
      description: "Find one character whose removal turns the string into a palindrome. Return its zero-based index, or -1 when the string is already palindromic or cannot be repaired with one deletion.",
      success: [
        "Tests the two candidates at the first mismatch",
        "Returns a valid repair index when one exists",
        "Uses -1 for already-valid and impossible strings",
      ],
      visual: "search",
      mode: "function",
      tests: [
        { id: "py05-palindrome-left", name: "Remove left mismatch", hidden: false, call: "palindrome_index('aaab')", expected: "3" },
        { id: "py05-palindrome-valid", name: "Already palindrome", hidden: false, call: "palindrome_index('racecar')", expected: "-1" },
        { id: "py05-palindrome-impossible", name: "Hidden impossible case", hidden: true, call: "palindrome_index('abcd')", expected: "-1" },
      ],
    },
    "py05-greatest-member": {
      description: "Score a string by summing its character codes and score a tuple by recursively summing all nested members. Return the highest-scoring top-level member, choosing the first on a tie and returning () when every score is zero.",
      success: [
        "Scores nested tuples recursively",
        "Returns the winning member rather than its score",
        "Uses the first top-level member when scores tie",
      ],
      visual: "recursion",
      mode: "function",
      tests: [
        { id: "py05-member-string", name: "String wins", hidden: false, call: "greatest_member(('az', ('a',), 'b'))", expected: "'az'" },
        { id: "py05-member-nested", name: "Nested tuple wins", hidden: false, call: "greatest_member(('z', ('A', ('B',))))", expected: "('A', ('B',))" },
        { id: "py05-member-zero", name: "Hidden zero-score case", hidden: true, call: "greatest_member(('', ()))", expected: "()" },
      ],
    },

    "py06-rotating": {
      description: "Split the list immediately after its first three elements. Return the suffix followed by that three-element prefix without changing the input list.",
      success: [
        "Moves exactly the first three elements to the end",
        "Preserves the order inside both slices",
        "Leaves the caller's list unchanged",
      ],
      visual: "sequence",
      mode: "function",
      tests: [
        { id: "py06-rotate-basic", name: "Six elements", hidden: false, call: "rotate_list([1, 2, 3, 4, 5, 6])", expected: "[4, 5, 6, 1, 2, 3]" },
        { id: "py06-rotate-four", name: "Four elements", hidden: false, call: "rotate_list(['a', 'b', 'c', 'd'])", expected: "['d', 'a', 'b', 'c']" },
        { id: "py06-rotate-mutation", name: "Hidden input-preservation case", hidden: true, call: "(lambda items: (rotate_list(items), items))([1, 2, 3, 4])", expected: "([4, 1, 2, 3], [1, 2, 3, 4])" },
      ],
    },
    "py06-fibonacci": {
      description: "Return exactly the first n Fibonacci numbers beginning with 0 and then 1. Grow the list by adding its previous two values, with an empty list for n equal to zero.",
      success: [
        "Returns exactly n numbers",
        "Uses 0 and 1 as the starting values",
        "Handles zero and one without over-producing values",
      ],
      visual: "sequence",
      mode: "function",
      tests: [
        { id: "py06-fib-one", name: "One number", hidden: false, call: "fib(1)", expected: "[0]" },
        { id: "py06-fib-seven", name: "Seven numbers", hidden: false, call: "fib(7)", expected: "[0, 1, 1, 2, 3, 5, 8]" },
        { id: "py06-fib-zero", name: "Hidden boundary case", hidden: true, call: "fib(0)", expected: "[]" },
      ],
    },
    "py06-fetch-middle": {
      description: "Produce one result for every non-empty inner list in the same order. Keep the exact middle value for odd lengths and use the arithmetic mean of the two middle values for even lengths.",
      success: [
        "Selects one middle value from odd-length lists",
        "Averages the two central values in even-length lists",
        "Preserves non-integer middle values",
      ],
      visual: "sequence",
      mode: "function",
      tests: [
        { id: "py06-middle-mixed", name: "Odd and even lists", hidden: false, call: "fetch_middle([[1, 2, 3], [10, 20, 30, 40]])", expected: "[2, 25.0]" },
        { id: "py06-middle-single", name: "Singletons", hidden: false, call: "fetch_middle([[7], [-2]])", expected: "[7, -2]" },
        { id: "py06-middle-float", name: "Hidden value-preservation case", hidden: true, call: "fetch_middle([[1.0, 2.5, 9.0]])", expected: "[2.5]" },
      ],
    },
    "py06-bagdiff": {
      description: "Compute multiset difference by consuming at most one matching occurrence in xs for each value in ys. Return a new remaining list and leave both caller-owned inputs unchanged.",
      success: [
        "Removes one occurrence per matching ys value",
        "Handles repeated values without skipping",
        "Does not mutate either input list",
      ],
      visual: "sequence",
      mode: "function",
      tests: [
        { id: "py06-bag-basic", name: "Bag subtraction", hidden: false, call: "bagdiff([1, 2, 2, 3], [2, 3])", expected: "[1, 2]" },
        { id: "py06-bag-duplicates", name: "Repeated removals", hidden: false, call: "bagdiff([1, 2, 2, 2, 3], [2, 2])", expected: "[1, 2, 3]" },
        { id: "py06-bag-mutation", name: "Hidden input-preservation case", hidden: true, call: "(lambda xs, ys: (bagdiff(xs, ys), xs, ys))([1, 2, 2], [2, 2])", expected: "([1], [1, 2, 2], [2, 2])" },
      ],
    },
    "py06-nth-lowest": {
      description: "Return the value at one-based rank n when all list positions, including duplicates, are ordered from smallest to greatest. The selection algorithm may use a working copy but must preserve the caller's list.",
      success: [
        "Interprets n as a one-based rank",
        "Counts duplicates as separate positions",
        "Leaves the original list unchanged",
      ],
      visual: "search",
      mode: "function",
      tests: [
        { id: "py06-nth-basic", name: "Third lowest", hidden: false, call: "nth_lowest([8, 3, 5, 1], 3)", expected: "5" },
        { id: "py06-nth-duplicate", name: "Duplicate positions", hidden: false, call: "nth_lowest([4, 1, 1, 3], 2)", expected: "1" },
        { id: "py06-nth-mutation", name: "Hidden input-preservation case", hidden: true, call: "(lambda values: (nth_lowest(values, 2), values))([3, 1, 2])", expected: "(2, [3, 1, 2])" },
      ],
    },
    "py06-orthogonal-matrices": {
      description: "A 2 by 2 matrix is orthogonal when multiplying it by its transpose yields the identity matrix. Calculate all four dot products and return one Boolean result.",
      success: [
        "Builds or addresses the transpose correctly",
        "Checks every cell of the product",
        "Rejects matrices whose rows are not orthonormal",
      ],
      visual: "math",
      mode: "function",
      tests: [
        { id: "py06-orthogonal-identity", name: "Identity matrix", hidden: false, call: "is_orthogonal([[1, 0], [0, 1]])", expected: "True" },
        { id: "py06-orthogonal-rotation", name: "Quarter rotation", hidden: false, call: "is_orthogonal([[0, -1], [1, 0]])", expected: "True" },
        { id: "py06-orthogonal-false", name: "Hidden non-orthogonal case", hidden: true, call: "is_orthogonal([[1, 1], [0, 1]])", expected: "False" },
      ],
    },
    "py06-pattern-hunting": {
      description: "Treat equal indexes in the two lists as pairs and collect the opposite item whenever either side contains the pattern. Include every qualifying contribution and sort the completed result in descending lexicographic order.",
      success: [
        "Checks matches from both parallel lists",
        "Collects the paired value at the same index",
        "Sorts the final collection in descending order",
      ],
      visual: "mapping",
      mode: "function",
      tests: [
        { id: "py06-pattern-basic", name: "Matches on both sides", hidden: false, call: "pattern_hunting(['red fox', 'blue'], ['green', 'fox den'], 'fox')", expected: "['green', 'blue']" },
        { id: "py06-pattern-none", name: "No matches", hidden: false, call: "pattern_hunting(['cat'], ['dog'], 'owl')", expected: "[]" },
        { id: "py06-pattern-overlap", name: "Hidden paired-match case", hidden: true, call: "pattern_hunting(['aa', 'z'], ['aa', 'a'], 'a')", expected: "['z', 'aa', 'aa']" },
      ],
    },
    "py06-minimizing-path": {
      description: "Cancel adjacent UP/DOWN and LEFT/RIGHT pairs until no new cancellation is exposed. A stack-shaped result handles cascading cancellations while preserving all non-opposite moves.",
      success: [
        "Cancels opposite moves only when adjacent",
        "Rechecks the new boundary after a cancellation",
        "Returns an empty list for a fully cancelled or empty path",
      ],
      visual: "sequence",
      mode: "function",
      tests: [
        { id: "py06-path-basic", name: "Simple cancellation", hidden: false, call: "min_path(['UP', 'DOWN', 'LEFT'])", expected: "['LEFT']" },
        { id: "py06-path-cascade", name: "Cascading cancellation", hidden: false, call: "min_path(['UP', 'LEFT', 'RIGHT', 'DOWN'])", expected: "[]" },
        { id: "py06-path-empty", name: "Hidden empty case", hidden: true, call: "min_path([])", expected: "[]" },
      ],
    },
    "py06-last-man-standing": {
      description: "Repeatedly remove every step-th person while treating the remaining list as circular. Continue from the item after each removal and return the sole survivor.",
      success: [
        "Wraps positions with modulo after every removal",
        "Continues counting from the shifted removal index",
        "Returns the only item immediately for a singleton list",
      ],
      visual: "loop",
      mode: "function",
      tests: [
        { id: "py06-josephus-four", name: "Four people", hidden: false, call: "last_man_standing(['A', 'B', 'C', 'D'], 2)", expected: "'A'" },
        { id: "py06-josephus-seven", name: "Classic Josephus", hidden: false, call: "last_man_standing([1, 2, 3, 4, 5, 6, 7], 3)", expected: "4" },
        { id: "py06-josephus-one", name: "Hidden singleton case", hidden: true, call: "last_man_standing(['only'], 5)", expected: "'only'" },
      ],
    },

    "py07-academy-awards": {
      description: "Use the second field of every award record as the category to count. Return one dictionary entry per distinct category with its total frequency.",
      success: [
        "Reads the category from record index one",
        "Accumulates repeated categories",
        "Returns an empty dictionary for no records",
      ],
      visual: "mapping",
      mode: "function",
      tests: [
        { id: "py07-awards-basic", name: "Repeated winners", hidden: false, call: "academy_awards([('Film A', 'Ana'), ('Film B', 'Bo'), ('Film C', 'Ana')])", expected: "{'Ana': 2, 'Bo': 1}" },
        { id: "py07-awards-one", name: "Single record", hidden: false, call: "academy_awards([(2026, 'Best Picture')])", expected: "{'Best Picture': 1}" },
        { id: "py07-awards-empty", name: "Hidden empty case", hidden: true, call: "academy_awards([])", expected: "{}" },
      ],
    },
    "py07-lost-element": {
      description: "The two input sets differ by exactly one member, which belongs to one set but not both. Return that sole member from their symmetric difference.",
      success: [
        "Finds an item missing from either side",
        "Ignores all shared set members",
        "Returns the value itself rather than a set",
      ],
      visual: "mapping",
      mode: "function",
      tests: [
        { id: "py07-lost-right", name: "Extra on right", hidden: false, call: "lost_element({1, 2, 3}, {1, 2, 3, 9})", expected: "9" },
        { id: "py07-lost-left", name: "Extra on left", hidden: false, call: "lost_element({'a', 'b'}, {'a'})", expected: "'b'" },
        { id: "py07-lost-tuple", name: "Hidden hashable-value case", hidden: true, call: "lost_element({(1, 2)}, {(1, 2), (3, 4)})", expected: "(3, 4)" },
      ],
    },
    "py07-most-frequent": {
      description: "Build a frequency count for every list value and find the largest count. When multiple values share that count, return the greatest tied value.",
      success: [
        "Counts all occurrences of each value",
        "Selects the value with maximum frequency",
        "Breaks frequency ties with max",
      ],
      visual: "mapping",
      mode: "function",
      tests: [
        { id: "py07-frequent-basic", name: "Clear winner", hidden: false, call: "most_frequent([2, 1, 2, 3, 2, 1])", expected: "2" },
        { id: "py07-frequent-tie", name: "Greatest tied value", hidden: false, call: "most_frequent([1, 2, 1, 2])", expected: "2" },
        { id: "py07-frequent-negative", name: "Hidden negative-value case", hidden: true, call: "most_frequent([-3, -2, -3, -2])", expected: "-2" },
      ],
    },
    "py07-sort-by-value": {
      description: "Sort the dictionary's complete key-value item pairs by their values in ascending order. Preserve every distinct key when values tie and rely on stable input order for tied items.",
      success: [
        "Returns a list of key-value tuples",
        "Orders items by ascending value",
        "Preserves every key when two values are equal",
      ],
      visual: "mapping",
      mode: "function",
      tests: [
        { id: "py07-sort-basic", name: "Distinct values", hidden: false, call: "sort_by_value({'high': 9, 'low': 1, 'mid': 4})", expected: "[('low', 1), ('mid', 4), ('high', 9)]" },
        { id: "py07-sort-ties", name: "Duplicate values", hidden: false, call: "sort_by_value({'first': 2, 'second': 1, 'third': 2})", expected: "[('second', 1), ('first', 2), ('third', 2)]" },
        { id: "py07-sort-all-tied", name: "Hidden all-tied case", hidden: true, call: "sort_by_value({'a': 0, 'b': 0, 'c': 0})", expected: "[('a', 0), ('b', 0), ('c', 0)]" },
      ],
    },
    "py07-complete-pairs": {
      description: "Combine every string from the first list with every string from the second list. Keep concatenations whose set of lowercase letters covers the entire alphabet, regardless of repeated characters or extra nonletters.",
      success: [
        "Visits the full Cartesian product",
        "Requires every letter a through z",
        "Returns unique qualifying concatenations as a set",
      ],
      visual: "mapping",
      mode: "function",
      tests: [
        { id: "py07-pairs-complete", name: "One complete pair", hidden: false, call: "complete_pairs(['abcdefghijklm'], ['nopqrstuvwxyz'])", expected: "{'abcdefghijklmnopqrstuvwxyz'}" },
        { id: "py07-pairs-none", name: "No complete pair", hidden: false, call: "complete_pairs(['abc', 'xyz'], ['def'])", expected: "set()" },
        { id: "py07-pairs-extra", name: "Hidden nonletter case", hidden: true, call: "complete_pairs(['abcdefghijklmn!'], ['opqrstuvwxyz'])", expected: "{'abcdefghijklmn!opqrstuvwxyz'}" },
      ],
    },
    "py07-change": {
      description: "Convert the euro amount to integer cents before applying the greedy coin order from two euros down to one cent. Return every denomination with its count, including denominations used zero times.",
      success: [
        "Uses the largest affordable coin repeatedly",
        "Accounts for the amount exactly to the cent",
        "Includes zero counts for unused denominations",
      ],
      visual: "math",
      mode: "function",
      tests: [
        { id: "py07-change-basic", name: "Several denominations", hidden: false, call: "change(3.88)", expected: "{2.0: 1, 1.0: 1, 0.5: 1, 0.2: 1, 0.1: 1, 0.05: 1, 0.02: 1, 0.01: 1}" },
        { id: "py07-change-zero", name: "Zero amount", hidden: false, call: "change(0)", expected: "{2.0: 0, 1.0: 0, 0.5: 0, 0.2: 0, 0.1: 0, 0.05: 0, 0.02: 0, 0.01: 0}" },
        { id: "py07-change-cents", name: "Hidden exact-cent case", hidden: true, call: "change(0.29)", expected: "{2.0: 0, 1.0: 0, 0.5: 0, 0.2: 1, 0.1: 0, 0.05: 1, 0.02: 2, 0.01: 0}" },
      ],
    },
    "py07-treasure": {
      description: "Start at coordinate (0, 0) and repeatedly use the current coordinate as a clue key. Return the first coordinate with no outgoing clue while leaving the supplied clue dictionary unchanged.",
      success: [
        "Follows chained coordinate values in order",
        "Stops at the first coordinate absent as a key",
        "Does not consume entries from the caller's dictionary",
      ],
      visual: "mapping",
      mode: "function",
      tests: [
        { id: "py07-treasure-chain", name: "Clue chain", hidden: false, call: "treasure({(0, 0): (1, 2), (1, 2): (4, 5)})", expected: "(4, 5)" },
        { id: "py07-treasure-none", name: "No starting clue", hidden: false, call: "treasure({(2, 2): (3, 3)})", expected: "(0, 0)" },
        { id: "py07-treasure-mutation", name: "Hidden input-preservation case", hidden: true, call: "(lambda clues: (treasure(clues), clues))({(0, 0): (1, 1)})", expected: "((1, 1), {(0, 0): (1, 1)})" },
      ],
    },
    "py07-heroes-villains": {
      description: "Only heroes in the villain's category can fight, and they attack in list order. A strong-enough hero wins immediately; otherwise each matching hero removes half their health from the villain before the final message.",
      success: [
        "Skips heroes from a different category",
        "Awards one score in the hero victory message",
        "Rounds the surviving villain's health to one decimal place",
      ],
      visual: "loop",
      mode: "function",
      tests: [
        { id: "py07-fight-hero", name: "Hero victory", hidden: false, call: "fight([{'name': 'Lina', 'category': 'mage', 'health': 80, 'score': 2}], {'name': 'Void', 'category': 'mage', 'health': 70})", expected: "'Lina defeated the villain and now has a score of 3'" },
        { id: "py07-fight-villain", name: "Villain survives", hidden: false, call: "fight([{'name': 'Rui', 'category': 'tank', 'health': 30, 'score': 0}], {'name': 'Ogre', 'category': 'tank', 'health': 50})", expected: "'Ogre prevailed with 35.0HP left'" },
        { id: "py07-fight-skip", name: "Hidden category case", hidden: true, call: "fight([{'name': 'Archer', 'category': 'range', 'health': 100, 'score': 4}], {'name': 'Wisp', 'category': 'magic', 'health': 20})", expected: "'Wisp prevailed with 20HP left'" },
      ],
    },
    "py07-budgeting": {
      description: "Consider requested products from highest unit price to lowest and buy up to each wished quantity while funds permit. If one product is unaffordable, skip it and continue checking cheaper requested products.",
      success: [
        "Ignores products absent from the wishlist",
        "Processes requested products by descending price",
        "Never exceeds either the budget or requested quantity",
      ],
      visual: "mapping",
      mode: "function",
      tests: [
        { id: "py07-budget-basic", name: "Greedy purchases", hidden: false, call: "budgeting(20, {'book': 8, 'pen': 2, 'bag': 15}, {'book': 2, 'pen': 3})", expected: "{'book': 2, 'pen': 2}" },
        { id: "py07-budget-exact", name: "Exact budget", hidden: false, call: "budgeting(10, {'tea': 5, 'cake': 3}, {'tea': 2, 'cake': 1})", expected: "{'tea': 2}" },
        { id: "py07-budget-skip", name: "Hidden unaffordable-item case", hidden: true, call: "budgeting(4, {'coat': 10, 'sock': 2}, {'coat': 1, 'sock': 2})", expected: "{'sock': 2}" },
      ],
    },
    "py07-tfidf": {
      description: "Lowercase and tokenize every document, then build one score vector per distinct word. Multiply raw term frequency by log(document count divided by document frequency) and round every score to three decimals.",
      success: [
        "Counts repeated terms within each document",
        "Counts document frequency once per containing document",
        "Returns one vector position per input document",
      ],
      visual: "mapping",
      mode: "function",
      tests: [
        { id: "py07-tfidf-basic", name: "Shared and unique words", hidden: false, call: "tfidf(['Cat sat', 'Cat'])", expected: "{'cat': [0.0, 0.0], 'sat': [0.693, 0.0]}" },
        { id: "py07-tfidf-frequency", name: "Raw term frequency", hidden: false, call: "tfidf(['red red blue', 'blue green'])", expected: "{'red': [1.386, 0.0], 'blue': [0.0, 0.0], 'green': [0.0, 0.693]}" },
        { id: "py07-tfidf-case", name: "Hidden lowercase case", hidden: true, call: "tfidf(['PYTHON', 'python code'])", expected: "{'python': [0.0, 0.0], 'code': [0.0, 0.693]}" },
      ],
    },
  });
})();
