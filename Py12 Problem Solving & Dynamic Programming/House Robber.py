def max_non_adjacent_sum(values):
    """Return the greatest sum obtainable without choosing adjacent values."""
    skip, take = 0, 0
    for position, value in enumerate(values):
        skip, take = max(skip, take), skip + value
    return max(skip, take)
