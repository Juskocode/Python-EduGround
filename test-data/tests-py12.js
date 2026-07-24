(() => {
  window.EXERCISE_TESTS = window.EXERCISE_TESTS || {};

  Object.assign(window.EXERCISE_TESTS, {
    "py12-two-sum": {
      description: "Scan from left to right and pair the current value with an earlier complement. Preserve the first index of each value so duplicates and multiple valid answers follow one deterministic discovery rule.",
      success: [
        "Returns indexes rather than the values stored at those indexes",
        "Never reuses one list position as both members of the pair",
        "Returns None when no earlier complement can complete the target",
      ],
      visual: "mapping",
      mode: "function",
      tests: [
        { id: "py12-two-sum-basic", name: "Pair near the front", hidden: false, call: "two_sum_indices([2, 7, 11, 15], 9)", expected: "(0, 1)" },
        { id: "py12-two-sum-duplicates", name: "Duplicate values", hidden: false, call: "two_sum_indices([3, 3], 6)", expected: "(0, 1)" },
        { id: "py12-two-sum-hidden-none", name: "No valid pair", hidden: true, call: "two_sum_indices([1, 4, 8], 20)", expected: "None" },
        { id: "py12-two-sum-hidden-order", name: "Earliest discovery", hidden: true, call: "two_sum_indices([1, 5, 2, 4, 3], 6)", expected: "(0, 1)" },
      ],
    },

    "py12-interval-scheduling": {
      description: "Order candidate intervals by finish time and accept each interval compatible with the last choice. The returned schedule must be deterministic and maximum-size under the half-open boundary rule.",
      success: [
        "Allows an interval to begin exactly when the previous interval finishes",
        "Uses finish time rather than duration or start time as the greedy priority",
        "Returns an empty schedule for an empty candidate collection",
      ],
      visual: "timeline",
      mode: "function",
      tests: [
        { id: "py12-intervals-chain", name: "Compatible chain", hidden: false, call: "select_intervals([(0, 3), (1, 2), (2, 4), (4, 7)])", expected: "[(1, 2), (2, 4), (4, 7)]" },
        { id: "py12-intervals-overlap", name: "Overlapping candidates", hidden: false, call: "select_intervals([(5, 9), (1, 4), (3, 5), (0, 6), (5, 7)])", expected: "[(1, 4), (5, 7)]" },
        { id: "py12-intervals-hidden-empty", name: "No intervals", hidden: true, call: "select_intervals([])", expected: "[]" },
        { id: "py12-intervals-hidden-ties", name: "Equal finish times", hidden: true, call: "select_intervals([(2, 5), (1, 5), (5, 6)])", expected: "[(1, 5), (5, 6)]" },
      ],
    },

    "py12-climbing-stairs": {
      description: "Count routes to each stair from the two immediately smaller route counts. Treat zero as one completed empty route and negative targets as unreachable.",
      success: [
        "Uses the specified base value for zero steps",
        "Combines one-step and two-step final moves",
        "Handles larger targets without exponential recursive repetition",
      ],
      visual: "recursion",
      mode: "function",
      tests: [
        { id: "py12-stairs-zero", name: "Ground level", hidden: false, call: "climbing_ways(0)", expected: "1" },
        { id: "py12-stairs-five", name: "Five steps", hidden: false, call: "climbing_ways(5)", expected: "8" },
        { id: "py12-stairs-hidden", name: "Larger staircase", hidden: true, call: "(climbing_ways(-2), climbing_ways(30))", expected: "(0, 1346269)" },
      ],
    },

    "py12-grid-paths": {
      description: "Build the number of right-and-down routes reaching each unblocked cell from its upper and left neighbours. A wall resets its cell to zero so no route can continue through it.",
      success: [
        "Counts the one route across a single open row or column",
        "Returns zero when the start or destination is blocked",
        "Does not count diagonal movement or movement through a wall",
      ],
      visual: "grid",
      mode: "function",
      tests: [
        { id: "py12-grid-open", name: "Open rectangle", hidden: false, call: "grid_paths(3, 4)", expected: "10" },
        { id: "py12-grid-wall", name: "Central wall", hidden: false, call: "grid_paths(3, 3, [(1, 1)])", expected: "2" },
        { id: "py12-grid-hidden-start", name: "Blocked start", hidden: true, call: "grid_paths(2, 2, [(0, 0)])", expected: "0" },
        { id: "py12-grid-hidden-shape", name: "Empty and narrow grids", hidden: true, call: "(grid_paths(0, 4), grid_paths(1, 5, [(0, 3)]))", expected: "(0, 0)" },
      ],
    },

    "py12-knapsack": {
      description: "Evaluate every item as a one-time include-or-skip decision while tracking the best value for each capacity. Updating capacities downward prevents the current item from being counted more than once.",
      success: [
        "Finds the best value rather than the greatest used weight",
        "May leave capacity unused when that produces the strongest selection",
        "Treats every item position as available at most once",
      ],
      visual: "grid",
      mode: "function",
      tests: [
        { id: "py12-knapsack-classic", name: "Classic capacity", hidden: false, call: "knapsack_value(5, [1, 2, 3], [6, 10, 12])", expected: "22" },
        { id: "py12-knapsack-choice", name: "One valuable item", hidden: false, call: "knapsack_value(4, [4, 2, 2], [9, 4, 4])", expected: "9" },
        { id: "py12-knapsack-hidden-empty", name: "Zero capacity", hidden: true, call: "knapsack_value(0, [1, 2], [5, 9])", expected: "0" },
        { id: "py12-knapsack-hidden-once", name: "No item reuse", hidden: true, call: "knapsack_value(6, [3, 4], [8, 9])", expected: "9" },
      ],
    },

    "py12-coin-change": {
      description: "Build the minimum number of reusable coins needed for every total up to the requested amount. Keep impossible totals distinguishable from valid counts and convert the final sentinel to -1.",
      success: [
        "Returns zero coins for an amount of zero",
        "Finds a non-greedy combination when it uses fewer coins",
        "Returns -1 when no denomination combination reaches the amount",
      ],
      visual: "grid",
      mode: "function",
      tests: [
        { id: "py12-coins-standard", name: "Reusable denominations", hidden: false, call: "minimum_coins([1, 2, 5], 11)", expected: "3" },
        { id: "py12-coins-greedy-trap", name: "Greedy counterexample", hidden: false, call: "minimum_coins([1, 3, 4], 6)", expected: "2" },
        { id: "py12-coins-hidden-impossible", name: "Impossible amount", hidden: true, call: "(minimum_coins([2], 3), minimum_coins([2], 0))", expected: "(-1, 0)" },
      ],
    },

    "py12-house-robber": {
      description: "At each value, compare the best total that skips the position with the total that takes it after skipping its neighbour. Carry only the two prefix states needed for the next decision.",
      success: [
        "Never combines values from adjacent positions",
        "Can choose alternating positions across the complete list",
        "Allows the empty selection for an empty input",
      ],
      visual: "timeline",
      mode: "function",
      tests: [
        { id: "py12-robber-alternate", name: "Alternating choices", hidden: false, call: "max_non_adjacent_sum([2, 7, 9, 3, 1])", expected: "12" },
        { id: "py12-robber-middle", name: "Strong middle values", hidden: false, call: "max_non_adjacent_sum([5, 1, 1, 5])", expected: "10" },
        { id: "py12-robber-hidden-empty", name: "Boundary inputs", hidden: true, call: "(max_non_adjacent_sum([]), max_non_adjacent_sum([8]))", expected: "(0, 8)" },
      ],
    },

    "py12-subset-sum": {
      description: "Track every subtotal reachable after each one-time include-or-skip decision. New totals must be derived from the previous reachable set so a list position cannot be reused.",
      success: [
        "Recognizes zero as reachable through the empty subset",
        "Combines non-adjacent and non-contiguous list positions",
        "Returns false when every subset misses the target",
      ],
      visual: "mapping",
      mode: "function",
      tests: [
        { id: "py12-subset-found", name: "Reachable target", hidden: false, call: "has_subset_sum([3, 34, 4, 12, 5, 2], 9)", expected: "True" },
        { id: "py12-subset-missing", name: "Unreachable target", hidden: false, call: "has_subset_sum([3, 34, 4, 12, 5, 2], 30)", expected: "False" },
        { id: "py12-subset-hidden-once", name: "Empty subset and no reuse", hidden: true, call: "(has_subset_sum([5], 0), has_subset_sum([5], 10))", expected: "(True, False)" },
      ],
    },

    "py12-lcs": {
      description: "Compare prefixes of two strings and store the strongest common-subsequence length at each boundary. Equal final characters extend a diagonal state, while unequal characters preserve the better shortened-prefix state.",
      success: [
        "Treats a subsequence as ordered but not necessarily contiguous",
        "Returns zero when either string is empty",
        "Handles repeated characters without using one position twice",
      ],
      visual: "grid",
      mode: "function",
      tests: [
        { id: "py12-lcs-classic", name: "Interleaved subsequence", hidden: false, call: "lcs_length('ABCBDAB', 'BDCABA')", expected: "4" },
        { id: "py12-lcs-empty", name: "Empty comparison", hidden: false, call: "lcs_length('', 'PYTHON')", expected: "0" },
        { id: "py12-lcs-hidden-repeat", name: "Repeated characters", hidden: true, call: "lcs_length('BANANA', 'ATANA')", expected: "4" },
      ],
    },

    "py12-edit-distance": {
      description: "Measure each prefix transformation through insertion, deletion, or replacement, charging zero when the final characters already match. Initialize empty-prefix distances explicitly before filling later rows.",
      success: [
        "Counts insertion, deletion, and replacement as one operation each",
        "Returns string length when transforming to or from empty text",
        "Uses aligned matching characters without adding an operation",
      ],
      visual: "grid",
      mode: "function",
      tests: [
        { id: "py12-edit-kitten", name: "Replacement and insertion", hidden: false, call: "edit_distance('kitten', 'sitting')", expected: "3" },
        { id: "py12-edit-empty", name: "Empty source", hidden: false, call: "edit_distance('', 'code')", expected: "4" },
        { id: "py12-edit-hidden-same", name: "Identical strings", hidden: true, call: "edit_distance('dynamic', 'dynamic')", expected: "0" },
        { id: "py12-edit-hidden-famous", name: "Mixed operations", hidden: true, call: "edit_distance('algorithm', 'altruistic')", expected: "6" },
      ],
    },
  });
})();
