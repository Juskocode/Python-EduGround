def knapsack_value(capacity, weights, values):
    """Return the greatest value obtainable when each item is used at most once."""
    best = [0] * (capacity + 1)
    for weight, value in zip(weights, values):
        for room in range(capacity, weight - 1, -1):
            best[room] = max(best[room], best[room - weight] + value)
    return best[capacity]
