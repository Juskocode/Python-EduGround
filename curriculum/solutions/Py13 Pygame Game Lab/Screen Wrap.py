def wrap_position(position, width, height):
    x, y = position
    return x % width, y % height
