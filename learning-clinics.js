(() => {
  "use strict";

  const clinics = {
    py01: {
      id: "py01-input-boundary-clinic",
      title: "Trace the input boundary before doing arithmetic",
      description: "A reliable first program separates raw text, typed values, domain calculations, and final presentation. This makes three different mistakes visible: parsing the wrong type, combining incompatible units, and printing a representation that does not match the output contract. Follow the value through every boundary instead of treating the script as one opaque formula.",
      exampleCode: [
        "raw_boxes = \"4\"",
        "raw_kg_each = \"2.5\"",
        "box_count = int(raw_boxes)",
        "kg_each = float(raw_kg_each)",
        "shipment_kg = box_count * kg_each",
        "display = f\"{shipment_kg:.1f} kg\"",
        "print(display)",
      ].join("\n"),
      trace: [
        {
          step: "Read",
          state: "raw_boxes == \"4\"; raw_kg_each == \"2.5\"",
          reasoning: "External text is preserved first. Quotation marks in the trace remind us that neither value is numeric yet.",
        },
        {
          step: "Convert the count",
          state: "box_count == 4 (int)",
          reasoning: "Boxes are discrete, so an integer expresses the domain more accurately than a floating-point value.",
        },
        {
          step: "Convert the measurement",
          state: "kg_each == 2.5 (float)",
          reasoning: "A mass can contain a fractional part, so float is appropriate at this learning stage.",
        },
        {
          step: "Transform",
          state: "shipment_kg == 10.0 (float)",
          reasoning: "The multiplication now combines compatible numeric values. The unit is kilograms because count × kilograms per box leaves kilograms.",
        },
        {
          step: "Format",
          state: "display == \"10.0 kg\" (str)",
          reasoning: "Formatting creates presentation text. It does not change shipment_kg or make later numeric calculation safer.",
        },
        {
          step: "Publish",
          state: "stdout receives exactly one line: 10.0 kg",
          reasoning: "Only the promised result crosses the output boundary; temporary labels and debugging lines stay out of stdout.",
        },
      ],
      misconceptions: [
        {
          belief: "If the user types digits, input already returns a number.",
          correction: "Keyboard input returns str. Arithmetic only becomes numeric after an explicit conversion such as int or float.",
          probe: "Without running it, predict both the type and result of \"4\" * 3. Then compare that with int(\"4\") * 3.",
        },
        {
          belief: "Formatting a number to one decimal place permanently rounds the stored value.",
          correction: "An f-string creates a new string representation. The original numeric value remains available with its existing precision.",
          probe: "After display = f\"{2 / 3:.1f}\", what are the types and values of display and 2 / 3?",
        },
        {
          belief: "Helpful prompts and labels cannot affect an automated answer.",
          correction: "Prompts and labels are output too. Exact-output tests observe every character sent to stdout.",
          probe: "List every character printed by input(\"Boxes: \") before the learner enters a value.",
        },
      ],
      transferPrompts: [
        "Read a whole number of seats and a decimal ticket price, then trace the type and unit after every line before calculating revenue.",
        "Design a three-room data flow for converting minutes and seconds into total seconds without writing the final program.",
        "Given an exact-output contract, mark which values should remain numeric and identify the single point where presentation text should be created.",
      ],
    },

    py02: {
      id: "py02-integer-boundaries-clinic",
      title: "Choose a numeric boundary from the real-world rule",
      description: "Division often produces several legitimate answers: complete groups, a leftover, the number of groups required to cover everything, or the nearest displayed measurement. The operation must follow the domain rule. Work with quotient and remainder first, then justify whether floor, ceiling, nearest rounding, or formatting answers the actual question.",
      exampleCode: [
        "import math",
        "",
        "pages = 53",
        "pages_per_packet = 8",
        "full_packets, loose_pages = divmod(pages, pages_per_packet)",
        "packets_to_carry = math.ceil(pages / pages_per_packet)",
        "coverage = pages / pages_per_packet",
        "print(full_packets, loose_pages, packets_to_carry, f\"{coverage:.2f}\")",
      ].join("\n"),
      trace: [
        {
          step: "Establish the ratio",
          state: "coverage == 6.625",
          reasoning: "The exact ratio says the pages occupy six full packet capacities plus part of another; it is not yet a decision about containers.",
        },
        {
          step: "Decompose",
          state: "full_packets == 6; loose_pages == 5",
          reasoning: "divmod records both integer facts at once, preserving evidence that five pages remain after six complete groups.",
        },
        {
          step: "Apply the coverage rule",
          state: "packets_to_carry == 7",
          reasoning: "Every page must be carried, so any positive remainder requires one additional packet. Ceiling expresses this upper-bound promise.",
        },
        {
          step: "Check the lower bound",
          state: "6 * 8 == 48 < 53",
          reasoning: "Six packets cannot cover the demand. This inequality is stronger evidence than choosing ceil merely because the result has decimals.",
        },
        {
          step: "Check the upper bound",
          state: "7 * 8 == 56 >= 53",
          reasoning: "Seven packets cover the demand, and the previous check proves that seven is the smallest sufficient whole count.",
        },
        {
          step: "Format separately",
          state: "f\"{coverage:.2f}\" == \"6.62\"",
          reasoning: "The formatted ratio is display text. It answers a presentation request, not the packet-allocation question.",
        },
      ],
      misconceptions: [
        {
          belief: "Whenever division has a fractional result, ceil is the safe choice.",
          correction: "Ceiling is correct only for an upper-bound contract such as capacity coverage. Complete groups, lower limits, and signed coordinates can require different rules.",
          probe: "For 53 pages in groups of 8, compare the answers to “how many complete groups?” and “how many packets carry every page?”",
        },
        {
          belief: "int(value), floor(value), and trunc(value) are interchangeable.",
          correction: "int and trunc move toward zero, while floor moves toward negative infinity. They disagree for negative non-integers.",
          probe: "Place -2.7 between its neighbouring integers, then predict int(-2.7), floor(-2.7), and ceil(-2.7).",
        },
        {
          belief: "round(value, 2) guarantees two visible decimal digits.",
          correction: "round returns a number; numeric values do not preserve display width. Formatting controls visible trailing zeroes.",
          probe: "Predict the repr and type of round(5.0, 2), then compare it conceptually with f\"{5.0:.2f}\".",
        },
      ],
      transferPrompts: [
        "For a lift with a fixed person capacity, prove the minimum number of trips using one insufficient and one sufficient inequality.",
        "Create a signed-number table that compares floor, ceiling, truncation, and nearest rounding for -3.5, -3.1, 3.1, and 3.5.",
        "Separate the calculation and presentation requirements for a measurement that must remain precise internally but display exactly three decimal places.",
      ],
    },

    py03: {
      id: "py03-loop-state-clinic",
      title: "Treat a loop as repeated state transitions",
      description: "A loop is easier to reason about when every changing name has a declared meaning that remains true after each iteration. The example maintains two invariants: warm_count equals the number of processed readings at least 20, and highest equals the greatest processed reading. Trace initialization, one transition per item, and the exit condition before judging the final output.",
      exampleCode: [
        "readings = [18, 21, 25, 19]",
        "warm_count = 0",
        "highest = None",
        "",
        "for value in readings:",
        "    if value >= 20:",
        "        warm_count += 1",
        "    if highest is None or value > highest:",
        "        highest = value",
        "",
        "print(warm_count, highest)",
      ].join("\n"),
      trace: [
        {
          step: "Initialize",
          state: "processed == []; warm_count == 0; highest is None",
          reasoning: "Before any item, zero qualifying readings is correct and there is no greatest observed value. None represents that absence explicitly.",
        },
        {
          step: "Process 18",
          state: "processed == [18]; warm_count == 0; highest == 18",
          reasoning: "18 does not meet the threshold, but it becomes the greatest value because it is the first observed reading.",
        },
        {
          step: "Process 21",
          state: "processed == [18, 21]; warm_count == 1; highest == 21",
          reasoning: "The first condition increments the count, and the second condition updates the running maximum.",
        },
        {
          step: "Process 25",
          state: "processed == [18, 21, 25]; warm_count == 2; highest == 25",
          reasoning: "Both invariants remain true after the transition: two processed readings qualify and 25 is the greatest so far.",
        },
        {
          step: "Process 19",
          state: "processed == [18, 21, 25, 19]; warm_count == 2; highest == 25",
          reasoning: "Neither update runs. Leaving state unchanged is a deliberate transition, not an omitted case.",
        },
        {
          step: "Exit",
          state: "stdout receives: 2 25",
          reasoning: "The for loop stops because the iterable is exhausted. The invariants now describe the entire input rather than only a prefix.",
        },
      ],
      misconceptions: [
        {
          belief: "A loop variable automatically remembers all earlier values.",
          correction: "The loop variable is rebound to the current item. History survives only in state you maintain deliberately, such as a count, collection, or running best.",
          probe: "At the end of the example, what does value contain, and which variables contain information about earlier iterations?",
        },
        {
          belief: "Initializing a maximum to zero is always simpler than using None.",
          correction: "Zero invents a data value and fails for non-empty inputs containing only negative numbers. None states that no value has been observed.",
          probe: "Trace the maximum logic for [-8, -3] once with highest = 0 and once with highest = None.",
        },
        {
          belief: "Two adjacent if statements behave like if/elif.",
          correction: "Independent if statements can both run. An elif branch is considered only when the preceding condition is false.",
          probe: "For value == 25 in the example, count how many update blocks execute and explain why.",
        },
      ],
      transferPrompts: [
        "Write invariants, but no code, for a loop that tracks the number of empty strings and the longest non-empty string seen so far.",
        "Trace a while loop whose state is remaining_work and prove that every iteration moves it closer to zero.",
        "Design one normal, one empty-input, and one all-negative trace for a running minimum algorithm before implementing it.",
      ],
    },

    py04: {
      id: "py04-function-contract-clinic",
      title: "Read a function as a contract and a separate call frame",
      description: "A useful function defines acceptable inputs, a returned result, possible failures, and which outside state it does not touch. Each call receives its own local names. Trace argument binding before the body, follow exactly one control-flow path, and distinguish returning a value to the caller from printing text for a human.",
      exampleCode: [
        "def quote_delivery(weight_kg, express):",
        "    if weight_kg < 0:",
        "        raise ValueError(\"weight_kg must be non-negative\")",
        "    base_fee = 4.0 if weight_kg <= 2 else 6.5",
        "    express_fee = 3.0 if express else 0.0",
        "    return base_fee + express_fee",
        "",
        "standard = quote_delivery(1.5, False)",
        "priority = quote_delivery(3.0, True)",
        "print(standard, priority)",
      ].join("\n"),
      trace: [
        {
          step: "Bind the first call",
          state: "weight_kg == 1.5; express is False",
          reasoning: "Arguments are matched to parameters inside a new call frame. The caller's names are not renamed or modified.",
        },
        {
          step: "Follow the first path",
          state: "base_fee == 4.0; express_fee == 0.0",
          reasoning: "The validation guard is skipped, the light-weight branch is selected, and False selects no surcharge.",
        },
        {
          step: "Return the first result",
          state: "standard == 4.0",
          reasoning: "return ends this call and hands one value to the assignment. The function itself has printed nothing.",
        },
        {
          step: "Bind the second call",
          state: "weight_kg == 3.0; express is True",
          reasoning: "A fresh frame is created. Local values from the earlier call do not leak into this one.",
        },
        {
          step: "Follow the second path",
          state: "base_fee == 6.5; express_fee == 3.0",
          reasoning: "The heavier branch and express surcharge both apply, demonstrating that parameters control independent decisions.",
        },
        {
          step: "Return and publish",
          state: "priority == 9.5; stdout receives: 4.0 9.5",
          reasoning: "The caller decides when to print. Keeping calculation and presentation separate makes the function reusable in tests and larger programs.",
        },
      ],
      misconceptions: [
        {
          belief: "Printing a value from a function is equivalent to returning it.",
          correction: "print sends text to stdout and normally returns None. return sends a Python value back to the caller and ends the current call.",
          probe: "If quote_delivery printed its fee but omitted return, what value would be assigned to standard?",
        },
        {
          belief: "Changing a parameter name changes the caller's variable.",
          correction: "A parameter is a local binding. Rebinding it affects only the current frame, although mutating a shared mutable object is a separate concern.",
          probe: "Sketch the caller frame and function frame for quote_delivery(1.5, False), showing which names exist in each.",
        },
        {
          belief: "Validation should silently repair every invalid argument.",
          correction: "The contract should decide whether invalid data is rejected, normalized, or represented specially. Silent repair can hide the caller's bug.",
          probe: "Compare the evidence a caller receives from raising ValueError with the evidence from quietly converting -2 to 2.",
        },
      ],
      transferPrompts: [
        "Write a contract for a function that accepts a duration and returns a category; include types, boundaries, return type, and failure policy.",
        "Decompose a calculation into one validation helper and one transformation function, then identify what each function must not print.",
        "Trace two calls to the same function with different arguments and draw separate local frames before predicting either result.",
      ],
    },

    py05: {
      id: "py05-sequence-parsing-clinic",
      title: "Parse immutable sequences in explicit stages",
      description: "String and tuple work becomes safer when parsing, conversion, and presentation are distinct stages. A delimiter defines how text is split; unpacking documents the expected field count; conversion gives selected fields domain types; a tuple can then preserve a fixed record shape. Trace both values and sequence types because similar-looking operations may return different kinds of objects.",
      exampleCode: [
        "record = \"Marta|blue|3\"",
        "fields = record.split(\"|\")",
        "name, colour, raw_attempts = fields",
        "attempts = int(raw_attempts)",
        "profile = (name, colour, attempts)",
        "display_name = profile[0].upper()",
        "print(display_name, profile[2])",
      ].join("\n"),
      trace: [
        {
          step: "Receive the record",
          state: "record == \"Marta|blue|3\" (str)",
          reasoning: "The separators are still embedded in one immutable string. No field meaning has been assigned yet.",
        },
        {
          step: "Split",
          state: "fields == [\"Marta\", \"blue\", \"3\"] (list)",
          reasoning: "split returns a new list and leaves record unchanged. The delimiter is consumed rather than included in the fields.",
        },
        {
          step: "Unpack",
          state: "name == \"Marta\"; colour == \"blue\"; raw_attempts == \"3\"",
          reasoning: "Three target names assert that exactly three fields are expected. A malformed field count fails close to the boundary.",
        },
        {
          step: "Convert one field",
          state: "attempts == 3 (int)",
          reasoning: "Only the field that represents a count becomes numeric. The name and colour remain textual identifiers.",
        },
        {
          step: "Build a record",
          state: "profile == (\"Marta\", \"blue\", 3) (tuple)",
          reasoning: "The tuple records a stable three-position shape. It is a new object, not a transformed version of the source string.",
        },
        {
          step: "Derive output",
          state: "display_name == \"MARTA\"; stdout receives: MARTA 3",
          reasoning: "upper returns another string; it does not mutate profile[0]. Indexing selects values without changing the tuple.",
        },
      ],
      misconceptions: [
        {
          belief: "split changes the original string into pieces.",
          correction: "Strings are immutable. split creates and returns a new list while the original string remains exactly as it was.",
          probe: "After fields = record.split(\"|\"), predict record, fields, and the type of each.",
        },
        {
          belief: "A tuple is deeply immutable, so every object reachable through it is protected.",
          correction: "Tuple positions cannot be rebound, but a tuple can contain a mutable object whose contents can still change.",
          probe: "Predict whether container = ([1, 2], \"fixed\"); container[0].append(3) is allowed and explain which object changes.",
        },
        {
          belief: "Slicing includes the stop index.",
          correction: "Python slices are half-open: the start is included and the stop is excluded. This makes slice length equal stop - start for simple positive ranges.",
          probe: "For word = \"python\", predict word[1:4] and list the indexes that contribute characters.",
        },
      ],
      transferPrompts: [
        "Parse a semicolon-separated sensor record into a fixed tuple while converting only the timestamp and measurement fields.",
        "Design validation for a record with exactly four fields before unpacking, including the evidence produced for too few or too many fields.",
        "Trace three slices of a six-character string and explain each result using half-open index intervals rather than visual guessing.",
      ],
    },

    py06: {
      id: "py06-aliasing-mutation-clinic",
      title: "Separate identity, equality, and mutation",
      description: "List bugs often come from drawing the wrong ownership picture. Two names may reference one list, a shallow copy may create a new outer list while sharing nested objects, and a mutating method may return None instead of the changed collection. Trace object identity and contents separately before and after every destructive operation.",
      exampleCode: [
        "original_queue = [\"A12\", \"B07\", \"C03\"]",
        "working_queue = original_queue.copy()",
        "served = working_queue.pop(0)",
        "working_queue.append(\"D11\")",
        "snapshot = working_queue[:]",
        "print(served)",
        "print(original_queue)",
        "print(snapshot)",
      ].join("\n"),
      trace: [
        {
          step: "Create",
          state: "original_queue → list A [\"A12\", \"B07\", \"C03\"]",
          reasoning: "One name points to one mutable list object. The label list A is a tracing aid for identity, not Python syntax.",
        },
        {
          step: "Copy",
          state: "working_queue → list B [\"A12\", \"B07\", \"C03\"]",
          reasoning: "copy creates a distinct outer list with equal contents. Changing list B's positions will not change list A's positions.",
        },
        {
          step: "Pop",
          state: "served == \"A12\"; list B == [\"B07\", \"C03\"]",
          reasoning: "pop both mutates the target list and returns the removed element. The operation is applied only to working_queue.",
        },
        {
          step: "Append",
          state: "list B == [\"B07\", \"C03\", \"D11\"]",
          reasoning: "append mutates list B in place and returns None. original_queue still points to unchanged list A.",
        },
        {
          step: "Snapshot",
          state: "snapshot → list C [\"B07\", \"C03\", \"D11\"]",
          reasoning: "A full slice creates another shallow outer copy, useful when later work must not rewrite the recorded state.",
        },
        {
          step: "Compare",
          state: "original_queue == [\"A12\", \"B07\", \"C03\"]; snapshot == [\"B07\", \"C03\", \"D11\"]",
          reasoning: "The outputs confirm ownership: equality of initial contents did not imply shared identity after copying.",
        },
      ],
      misconceptions: [
        {
          belief: "new_name = old_list creates an independent copy.",
          correction: "Assignment creates another reference to the same object. Mutating through either alias is visible through both names.",
          probe: "Draw one or two list objects for a = [1, 2]; b = a; b.append(3), then predict a.",
        },
        {
          belief: "copy makes every nested value independent.",
          correction: "list.copy and slicing are shallow: the outer list is new, but nested mutable elements are still shared references.",
          probe: "Trace rows = [[1], [2]]; clone = rows.copy(); clone[0].append(9), including identities of both outer and inner lists.",
        },
        {
          belief: "A mutating list method returns the updated list.",
          correction: "Methods such as append, extend, sort, and reverse mutate in place and return None to make that side effect harder to overlook.",
          probe: "Predict both values after numbers = [3, 1]; result = numbers.sort().",
        },
      ],
      transferPrompts: [
        "Draw an ownership diagram for a nested seating chart, then choose between aliasing, a shallow copy, and a deep copy for an editable draft.",
        "Rewrite a destructive queue-processing plan so the caller's original list remains unchanged, and state where the copy belongs.",
        "For append, pop, sorted, and slicing, classify whether each operation mutates, returns a new value, or does both.",
      ],
    },

    py07: {
      id: "py07-aggregation-lookup-clinic",
      title: "Build dictionary state with one invariant per key",
      description: "A frequency dictionary is not merely a compact loop; it represents a promise: after processing a prefix, each stored value equals the number of times its key appeared in that prefix. Sets answer a different question about membership and uniqueness. Trace the mapping after every item and choose membership tests deliberately so missing keys are not confused with stored falsey values.",
      exampleCode: [
        "orders = [\"tea\", \"coffee\", \"tea\", \"water\", \"tea\"]",
        "counts = {}",
        "",
        "for drink in orders:",
        "    counts[drink] = counts.get(drink, 0) + 1",
        "",
        "popular = max(counts, key=counts.get)",
        "unique_drinks = set(orders)",
        "print(popular, len(unique_drinks))",
      ].join("\n"),
      trace: [
        {
          step: "Initialize",
          state: "processed == []; counts == {}",
          reasoning: "No keys are present because no order has been observed. The invariant is already true for the empty prefix.",
        },
        {
          step: "Process tea",
          state: "counts == {\"tea\": 1}",
          reasoning: "get returns the fallback zero for a missing key, then one is stored as the first observed count.",
        },
        {
          step: "Process coffee",
          state: "counts == {\"tea\": 1, \"coffee\": 1}",
          reasoning: "A second key gets its own independent aggregate. Dictionary lookup avoids scanning earlier orders.",
        },
        {
          step: "Process tea again",
          state: "counts == {\"tea\": 2, \"coffee\": 1}",
          reasoning: "The existing value is retrieved and replaced with the next count; no duplicate key is created.",
        },
        {
          step: "Finish the input",
          state: "counts == {\"tea\": 3, \"coffee\": 1, \"water\": 1}",
          reasoning: "The invariant now covers the full list. The mapping retains counts, while set(orders) retains only unique keys.",
        },
        {
          step: "Derive summaries",
          state: "popular == \"tea\"; unique_drinks == {\"tea\", \"coffee\", \"water\"}",
          reasoning: "max asks counts.get for each key's comparison value. Set order is irrelevant because only its size is published.",
        },
      ],
      misconceptions: [
        {
          belief: "if mapping.get(key) is enough to test whether a key exists.",
          correction: "get can return a falsey stored value such as 0 or an absent-key fallback. Use key in mapping when existence itself is the question.",
          probe: "Compare mapping = {\"retry\": 0}; mapping.get(\"retry\") and \"retry\" in mapping. What different facts do they answer?",
        },
        {
          belief: "Sets preserve duplicates but hide them when printed.",
          correction: "A set stores each distinct hashable value once. Duplicate multiplicity is discarded at construction time.",
          probe: "Build a hand trace of set([\"a\", \"a\", \"b\"]) and identify which information cannot be recovered.",
        },
        {
          belief: "Iterating a dictionary directly yields key-value pairs.",
          correction: "Direct iteration yields keys. Use items when both the key and its associated value are required.",
          probe: "Predict the values bound by for item in {\"x\": 2} and by for key, value in {\"x\": 2}.items().",
        },
      ],
      transferPrompts: [
        "Define and trace an invariant for aggregating total minutes by project from a sequence of project-duration pairs.",
        "Choose a dictionary or set for three separate needs: membership, occurrence counts, and associating an identifier with a record.",
        "Design a lookup that distinguishes a missing product from a product whose stored stock is zero, then explain the test you chose.",
      ],
    },

    py08: {
      id: "py08-recursive-progress-clinic",
      title: "Prove recursive progress before following the call tree",
      description: "A recursive definition needs more than a base case: every recursive call must receive a problem that is measurably closer to that base case. Structural recursion can mirror nested data by handling an atomic value directly and splitting a collection into smaller pieces. Trace calls downward first, then returns upward; the final result is assembled during the unwind.",
      exampleCode: [
        "def total_pages(tree):",
        "    if isinstance(tree, int):",
        "        return tree",
        "    if not tree:",
        "        return 0",
        "    first, *rest = tree",
        "    return total_pages(first) + total_pages(rest)",
        "",
        "plan = [3, [2, 1], 4]",
        "print(total_pages(plan))",
      ].join("\n"),
      trace: [
        {
          step: "Open the root call",
          state: "total_pages([3, [2, 1], 4])",
          reasoning: "The value is a non-empty list, so it splits into first == 3 and rest == [[2, 1], 4]. Both recursive arguments are structurally smaller.",
        },
        {
          step: "Resolve the first atom",
          state: "total_pages(3) → 3",
          reasoning: "An integer is an atomic base case. This branch returns immediately without creating another call.",
        },
        {
          step: "Descend into the remaining list",
          state: "total_pages([[2, 1], 4])",
          reasoning: "The next first value is itself nested, so one branch explores [2, 1] while the other retains the smaller rest [4].",
        },
        {
          step: "Resolve the nested branch",
          state: "total_pages([2, 1]) → total_pages(2) + total_pages([1]) → 3",
          reasoning: "Atomic returns 2 and 1 are combined only while calls unwind. The empty-rest base contributes zero.",
        },
        {
          step: "Resolve the final branch",
          state: "total_pages([4]) → total_pages(4) + total_pages([]) → 4",
          reasoning: "The list becomes empty after removing its first element, proving that this path terminates.",
        },
        {
          step: "Unwind to the root",
          state: "3 + (3 + 4) → 10",
          reasoning: "Suspended additions resume from the deepest completed calls outward. stdout receives the fully assembled total only once.",
        },
      ],
      misconceptions: [
        {
          belief: "Having any if statement that returns is enough to guarantee recursive termination.",
          correction: "The base case must be reachable, and every recursive branch must move a well-founded measure closer to it.",
          probe: "Name the decreasing measure for total_pages when the argument is a list, and explain why atomic integers need a separate base case.",
        },
        {
          belief: "Recursive calls calculate from top to bottom in one pass.",
          correction: "Calls descend while operations wait. Results are combined as frames return in the opposite direction.",
          probe: "For total_pages([2, 1]), list the call order and then list the return order.",
        },
        {
          belief: "Repeating the same recursive call in one expression is harmless.",
          correction: "Each occurrence performs the work again unless a result is stored or cached, which can multiply the call count dramatically.",
          probe: "Draw the first two levels of f(n - 1) + f(n - 1) and count how often the same argument appears.",
        },
      ],
      transferPrompts: [
        "Define a decreasing measure and base cases for counting text labels inside an arbitrarily nested list without writing the full solution.",
        "Draw the descent and unwind phases for a recursive function on a three-character string, recording each suspended operation.",
        "Compare an index-based recursive design with a slicing design and discuss the progress proof and allocation cost of each.",
      ],
    },

    py09: {
      id: "py09-lazy-pipeline-clinic",
      title: "Trace a lazy pipeline one consumed item at a time",
      description: "Functional collection tools describe stages rather than immediately producing lists. filter and map return lazy iterators; reduce pulls values through the upstream stages and updates one accumulator. Trace the creation of pipeline objects separately from their consumption, and record where each source value is rejected, transformed, or combined.",
      exampleCode: [
        "from functools import reduce",
        "",
        "readings = [-1, 4, 0, 7]",
        "non_negative = filter(lambda value: value >= 0, readings)",
        "scaled = map(lambda value: value * 10, non_negative)",
        "total = reduce(lambda acc, value: acc + value, scaled, 0)",
        "print(total)",
      ].join("\n"),
      trace: [
        {
          step: "Describe the stages",
          state: "non_negative and scaled are iterator objects; no source item has been processed",
          reasoning: "Constructing filter and map records callable-plus-iterable relationships. Laziness postpones work until a consumer asks for values.",
        },
        {
          step: "Consume -1",
          state: "-1 fails value >= 0; accumulator remains 0",
          reasoning: "filter rejects the source value, so map and reduce never receive it.",
        },
        {
          step: "Consume 4",
          state: "4 passes → 40; accumulator becomes 0 + 40 == 40",
          reasoning: "One demand from reduce pulls one accepted value through both upstream stages before combining it.",
        },
        {
          step: "Consume 0",
          state: "0 passes → 0; accumulator remains 40",
          reasoning: "Zero is non-negative and must not be confused with failure merely because it is falsey in a Boolean context.",
        },
        {
          step: "Consume 7",
          state: "7 passes → 70; accumulator becomes 40 + 70 == 110",
          reasoning: "The accumulator invariant is now the sum of every scaled accepted value from the processed prefix.",
        },
        {
          step: "Exhaust and return",
          state: "source exhausted; total == 110",
          reasoning: "reduce returns the accumulator after no upstream values remain. The map and filter iterators are now consumed.",
        },
      ],
      misconceptions: [
        {
          belief: "map and filter return reusable lists.",
          correction: "In Python 3 they return one-pass iterators. Convert deliberately only when a concrete collection is required.",
          probe: "Predict what remains for a second list(scaled) after the first list(scaled) has already exhausted the iterator.",
        },
        {
          belief: "A pipeline is automatically clearer than a loop.",
          correction: "Pipelines help when stages have crisp meanings. Dense lambdas, hidden side effects, or difficult error handling can make an explicit loop clearer.",
          probe: "Explain each stage of the example in one verb. If a stage needs a paragraph, what refactoring might help?",
        },
        {
          belief: "reduce without an initializer always has the same behavior as reduce with one.",
          correction: "Without an initializer, the first item becomes the initial accumulator and an empty iterable raises TypeError. An explicit identity handles emptiness when the operation has one.",
          probe: "Compare summing an empty iterable with and without initializer 0.",
        },
      ],
      transferPrompts: [
        "Design a three-stage pipeline that selects valid durations, converts them to seconds, and totals them; name the type produced by each stage.",
        "Trace a lazy iterator twice and explain exactly where exhaustion becomes observable.",
        "Rewrite a pipeline plan as an explicit loop, then compare which form makes state, errors, and debugging evidence clearer.",
      ],
    },

    py10: {
      id: "py10-effect-boundary-clinic",
      title: "Keep transformation pure and move effects to the boundary",
      description: "Effect-free code is predictable because the same inputs produce the same result and the function does not alter external state. A comprehension can construct a new collection while leaving the caller's input untouched. Trace object ownership, returned values, and the exact line where an observable effect such as printing occurs.",
      exampleCode: [
        "def apply_service_fee(amounts, rate):",
        "    return [round(amount * (1 + rate), 2) for amount in amounts]",
        "",
        "base_amounts = [8.0, 12.5, 4.25]",
        "charged_amounts = apply_service_fee(base_amounts, 0.10)",
        "print(base_amounts)",
        "print(charged_amounts)",
      ].join("\n"),
      trace: [
        {
          step: "Enter the function",
          state: "amounts references the caller's list; rate == 0.10",
          reasoning: "The parameter initially shares the input object, so purity depends on reading from it without mutation.",
        },
        {
          step: "Transform 8.0",
          state: "first new value == round(8.0 * 1.10, 2) == 8.8",
          reasoning: "The expression calculates a value and appends it to the comprehension's new result list, not to amounts.",
        },
        {
          step: "Transform 12.5",
          state: "second new value == 13.75",
          reasoning: "No previous or external state is needed; this element depends only on the current amount and rate.",
        },
        {
          step: "Transform 4.25",
          state: "third new value == 4.68",
          reasoning: "Rounding is part of the returned-domain rule here. The source element remains 4.25.",
        },
        {
          step: "Return",
          state: "charged_amounts == [8.8, 13.75, 4.68]",
          reasoning: "A new list crosses the function boundary. Repeating the call with equal inputs produces an equal result.",
        },
        {
          step: "Observe effects",
          state: "base_amounts remains [8.0, 12.5, 4.25]; two print calls affect stdout",
          reasoning: "The calculation function is effect-free; the caller owns the explicit presentation effects.",
        },
      ],
      misconceptions: [
        {
          belief: "A comprehension is pure by definition.",
          correction: "A comprehension creates a collection, but its expression or conditions can still call effectful functions or mutate shared objects.",
          probe: "Would [log_and_return(x) for x in values] be pure if log_and_return writes to a file? Explain which syntax does and does not guarantee purity.",
        },
        {
          belief: "A function without print has no side effects.",
          correction: "Mutating arguments, changing globals, writing files, consuming external iterators, and reading the clock are also observable effects.",
          probe: "Classify values.pop(), random.random(), and len(values) by the external state they read or change.",
        },
        {
          belief: "Returning a new list always proves the input was untouched.",
          correction: "A function can mutate the input and still return another object. Ownership must be checked at every operation, not inferred from the return type.",
          probe: "What before-and-after assertion would prove that base_amounts was not modified?",
        },
      ],
      transferPrompts: [
        "Split a small program into a pure normalization function and an effectful input-output shell, naming the boundary between them.",
        "Audit a comprehension whose helper closes over a counter and explain whether equal inputs still guarantee equal results.",
        "Write test properties for a transformation that should preserve input length, avoid mutation, and produce the same output on repeated calls.",
      ],
    },

    py11: {
      id: "py11-search-invariant-clinic",
      title: "Shrink a half-open interval without losing the answer",
      description: "Divide-and-conquer search works because a structural promise lets one comparison discard an entire region. In a sorted sequence, maintain a half-open candidate interval [low, high) that still contains the first value meeting the target. Every branch must preserve that invariant and strictly reduce the interval before the loop repeats.",
      exampleCode: [
        "levels = [2, 5, 8, 12, 17, 23]",
        "target = 10",
        "low = 0",
        "high = len(levels)",
        "",
        "while low < high:",
        "    mid = (low + high) // 2",
        "    if levels[mid] < target:",
        "        low = mid + 1",
        "    else:",
        "        high = mid",
        "",
        "print(low)",
      ].join("\n"),
      trace: [
        {
          step: "Initialize",
          state: "candidate interval == [0, 6)",
          reasoning: "The answer may be any insertion position from zero through len(levels). A half-open high bound makes position 6 represent “after every item.”",
        },
        {
          step: "Probe index 3",
          state: "mid == 3; levels[mid] == 12",
          reasoning: "12 meets the target, so index 3 might be the first match. It must remain a candidate while every later index can be discarded.",
        },
        {
          step: "Keep the left half",
          state: "candidate interval == [0, 3)",
          reasoning: "Assigning high = mid preserves index 3 as the boundary represented by high while reducing the searchable width from six to three.",
        },
        {
          step: "Probe index 1",
          state: "mid == 1; levels[mid] == 5",
          reasoning: "5 is below the target. Sorted order proves that indexes zero and one are both too small.",
        },
        {
          step: "Discard proved failures",
          state: "candidate interval == [2, 3)",
          reasoning: "low = mid + 1 removes the failing midpoint as well as every earlier value. The interval width is now one.",
        },
        {
          step: "Probe and stop",
          state: "mid == 2; levels[mid] == 8 → low == 3; interval == [3, 3)",
          reasoning: "Index 2 also fails, so low advances to 3. The empty interval means low is the unique boundary: levels[3] is the first value at least 10.",
        },
      ],
      misconceptions: [
        {
          belief: "Binary search is correct whenever the midpoint changes.",
          correction: "Correctness depends on a preserved candidate invariant and a strictly shrinking interval, not on midpoint arithmetic alone.",
          probe: "After observing levels[3] == 12, state exactly which indexes are still possible answers and why.",
        },
        {
          belief: "high must always start at len(values) - 1.",
          correction: "That is one closed-interval convention. A half-open interval uses high = len(values); mixing the two conventions causes missed boundaries and off-by-one errors.",
          probe: "For an empty list, compare the initial states [0, len(values)) and [0, len(values) - 1]. Which one naturally represents no candidates?",
        },
        {
          belief: "Setting high = mid - 1 is always how the right half is removed.",
          correction: "Here the midpoint already satisfies the condition and might be the first satisfying index, so removing it would discard a valid answer.",
          probe: "In the first iteration, show the wrong result that could follow if index 3 were discarded immediately.",
        },
      ],
      transferPrompts: [
        "State a candidate-interval invariant for locating the first timestamp not earlier than a requested time in sorted data.",
        "Trace the same half-open search when the target is smaller than every value and when it is larger than every value.",
        "Compare the number of probes made by interval halving and a left-to-right scan for 8, 64, and 1,024 sorted items.",
      ],
    },
  };

  function deepFreeze(value) {
    if (!value || typeof value !== "object" || Object.isFrozen(value)) {
      return value;
    }
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }

  window.LEARNING_CLINICS = deepFreeze(clinics);
})();
