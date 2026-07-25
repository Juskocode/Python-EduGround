def find_treasure(pos, steps):
    if steps == []:
        return pos
    if steps[0] == "up":
        return find_treasure((pos[0], pos[1] + 1), steps[1:])
    if steps[0] == "down":
        return find_treasure((pos[0], pos[1] - 1), steps[1:])
    if steps[0] == "right":
        return find_treasure((pos[0] + 1, pos[1]), steps[1:])        
    #if steps[0] == "left":       pronto tecnicamente não é necessário pôr este último e faz com que a complexidade seja mais baixa
    return find_treasure((pos[0] - 1, pos[1]), steps[1:])
