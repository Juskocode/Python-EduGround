(() => {
  window.EXERCISE_TESTS = window.EXERCISE_TESTS || {};

  Object.assign(window.EXERCISE_TESTS, {
    "py08-sum-digits": {
      description: "Reduce a non-negative integer one decimal digit at a time, then add the partial answers as the recursive calls return. Keep a one-digit value as the base case so every larger input makes clear progress toward termination.",
      success: [
        "Returns a one-digit input unchanged",
        "Includes every digit, including zeros between non-zero digits",
        "Uses a smaller integer in each recursive call",
      ],
      visual: "recursion",
      mode: "function",
      tests: [
        { id: "py08-sum-digits-single", name: "Single digit base case", hidden: false, call: "sum_digits_rec(7)", expected: "7" },
        { id: "py08-sum-digits-many", name: "Several digits", hidden: false, call: "sum_digits_rec(12345)", expected: "15" },
        { id: "py08-sum-digits-hidden", name: "Additional case", hidden: true, call: "sum_digits_rec(1002003)", expected: "6" },
      ],
    },

    "py08-gcd": {
      description: "Apply Euclid's algorithm by replacing a pair of integers with the divisor and the remainder. Stop when the remainder is zero and return the last non-zero divisor.",
      success: [
        "Returns the common divisor when the division is exact",
        "Handles inputs that require several remainder steps",
        "Produces a divisor of both original positive integers",
      ],
      visual: "math",
      mode: "function",
      tests: [
        { id: "py08-gcd-common", name: "Common factors", hidden: false, call: "gcd_rec(48, 18)", expected: "6" },
        { id: "py08-gcd-exact", name: "Exact division", hidden: false, call: "gcd_rec(21, 7)", expected: "7" },
        { id: "py08-gcd-hidden", name: "Additional case", hidden: true, call: "gcd_rec(270, 192)", expected: "6" },
      ],
    },

    "py08-find-treasure": {
      description: "Treat the coordinate and remaining directions as the complete state of the search. Apply exactly one direction before recursing, and return the current coordinate when no steps remain.",
      success: [
        "Leaves the starting coordinate unchanged for an empty route",
        "Moves one unit on the correct axis for each direction",
        "Consumes the route in its original order",
      ],
      visual: "sequence",
      mode: "function",
      tests: [
        { id: "py08-find-treasure-empty", name: "Empty route", hidden: false, call: "find_treasure((4, -2), [])", expected: "(4, -2)" },
        { id: "py08-find-treasure-route", name: "Mixed route", hidden: false, call: "find_treasure((2, -1), ['up', 'right', 'right', 'down', 'left'])", expected: "(3, -1)" },
        { id: "py08-find-treasure-hidden", name: "Additional case", hidden: true, call: "find_treasure((-2, 4), ['down', 'down', 'left', 'up'])", expected: "(-3, 3)" },
      ],
    },

    "py08-juggler": {
      description: "Generate the Juggler sequence recursively, where even terms use the floored square root and odd terms use the floored three-halves power. Interpret p as a zero-based position so p equal to zero returns the starting value.",
      success: [
        "Returns n at sequence position zero",
        "Applies the parity rule to the preceding term",
        "Floors each computed power to an integer",
      ],
      visual: "sequence",
      mode: "function",
      tests: [
        { id: "py08-juggler-start", name: "Starting term", hidden: false, call: "juggler(9, 0)", expected: "9" },
        { id: "py08-juggler-steps", name: "Alternating rules", hidden: false, call: "juggler(9, 4)", expected: "36" },
        { id: "py08-juggler-hidden", name: "Additional case", hidden: true, call: "juggler(3, 5)", expected: "2" },
      ],
    },

    "py08-biggest-member": {
      description: "Visit every tuple nested inside the input and compare tuples by their own direct number of members. Keep the outermost earlier candidate when two tuples have the same length, replacing it only with a strictly longer tuple.",
      success: [
        "Returns the input when no longer nested tuple exists",
        "Finds a longer tuple at any nesting depth",
        "Keeps the current outer candidate when lengths tie",
      ],
      visual: "recursion",
      mode: "function",
      tests: [
        { id: "py08-biggest-flat", name: "Flat tuple", hidden: false, call: "biggest_member((1, 2, 3))", expected: "(1, 2, 3)" },
        { id: "py08-biggest-nested", name: "Longer nested tuple", hidden: false, call: "biggest_member((1, (2, 3, 4, 5)))", expected: "(2, 3, 4, 5)" },
        { id: "py08-biggest-hidden", name: "Additional case", hidden: true, call: "biggest_member(((1, 2), (3, 4)))", expected: "((1, 2), (3, 4))" },
      ],
    },

    "py08-digits-average": {
      description: "Build a shorter integer by replacing every adjacent pair of digits with the ceiling of its average. Repeat that full reduction recursively until only one digit remains.",
      success: [
        "Returns an existing one-digit value immediately",
        "Uses overlapping adjacent pairs in their original order",
        "Rounds every pair average upward before the next pass",
      ],
      visual: "recursion",
      mode: "function",
      tests: [
        { id: "py08-digits-average-base", name: "One digit", hidden: false, call: "digits_average(8)", expected: "8" },
        { id: "py08-digits-average-chain", name: "Repeated reductions", hidden: false, call: "digits_average(1234)", expected: "4" },
        { id: "py08-digits-average-hidden", name: "Additional case", hidden: true, call: "digits_average(13579)", expected: "5" },
      ],
    },

    "py08-no-pairs-of-ones": {
      description: "Count binary strings of length k that never contain two adjacent ones by splitting them according to their valid ending. The resulting recurrence is Fibonacci shifted by two positions, including one valid empty string at k equal to zero.",
      success: [
        "Counts the empty string when k is zero",
        "Matches the shifted Fibonacci recurrence for positive lengths",
        "Returns an integer count rather than constructing the strings",
      ],
      visual: "recursion",
      mode: "function",
      tests: [
        { id: "py08-no-pairs-empty", name: "Empty binary string", hidden: false, call: "no_consecutives1(0)", expected: "1" },
        { id: "py08-no-pairs-four", name: "Length four", hidden: false, call: "no_consecutives1(4)", expected: "8" },
        { id: "py08-no-pairs-hidden", name: "Additional case", hidden: true, call: "no_consecutives1(10)", expected: "144" },
      ],
    },

    "py08-preorder": {
      description: "Interpret nested tuples as ordered tree structure and emit ordinary values as soon as they are encountered. Recurse into each nested tuple from left to right while treating None placeholders as absent nodes.",
      success: [
        "Returns values in root-before-children order",
        "Flattens nested tuples at more than one depth",
        "Omits every None placeholder from the result",
      ],
      visual: "recursion",
      mode: "function",
      tests: [
        { id: "py08-preorder-leaf", name: "Single leaf", hidden: false, call: "preorder((7,))", expected: "[7]" },
        { id: "py08-preorder-tree", name: "Nested tree", hidden: false, call: "preorder((1, (2, None, 3), (4, (5,), None)))", expected: "[1, 2, 3, 4, 5]" },
        { id: "py08-preorder-hidden", name: "Additional case", hidden: true, call: "preorder((None, (1, (None, 2), 3), None))", expected: "[1, 2, 3]" },
      ],
    },

    "py08-last-man-standing": {
      description: "Model Josephus elimination by counting step positions cyclically and removing the selected participant. Continue recursively with the next participant until the list contains one survivor.",
      success: [
        "Returns the only participant without further elimination",
        "Wraps counting correctly when step exceeds the remaining length",
        "Removes exactly one participant per recursive call",
      ],
      visual: "loop",
      mode: "function",
      tests: [
        { id: "py08-last-man-single", name: "Single survivor", hidden: false, call: "last_man_standing([1], 5)", expected: "1" },
        { id: "py08-last-man-five", name: "Five participants", hidden: false, call: "last_man_standing([1, 2, 3, 4, 5], 2)", expected: "3" },
        { id: "py08-last-man-hidden", name: "Additional case", hidden: true, call: "last_man_standing(['A', 'B', 'C', 'D'], 2)", expected: "'A'" },
      ],
    },

    "py08-unordered-permutations": {
      description: "Choose each tuple position as the next prefix and recursively permute the remaining positions. Collect complete tuples in a set so repeated input values do not create duplicate results, and define the empty tuple as having one empty permutation.",
      success: [
        "Returns a set containing the singleton input",
        "Produces every ordering exactly once",
        "Returns a set containing the empty tuple for empty input",
      ],
      visual: "recursion",
      mode: "function",
      tests: [
        { id: "py08-permutations-single", name: "Singleton permutation", hidden: false, call: "permutations(('x',))", expected: "{('x',)}" },
        { id: "py08-permutations-three", name: "Three distinct values", hidden: false, call: "permutations((1, 2, 3))", expected: "{(1, 2, 3), (1, 3, 2), (2, 1, 3), (2, 3, 1), (3, 1, 2), (3, 2, 1)}" },
        { id: "py08-permutations-hidden", name: "Additional case", hidden: true, call: "permutations(())", expected: "{()}" },
      ],
    },

    "py08-knapsack": {
      description: "Choose quantities no greater than the wishlist limits while keeping their total product price within the available money. Among feasible choices, return the product counts whose total spend is greatest, without inventing an unaffordable item.",
      success: [
        "Never exceeds either the budget or a wishlist quantity",
        "Returns an empty dictionary when no requested unit is affordable",
        "Selects the feasible combination with the greatest total price",
      ],
      visual: "search",
      mode: "function",
      tests: [
        { id: "py08-knapsack-quantity", name: "Affordable quantities", hidden: false, call: "knapsack(10, {'apple': 3}, {'apple': 2})", expected: "{'apple': 2}" },
        { id: "py08-knapsack-unaffordable", name: "Nothing affordable", hidden: false, call: "knapsack(5, {'book': 6}, {'book': 1})", expected: "{}" },
        { id: "py08-knapsack-hidden", name: "Additional case", hidden: true, call: "knapsack(10, {'book': 7, 'pen': 6}, {'book': 1, 'pen': 1})", expected: "{'book': 1}" },
      ],
    },

    "py09-fahrenheit": {
      description: "Transform each Celsius value independently with c times nine-fifths plus 32 by using map. Materialize the mapped values as a new list and round each result to two decimal places.",
      success: [
        "Converts freezing and boiling reference points correctly",
        "Preserves the input order in a new list",
        "Rounds each Fahrenheit result to two decimal places",
      ],
      visual: "functional",
      mode: "function",
      tests: [
        { id: "py09-fahrenheit-reference", name: "Reference temperatures", hidden: false, call: "to_fahrenheit([0, 100, -40])", expected: "[32.0, 212.0, -40.0]" },
        { id: "py09-fahrenheit-empty", name: "Empty collection", hidden: false, call: "to_fahrenheit([])", expected: "[]" },
        { id: "py09-fahrenheit-hidden", name: "Additional case", hidden: true, call: "to_fahrenheit([37.5])", expected: "[99.5]" },
      ],
    },

    "py09-celsius": {
      description: "Transform each Fahrenheit value independently by subtracting 32 and multiplying by five-ninths with map. Return a materialized list in the original order and round each Celsius result to one decimal place.",
      success: [
        "Converts standard reference temperatures correctly",
        "Applies subtraction before scaling",
        "Returns a list rounded to one decimal place",
      ],
      visual: "functional",
      mode: "function",
      tests: [
        { id: "py09-celsius-reference", name: "Reference temperatures", hidden: false, call: "to_celsius([32, 212, -40])", expected: "[0.0, 100.0, -40.0]" },
        { id: "py09-celsius-empty", name: "Empty collection", hidden: false, call: "to_celsius([])", expected: "[]" },
        { id: "py09-celsius-hidden", name: "Additional case", hidden: true, call: "to_celsius([451])", expected: "[232.8]" },
      ],
    },

    "py09-polynomials": {
      description: "Treat the coefficient at index i as the multiplier of x raised to i, so coefficients are ordered from constant term upward. Pair indexes with coefficients, map them to terms, and sum the complete polynomial.",
      success: [
        "Uses zero as the exponent of the first coefficient",
        "Evaluates every coefficient at the supplied x",
        "Returns zero for an empty coefficient collection",
      ],
      visual: "math",
      mode: "function",
      tests: [
        { id: "py09-polynomials-quadratic", name: "Quadratic polynomial", hidden: false, call: "evaluate([1, 2, 3], 2)", expected: "17" },
        { id: "py09-polynomials-empty", name: "No coefficients", hidden: false, call: "evaluate([], 10)", expected: "0" },
        { id: "py09-polynomials-hidden", name: "Additional case", hidden: true, call: "evaluate([2, -1, 4], -2)", expected: "20" },
      ],
    },

    "py09-rearranging": {
      description: "Partition the values stably into a non-positive group followed by a positive group using complementary filters. Preserve the relative order inside both groups and leave the source collection untouched.",
      success: [
        "Places zero with the non-positive values",
        "Preserves the original order inside each partition",
        "Returns a new list for empty and populated inputs",
      ],
      visual: "functional",
      mode: "function",
      tests: [
        { id: "py09-rearranging-mixed", name: "Mixed signs", hidden: false, call: "rearrange([3, -1, 0, 2, -4])", expected: "[-1, 0, -4, 3, 2]" },
        { id: "py09-rearranging-empty", name: "Empty list", hidden: false, call: "rearrange([])", expected: "[]" },
        { id: "py09-rearranging-hidden", name: "Additional case", hidden: true, call: "rearrange([2, -2, 2, -1, 0])", expected: "[-2, -1, 0, 2, 2]" },
      ],
    },

    "py09-map-filter-reduce": {
      description: "Build one functional pipeline that first keeps values accepted by f1, then transforms them with f2, and finally combines them with f3. The reducer receives the mapped survivors in their original order and the contract assumes at least one value survives.",
      success: [
        "Never maps a value rejected by the predicate",
        "Reduces transformed values from left to right",
        "Works with caller-supplied callbacks and value types",
      ],
      visual: "functional",
      mode: "function",
      tests: [
        { id: "py09-mfr-numbers", name: "Filter and sum squares", hidden: false, call: "map_filter_reduce([1, 2, 3, 4], lambda x: x % 2 == 0, lambda x: x * x, lambda a, b: a + b)", expected: "20" },
        { id: "py09-mfr-strings", name: "Transform and join text", hidden: false, call: "map_filter_reduce(['a', 'bb', 'ccc'], lambda s: len(s) > 1, lambda s: s.upper(), lambda a, b: a + '-' + b)", expected: "'BB-CCC'" },
        { id: "py09-mfr-hidden", name: "Additional case", hidden: true, call: "map_filter_reduce([-2, -1, 0, 1, 2, 3], lambda x: x > 0, lambda x: x + 1, lambda a, b: a * b)", expected: "24" },
      ],
    },

    "py09-interval-generator": {
      description: "Yield each integer from every inclusive start-end interval without collapsing overlaps or repeated endpoints. Process intervals in the supplied order so callers can consume the expanded sequence lazily.",
      success: [
        "Includes both endpoints of each forward interval",
        "Preserves interval order, overlaps, and duplicates",
        "Produces no values for an empty interval list",
      ],
      visual: "sequence",
      mode: "function",
      tests: [
        { id: "py09-interval-one", name: "One inclusive interval", hidden: false, call: "list(generator([(2, 5)]))", expected: "[2, 3, 4, 5]" },
        { id: "py09-interval-empty", name: "No intervals", hidden: false, call: "list(generator([]))", expected: "[]" },
        { id: "py09-interval-hidden", name: "Additional case", hidden: true, call: "list(generator([(1, 3), (3, 4), (-1, 0)]))", expected: "[1, 2, 3, 3, 4, -1, 0]" },
      ],
    },

    "py10-fahrenheit": {
      description: "Create a fresh Fahrenheit list with a comprehension that applies c times nine-fifths plus 32 to each Celsius value. Round results to two decimal places and do not mutate the caller's collection.",
      success: [
        "Returns converted values in their original order",
        "Rounds each result to two decimal places",
        "Leaves the input collection unchanged",
      ],
      visual: "purity",
      mode: "function",
      tests: [
        { id: "py10-fahrenheit-values", name: "Mixed temperatures", hidden: false, call: "to_fahrenheit([-40, 20, 37.5])", expected: "[-40.0, 68.0, 99.5]" },
        { id: "py10-fahrenheit-empty", name: "Empty collection", hidden: false, call: "to_fahrenheit([])", expected: "[]" },
        { id: "py10-fahrenheit-hidden", name: "Additional case", hidden: true, call: "(lambda values: (to_fahrenheit(values), values))([0, 25])", expected: "([32.0, 77.0], [0, 25])" },
      ],
    },

    "py10-celsius": {
      description: "Create a fresh Celsius list with a comprehension that subtracts 32 before multiplying each Fahrenheit value by five-ninths. Round results to one decimal place and leave the source collection unchanged.",
      success: [
        "Converts each value with the correct operation order",
        "Rounds every result to one decimal place",
        "Does not change the caller's list",
      ],
      visual: "purity",
      mode: "function",
      tests: [
        { id: "py10-celsius-values", name: "Mixed temperatures", hidden: false, call: "to_celsius([32, 68, 86])", expected: "[0.0, 20.0, 30.0]" },
        { id: "py10-celsius-empty", name: "Empty collection", hidden: false, call: "to_celsius([])", expected: "[]" },
        { id: "py10-celsius-hidden", name: "Additional case", hidden: true, call: "(lambda values: (to_celsius(values), values))([212, -40])", expected: "([100.0, -40.0], [212, -40])" },
      ],
    },

    "py10-polynomials": {
      description: "Evaluate ascending-order coefficients by multiplying each value at index i by x raised to i. Use a comprehension to create the independent terms and sum them without changing the coefficients.",
      success: [
        "Treats the first coefficient as the constant term",
        "Supports negative coefficients and x values",
        "Returns zero when the coefficient list is empty",
      ],
      visual: "purity",
      mode: "function",
      tests: [
        { id: "py10-polynomials-cubic", name: "Cubic polynomial", hidden: false, call: "evaluate([3, 0, 2, 1], 2)", expected: "19" },
        { id: "py10-polynomials-empty", name: "No coefficients", hidden: false, call: "evaluate([], -3)", expected: "0" },
        { id: "py10-polynomials-hidden", name: "Additional case", hidden: true, call: "evaluate([2, -1, 4], -2)", expected: "20" },
      ],
    },

    "py10-rearranging": {
      description: "Construct one list of non-positive values and one list of positive values, then concatenate them into a stable partition. Comprehension traversal must preserve order and must not modify the original list.",
      success: [
        "Places negative values and zero before positives",
        "Keeps the relative order inside both groups",
        "Returns a new result while preserving the input",
      ],
      visual: "purity",
      mode: "function",
      tests: [
        { id: "py10-rearranging-mixed", name: "Stable partition", hidden: false, call: "rearrange([4, -3, 0, 2, -1])", expected: "[-3, 0, -1, 4, 2]" },
        { id: "py10-rearranging-one-group", name: "Only positives", hidden: false, call: "rearrange([3, 1, 2])", expected: "[3, 1, 2]" },
        { id: "py10-rearranging-hidden", name: "Additional case", hidden: true, call: "(lambda values: (rearrange(values), values))([2, -1, 0])", expected: "([-1, 0, 2], [2, -1, 0])" },
      ],
    },

    "py10-composites": {
      description: "Lazily yield integers from 4 through n that have at least one divisor other than one and themselves. Stop testing divisors after the first match so every composite appears exactly once.",
      success: [
        "Yields no values below the first composite number",
        "Includes n when n itself is composite",
        "Never yields primes or duplicate composites",
      ],
      visual: "functional",
      mode: "function",
      tests: [
        { id: "py10-composites-below", name: "Below four", hidden: false, call: "list(get_composites(3))", expected: "[]" },
        { id: "py10-composites-ten", name: "Through ten", hidden: false, call: "list(get_composites(10))", expected: "[4, 6, 8, 9, 10]" },
        { id: "py10-composites-hidden", name: "Additional case", hidden: true, call: "list(get_composites(25))", expected: "[4, 6, 8, 9, 10, 12, 14, 15, 16, 18, 20, 21, 22, 24, 25]" },
      ],
    },

    "py10-batch-normalization": {
      description: "Slice the source into consecutive batches and subtract each batch's own median from all values in that batch. Compute the median from the actual slice length, including a final partial batch, and lazily yield new normalized lists.",
      success: [
        "Uses the middle value for an odd-sized batch",
        "Averages the middle pair for an even-sized batch",
        "Normalizes a partial final batch by its actual length",
      ],
      visual: "purity",
      mode: "function",
      tests: [
        { id: "py10-batch-even", name: "Even-sized batches", hidden: false, call: "list(batch_norm([1, 3, 5, 7], 2))", expected: "[[-1.0, 1.0], [-1.0, 1.0]]" },
        { id: "py10-batch-odd", name: "Odd-sized batch", hidden: false, call: "list(batch_norm([1, 2, 100], 3))", expected: "[[-1, 0, 98]]" },
        { id: "py10-batch-hidden", name: "Additional case", hidden: true, call: "list(batch_norm([1, 3, 5, 10, 14], 3))", expected: "[[-2, 0, 2], [-2.0, 2.0]]" },
      ],
    },

    "py10-shortening-numbers": {
      description: "Return a closure that maps numeric strings to the largest applicable base power and its matching suffix. Preserve unsupported values as text, and format zero explicitly with the base-unit suffix instead of falling through without a result.",
      success: [
        "Chooses the largest supported magnitude not exceeding the number",
        "Uses integer division before appending the matching suffix",
        "Returns text for invalid inputs and a base-unit result for zero",
      ],
      visual: "mapping",
      mode: "function",
      tests: [
        { id: "py10-shorten-thousand", name: "Thousands", hidden: false, call: "shorten(['units', 'thousand', 'million'], 1000)('1500')", expected: "'1 thousand'" },
        { id: "py10-shorten-invalid", name: "Unsupported text", hidden: false, call: "shorten(['units', 'thousand'], 1000)('unknown')", expected: "'unknown'" },
        { id: "py10-shorten-hidden", name: "Additional case", hidden: true, call: "shorten(['units', 'thousand', 'million'], 1000)('0')", expected: "'0 units'" },
      ],
    },

    "py11-bubble-sort": {
      description: "Make repeated left-to-right passes, swapping adjacent out-of-order values until a complete pass performs no swaps. Sort the caller's list in place and return that same list object after convergence.",
      success: [
        "Orders values from smallest to largest",
        "Handles duplicates and an already sorted list",
        "Mutates and returns the same list object",
      ],
      visual: "loop",
      mode: "function",
      tests: [
        { id: "py11-bubble-mixed", name: "Unsorted values", hidden: false, call: "bubble_sort([4, 1, 3, 2])", expected: "[1, 2, 3, 4]" },
        { id: "py11-bubble-duplicates", name: "Duplicates", hidden: false, call: "bubble_sort([3, 1, 3, 2, 1])", expected: "[1, 1, 2, 3, 3]" },
        { id: "py11-bubble-hidden", name: "Additional case", hidden: true, call: "(lambda values: (bubble_sort(values) is values, values))([2, 1])", expected: "(True, [1, 2])" },
      ],
    },

    "py11-count-zeros": {
      description: "Call f once to obtain a monotone sequence of ones followed by zeros, then locate the first zero as a binary-search boundary. Return the number of elements from that boundary to the end, with zero as the answer when the sequence contains only ones.",
      success: [
        "Returns the complete zero suffix length",
        "Handles transitions close to either end",
        "Works for an all-ones sequence without indexing an empty slice",
      ],
      visual: "search",
      mode: "function",
      tests: [
        { id: "py11-count-zeros-middle", name: "Central transition", hidden: false, call: "count_zeros(lambda: [1, 1, 1, 0, 0])", expected: "2" },
        { id: "py11-count-zeros-left", name: "Early transition", hidden: false, call: "count_zeros(lambda: [1, 0, 0, 0])", expected: "3" },
        { id: "py11-count-zeros-hidden", name: "Additional case", hidden: true, call: "count_zeros(lambda: [1, 1, 1, 1])", expected: "0" },
        { id: "py11-count-zeros-hidden-complexity", name: "Additional scale", hidden: true, call: "count_zeros(lambda: type('NoSliceList', (list,), {'__getitem__': lambda self, key: (_ for _ in ()).throw(AssertionError('slicing is linear')) if isinstance(key, slice) else list.__getitem__(self, key)})([1, 1, 1, 1, 0, 0, 0]))", expected: "3" },
      ],
    },

    "py11-bitonic-point": {
      description: "Call f once for a sequence that strictly rises and then falls, and use its slope around a midpoint to discard half of the search interval. Return the peak value for short, negative, and ordinary bitonic sequences without relying on a positive sentinel.",
      success: [
        "Returns the unique value where the slope changes direction",
        "Handles a peak close to either sequence edge",
        "Works when every value in the sequence is negative",
      ],
      visual: "search",
      mode: "function",
      tests: [
        { id: "py11-bitonic-wide", name: "Interior peak", hidden: false, call: "bitonic_point(lambda: [1, 3, 8, 12, 4, 2])", expected: "12" },
        { id: "py11-bitonic-compact", name: "Compact sequence", hidden: false, call: "bitonic_point(lambda: [2, 5, 11, 15, 8])", expected: "15" },
        { id: "py11-bitonic-hidden-negative", name: "Additional case", hidden: true, call: "bitonic_point(lambda: [-9, -3, -1, -4, -8])", expected: "-1" },
        { id: "py11-bitonic-hidden-edge", name: "Additional boundary", hidden: true, call: "bitonic_point(lambda: [1, 5, 2])", expected: "5" },
        { id: "py11-bitonic-hidden-complexity", name: "Additional scale", hidden: true, call: "(lambda seq: bitonic_point(lambda: seq))(type('ReadLimitedList', (list,), {'__init__': lambda self, values: (list.__init__(self, values), setattr(self, 'reads', 0))[0], '__getitem__': lambda self, key: (setattr(self, 'reads', self.reads + 1), (_ for _ in ()).throw(AssertionError('too many indexed reads')) if self.reads > 30 else list.__getitem__(self, key))[1]})(list(range(1024)) + [1022]))", expected: "1023" },
      ],
    },
  });
})();
