def select_intervals(intervals):
    """Choose a maximum-size compatible schedule using earliest finish time."""
    ordered = sorted(intervals, key=lambda interval: (interval[1], interval[0]))
    selected = []
    previous_finish = None
    for start, finish in ordered:
        if previous_finish is None or start >= previous_finish:
            selected.append((start, finish))
            previous_finish = finish
    return selected
