def two_sum_indices(numbers, target):
    """Return the earliest pair of indexes whose values add to target."""
    first_index = {}
    for right, number in enumerate(numbers):
        needed = target - number
        if needed in first_index:
            return (first_index[needed], right)
        if number not in first_index:
            first_index[number] = right
    return None
