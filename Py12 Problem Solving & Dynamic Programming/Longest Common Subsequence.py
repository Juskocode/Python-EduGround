def lcs_length(left, right):
    """Return the length of the longest subsequence shared by two strings."""
    previous = [0] * (len(right) + 1)
    for left_character in left:
        current = [0]
        for column, right_character in enumerate(right, start=1):
            if left_character == right_character:
                current.append(previous[column - 1] + 1)
            else:
                current.append(max(previous[column], current[-1]))
        previous = current
    return previous[-1]
