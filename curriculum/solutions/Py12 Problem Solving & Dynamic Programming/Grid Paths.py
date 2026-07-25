def grid_paths(rows, columns, blocked=()):
    """Count right/down paths through a grid while avoiding blocked cells."""
    if rows <= 0 or columns <= 0:
        return 0
    blocked_cells = set(blocked)
    ways = [0] * columns
    ways[0] = 1
    for row in range(rows):
        for column in range(columns):
            if (row, column) in blocked_cells:
                ways[column] = 0
            elif column > 0:
                ways[column] += ways[column - 1]
    return ways[-1]
