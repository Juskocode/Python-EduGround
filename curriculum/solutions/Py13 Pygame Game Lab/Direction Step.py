def direction_step(position, direction, cell_size=20):
    x, y = position
    offsets = {
        "up": (0, -cell_size),
        "down": (0, cell_size),
        "left": (-cell_size, 0),
        "right": (cell_size, 0),
    }
    dx, dy = offsets.get(direction, (0, 0))
    return x + dx, y + dy
