def _next_head(position, direction, cell_size):
    offsets = {
        "up": (0, -cell_size),
        "down": (0, cell_size),
        "left": (-cell_size, 0),
        "right": (cell_size, 0),
    }
    x, y = position
    dx, dy = offsets.get(direction, (0, 0))
    return x + dx, y + dy


def advance_snake(snake, direction, food, cell_size=20):
    if not snake:
        return [], False

    new_head = _next_head(snake[0], direction, cell_size)
    ate_food = new_head == food
    body = snake if ate_food else snake[:-1]
    return [new_head, *body], ate_food
