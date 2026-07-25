def gravity_landing(
    x,
    y,
    vertical_speed,
    platforms,
    player_width=24,
    player_height=32,
    gravity=1,
    terminal_speed=12,
):
    next_speed = min(vertical_speed + gravity, terminal_speed)
    next_y = y + next_speed
    current_bottom = y + player_height
    next_bottom = next_y + player_height
    landing_tops = []

    if next_speed >= 0:
        for platform_x, platform_y, platform_width, _ in platforms:
            overlaps_horizontally = (
                x < platform_x + platform_width
                and x + player_width > platform_x
            )
            crosses_top = current_bottom <= platform_y <= next_bottom
            if overlaps_horizontally and crosses_top:
                landing_tops.append(platform_y)

    if landing_tops:
        platform_top = min(landing_tops)
        return platform_top - player_height, 0, True

    return next_y, next_speed, False
