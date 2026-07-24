def has_subset_sum(numbers, target):
    """Return whether a subset of non-negative numbers sums to target."""
    reachable = {0}
    for number in numbers:
        reachable |= {subtotal + number for subtotal in reachable}
        if target in reachable:
            return True
    return target in reachable
