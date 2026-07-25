def edit_distance(source, destination):
    """Return the minimum insertions, deletions, and replacements required."""
    previous = list(range(len(destination) + 1))
    for row, source_character in enumerate(source, start=1):
        current = [row]
        for column, destination_character in enumerate(destination, start=1):
            replacement = previous[column - 1] + (source_character != destination_character)
            current.append(min(
                current[-1] + 1,
                previous[column] + 1,
                replacement,
            ))
        previous = current
    return previous[-1]
