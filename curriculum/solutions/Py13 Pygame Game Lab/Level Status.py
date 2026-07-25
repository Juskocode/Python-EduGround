def level_status(player, goal, fall_limit):
    player_x, player_y, player_width, player_height = player
    goal_x, goal_y, goal_width, goal_height = goal
    overlaps_goal = (
        player_x < goal_x + goal_width
        and player_x + player_width > goal_x
        and player_y < goal_y + goal_height
        and player_y + player_height > goal_y
    )
    if overlaps_goal:
        return "won"
    if player_y > fall_limit:
        return "fallen"
    return "running"
