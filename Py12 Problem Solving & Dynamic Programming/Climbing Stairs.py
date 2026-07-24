def climbing_ways(steps):
    """Count ways to reach the top using one-step or two-step moves."""
    if steps < 0:
        return 0
    previous, current = 1, 1
    for _ in range(steps):
        previous, current = current, previous + current
    return previous
