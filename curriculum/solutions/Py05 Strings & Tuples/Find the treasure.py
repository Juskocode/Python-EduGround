def map(pos, steps):
    list_of_steps = steps.split("-")
    for step in list_of_steps:
        if step == "up":
            pos = (pos[0], pos[1] + 1)
        elif step == "down":
            pos = (pos[0], pos[1] - 1)
        elif step == "left":
            pos = (pos[0] - 1, pos[1])
        elif step == "right":
            pos = (pos[0] + 1, pos[1])
    return pos