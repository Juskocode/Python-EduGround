(() => {
  window.EXERCISE_TESTS = window.EXERCISE_TESTS || {};

  Object.assign(window.EXERCISE_TESTS, {
    "py13-direction-step": {
      description: "Translate one direction label into a two-dimensional offset, then add that offset to the current grid coordinate. Keep the function independent from Pygame so movement rules remain fast to test and easy to reuse.",
      success: [
        "Moves exactly one cell on the requested axis",
        "Honours a non-default cell size",
        "Leaves the position unchanged for an unknown direction",
      ],
      visual: "grid",
      mode: "function",
      tests: [
        { id: "py13-direction-visible-right", name: "Move right one cell", hidden: false, call: "direction_step((40, 60), 'right')", expected: "(60, 60)" },
        { id: "py13-direction-visible-up", name: "Custom-size upward step", hidden: false, call: "direction_step((18, 24), 'up', 6)", expected: "(18, 18)" },
        { id: "py13-direction-hidden-all", name: "Other directions and unknown input", hidden: true, call: "(direction_step((5, 5), 'left', 5), direction_step((5, 5), 'down', 5), direction_step((5, 5), 'pause', 5))", expected: "((0, 5), (5, 10), (5, 5))" },
      ],
    },

    "py13-screen-wrap": {
      description: "Map each coordinate back into the arena's half-open range after it crosses an edge. Python's modulo operation also wraps negative positions, avoiding separate branches for every side.",
      success: [
        "Wraps values equal to or beyond the width and height",
        "Wraps negative coordinates to the opposite edge",
        "Treats the horizontal and vertical axes independently",
      ],
      visual: "grid",
      mode: "function",
      sourceRules: [
        {
          id: "py13-wrap-uses-modulo",
          label: "Wrap both axes with modulo",
          target: "code",
          pattern: "%",
          minMatches: 2,
          passFeedback: "Both axes use the same half-open modulo rule.",
          failFeedback: "Use modulo once for x and once for y so negative and oversized values follow one rule.",
        },
      ],
      tests: [
        { id: "py13-wrap-visible-right", name: "Cross right edge", hidden: false, call: "wrap_position((320, 45), 320, 180)", expected: "(0, 45)" },
        { id: "py13-wrap-visible-negative", name: "Cross top and left", hidden: false, call: "wrap_position((-20, -1), 320, 180)", expected: "(300, 179)" },
        { id: "py13-wrap-hidden-large", name: "Several arena lengths away", hidden: true, call: "wrap_position((965, 544), 320, 180)", expected: "(5, 4)" },
      ],
    },

    "py13-snake-advance": {
      description: "Construct the next head-first Snake body from one previous frame. Food changes whether the old tail survives, while an empty input remains a safe boundary case.",
      success: [
        "Adds the new head in the requested direction",
        "Preserves the tail only when the new head reaches food",
        "Returns a new body without mutating the supplied list",
      ],
      visual: "grid",
      mode: "function",
      tests: [
        { id: "py13-snake-visible-move", name: "Ordinary movement", hidden: false, call: "advance_snake([(40, 20), (20, 20), (0, 20)], 'right', (100, 100))", expected: "([(60, 20), (40, 20), (20, 20)], False)" },
        { id: "py13-snake-visible-grow", name: "Food grows the body", hidden: false, call: "advance_snake([(20, 20), (0, 20)], 'down', (20, 40))", expected: "([(20, 40), (20, 20), (0, 20)], True)" },
        { id: "py13-snake-hidden-boundaries", name: "Empty body and custom grid", hidden: true, call: "(advance_snake([], 'right', (20, 0)), advance_snake([(8, 8)], 'up', (0, 0), 8))", expected: "(([], False), ([(8, 0)], False))" },
      ],
    },

    "py13-rect-collisions": {
      description: "Compare player and target projections on both axes and report every overlapping target in source order. Strict boundary comparisons match Pygame Rect behaviour where shared edges alone are not collisions.",
      success: [
        "Returns indexes rather than copying target rectangles",
        "Detects overlap only when both axes penetrate",
        "Does not count edge-only contact as overlap",
      ],
      visual: "mapping",
      mode: "function",
      tests: [
        { id: "py13-rect-visible-multiple", name: "Several overlapping targets", hidden: false, call: "colliding_targets((5, 5, 10, 10), [(0, 0, 7, 7), (9, 2, 8, 8), (30, 30, 4, 4)])", expected: "[0, 1]" },
        { id: "py13-rect-visible-edge", name: "Edge contact is not overlap", hidden: false, call: "colliding_targets((0, 0, 10, 10), [(10, 0, 5, 5), (9, 9, 3, 3)])", expected: "[1]" },
        { id: "py13-rect-hidden-empty", name: "No targets or no overlap", hidden: true, call: "(colliding_targets((0, 0, 5, 5), []), colliding_targets((0, 0, 5, 5), [(6, 6, 2, 2)]))", expected: "([], [])" },
      ],
    },

    "py13-player-intent": {
      description: "Convert current keyboard intent into velocities without moving the player directly. Horizontal keys resolve every frame, while the grounded flag prevents an unlimited mid-air jump.",
      success: [
        "Uses negative velocity for left and positive velocity for right",
        "Cancels simultaneous opposite horizontal input",
        "Starts a jump only when jump is pressed and the player is grounded",
      ],
      visual: "flow",
      mode: "function",
      tests: [
        { id: "py13-intent-visible-run", name: "Run right while falling", hidden: false, call: "player_intent(False, True, False, False, 4)", expected: "(5, 4)" },
        { id: "py13-intent-visible-jump", name: "Grounded jump", hidden: false, call: "player_intent(True, False, True, True, 0)", expected: "(-5, -11)" },
        { id: "py13-intent-hidden-gates", name: "Opposite keys and airborne jump", hidden: true, call: "(player_intent(True, True, True, True, 2), player_intent(False, False, True, False, -3), player_intent(False, True, True, True, 0, 7, 14))", expected: "((0, -11), (0, -3), (7, -14))" },
      ],
    },

    "py13-gravity-landing": {
      description: "Integrate one frame of vertical speed and detect whether the moving bottom edge crosses a platform top. Snapping to the highest valid surface prevents a fast falling player from tunnelling through thin platforms.",
      success: [
        "Applies gravity without exceeding terminal speed",
        "Lands only while falling and horizontally overlapping a platform",
        "Snaps to the highest crossed platform and resets vertical speed",
      ],
      visual: "timeline",
      mode: "function",
      tests: [
        { id: "py13-gravity-visible-land", name: "Land during a fast fall", hidden: false, call: "gravity_landing(10, 12, 10, [(0, 55, 100, 10)])", expected: "(23, 0, True)" },
        { id: "py13-gravity-visible-rise", name: "Continue rising", hidden: false, call: "gravity_landing(20, 50, -5, [(0, 45, 100, 10)])", expected: "(46, -4, False)" },
        { id: "py13-gravity-hidden-speed", name: "Terminal speed and no platform", hidden: true, call: "gravity_landing(0, 0, 11, [])", expected: "(12, 12, False)" },
        { id: "py13-gravity-hidden-highest", name: "Choose the first crossed top", hidden: true, call: "gravity_landing(10, 0, 30, [(0, 60, 100, 8), (0, 48, 100, 8)], terminal_speed=50)", expected: "(16, 0, True)" },
      ],
    },

    "py13-animation-frame": {
      description: "Convert elapsed real time into a looping frame index rather than advancing animation once per draw call. Integer division counts completed frame intervals and modulo cycles through available images.",
      success: [
        "Keeps a frame active for its complete duration",
        "Loops from the final frame back to frame zero",
        "Handles unusable duration and frame-count settings safely",
      ],
      visual: "timeline",
      mode: "function",
      sourceRules: [
        {
          id: "py13-animation-uses-integer-division",
          label: "Count completed intervals with integer division",
          target: "code",
          pattern: "//",
          minMatches: 1,
          passFeedback: "Elapsed time is converted into a whole interval count.",
          failFeedback: "Use integer division to count complete animation-frame intervals.",
        },
        {
          id: "py13-animation-uses-modulo",
          label: "Loop the interval count with modulo",
          target: "code",
          pattern: "%",
          minMatches: 1,
          passFeedback: "The frame index wraps through the available images.",
          failFeedback: "Use modulo with frame_count so the animation returns to frame zero.",
        },
      ],
      tests: [
        { id: "py13-animation-visible-boundary", name: "Frame-duration boundaries", hidden: false, call: "(animation_frame(0, 100, 4), animation_frame(99, 100, 4), animation_frame(100, 100, 4))", expected: "(0, 0, 1)" },
        { id: "py13-animation-visible-loop", name: "Loop after final frame", hidden: false, call: "(animation_frame(399, 100, 4), animation_frame(400, 100, 4), animation_frame(750, 100, 4))", expected: "(3, 0, 3)" },
        { id: "py13-animation-hidden-invalid", name: "Safe invalid settings", hidden: true, call: "(animation_frame(250, 0, 4), animation_frame(250, 100, 0), animation_frame(1250, 250, 3))", expected: "(0, 0, 2)" },
      ],
    },

    "py13-level-status": {
      description: "Reduce several world facts into one explicit level state that rendering, sound, and navigation can consume. Condition order is part of the contract because reaching the goal wins even when the same position is beyond the fall limit.",
      success: [
        "Returns won for strict player-goal overlap",
        "Returns fallen only after the player's top passes the limit",
        "Keeps ordinary frames in the running state",
      ],
      visual: "flow",
      mode: "function",
      tests: [
        { id: "py13-status-visible-win", name: "Reach the goal", hidden: false, call: "level_status((90, 40, 20, 30), (100, 50, 25, 40), 300)", expected: "'won'" },
        { id: "py13-status-visible-running", name: "Continue the level", hidden: false, call: "level_status((10, 20, 20, 30), (300, 50, 25, 40), 300)", expected: "'running'" },
        { id: "py13-status-hidden-priority", name: "Fall boundary and goal priority", hidden: true, call: "(level_status((10, 301, 20, 20), (200, 0, 20, 20), 300), level_status((10, 301, 20, 20), (15, 305, 20, 20), 300), level_status((10, 300, 20, 20), (200, 0, 20, 20), 300))", expected: "('fallen', 'won', 'running')" },
      ],
    },
  });
})();
