def colliding_targets(player, targets):
    player_x, player_y, player_width, player_height = player
    player_right = player_x + player_width
    player_bottom = player_y + player_height
    collisions = []

    for index, target in enumerate(targets):
        target_x, target_y, target_width, target_height = target
        target_right = target_x + target_width
        target_bottom = target_y + target_height
        overlaps = (
            player_x < target_right
            and player_right > target_x
            and player_y < target_bottom
            and player_bottom > target_y
        )
        if overlaps:
            collisions.append(index)

    return collisions
