def player_intent(left, right, jump_pressed, on_ground, vertical_speed, move_speed=5, jump_strength=11):
    horizontal_speed = 0
    if left and not right:
        horizontal_speed = -move_speed
    elif right and not left:
        horizontal_speed = move_speed

    next_vertical_speed = vertical_speed
    if jump_pressed and on_ground:
        next_vertical_speed = -jump_strength

    return horizontal_speed, next_vertical_speed
